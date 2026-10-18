import type {
  BoundingBox,
  CanvasObject,
  Point,
  ViewportState,
  GlobalSettings,
} from '../types/scene';
import { computeCanvasSize } from '../framing/canvasSize';

export type ResizeHandleType =
  | 'tl'
  | 'tc'
  | 'tr'
  | 'ml'
  | 'mr'
  | 'bl'
  | 'bc'
  | 'br'
  | 'rot';

export interface HandlePosition {
  type: ResizeHandleType;
  x: number;
  y: number;
  cursor: string;
}

export interface OverlayState {
  selection: string[];
  marquee: BoundingBox | null;
  guidelines: Array<{ orientation: 'h' | 'v'; pos: number; start?: number; end?: number }>;
  hoveredBinding: { objId: string; edge: string; point: Point } | null;
  cropRect: BoundingBox | null;
  lassoPoints: Point[] | null;
}

/**
 * Computes CSS resize cursor rotated by object angle.
 */
export function getRotatedCursor(baseType: ResizeHandleType, angleDeg: number): string {
  if (baseType === 'rot') return 'crosshair';

  let baseAngle = 0;
  switch (baseType) {
    case 'tc':
    case 'bc':
      baseAngle = 0;
      break;
    case 'tr':
    case 'bl':
      baseAngle = 45;
      break;
    case 'mr':
    case 'ml':
      baseAngle = 90;
      break;
    case 'br':
    case 'tl':
      baseAngle = 135;
      break;
  }

  const effectiveAngle = Math.round(((baseAngle + angleDeg) % 180 + 180) % 180);

  if (effectiveAngle < 22.5 || effectiveAngle >= 157.5) {
    return 'ns-resize';
  } else if (effectiveAngle < 67.5) {
    return 'nesw-resize';
  } else if (effectiveAngle < 112.5) {
    return 'ew-resize';
  } else {
    return 'nwse-resize';
  }
}

export function getObjectResizeHandles(
  obj: { x: number; y: number; width: number; height: number; rotation?: number },
  zoom: number
): HandlePosition[] {
  const width = Math.max(1, obj.width);
  const height = Math.max(1, obj.height);
  const cx = obj.x + width / 2;
  const cy = obj.y + height / 2;
  const rot = obj.rotation || 0;
  const rotRad = (rot * Math.PI) / 180;
  const cos = Math.cos(rotRad);
  const sin = Math.sin(rotRad);

  const localHandles: Array<{ type: ResizeHandleType; lx: number; ly: number }> = [
    { type: 'tl', lx: -width / 2, ly: -height / 2 },
    { type: 'tc', lx: 0, ly: -height / 2 },
    { type: 'tr', lx: width / 2, ly: -height / 2 },
    { type: 'ml', lx: -width / 2, ly: 0 },
    { type: 'mr', lx: width / 2, ly: 0 },
    { type: 'bl', lx: -width / 2, ly: height / 2 },
    { type: 'bc', lx: 0, ly: height / 2 },
    { type: 'br', lx: width / 2, ly: height / 2 },
    // Rotation handle 24px above top center
    { type: 'rot', lx: 0, ly: -height / 2 - 24 / zoom },
  ];

  return localHandles.map((h) => ({
    type: h.type,
    x: cx + (h.lx * cos - h.ly * sin),
    y: cy + (h.lx * sin + h.ly * cos),
    cursor: getRotatedCursor(h.type, rot),
  }));
}

/**
 * Render interactive overlays: selection boxes, 8 handles, rotation stalk,
 * marquee, guidelines, and framing stage borders.
 */
export function drawOverlay(
  ctx: CanvasRenderingContext2D,
  objects: CanvasObject[],
  overlay: OverlayState,
  viewport: ViewportState,
  zoom: number,
  settings?: GlobalSettings
): void {
  const selectedObjs = objects.filter((o) => overlay.selection.includes(o.id));

  // 1. Framing Stage Border (in standard framing mode)
  if (viewport.workMode === 'standard') {
    drawFramingStageBounds(ctx, objects, viewport, settings);
  }

  // 2. Selection outlines
  for (const obj of selectedObjs) {
    const isGrouped = obj.groupId !== null;
    const strokeColor = isGrouped ? '#06b6d4' : '#3b82f6';

    const width = Math.max(1, obj.width);
    const height = Math.max(1, obj.height);
    const cx = obj.x + width / 2;
    const cy = obj.y + height / 2;

    ctx.save();
    ctx.translate(cx, cy);
    if (obj.rotation) {
      ctx.rotate((obj.rotation * Math.PI) / 180);
    }

    ctx.strokeStyle = strokeColor;
    ctx.lineWidth = 1.5 / zoom;
    ctx.setLineDash([4 / zoom, 4 / zoom]);
    ctx.strokeRect(-width / 2, -height / 2, width, height);

    // Stalk line connecting rotation handle to top-center (for single selection)
    if (selectedObjs.length === 1) {
      ctx.beginPath();
      ctx.moveTo(0, -height / 2);
      ctx.lineTo(0, -height / 2 - 24 / zoom);
      ctx.strokeStyle = strokeColor;
      ctx.lineWidth = 1 / zoom;
      ctx.setLineDash([]);
      ctx.stroke();
    }

    ctx.restore();
  }

  // 3. Handles (for single object or combined multi-selection box)
  if (selectedObjs.length === 1) {
    const handles = getObjectResizeHandles(selectedObjs[0], zoom);
    renderHandles(ctx, handles, zoom);
  } else if (selectedObjs.length > 1) {
    // Combined multi-selection bounding box & handles
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;

    for (const obj of selectedObjs) {
      minX = Math.min(minX, obj.x);
      minY = Math.min(minY, obj.y);
      maxX = Math.max(maxX, obj.x + obj.width);
      maxY = Math.max(maxY, obj.y + obj.height);
    }

    const multiBox = {
      x: minX,
      y: minY,
      width: maxX - minX,
      height: maxY - minY,
      rotation: 0,
    };

    // Outer bounding frame for multi-selection
    ctx.save();
    ctx.strokeStyle = '#3b82f6';
    ctx.lineWidth = 1 / zoom;
    ctx.setLineDash([6 / zoom, 6 / zoom]);
    ctx.strokeRect(multiBox.x, multiBox.y, multiBox.width, multiBox.height);
    ctx.restore();

    const handles = getObjectResizeHandles(multiBox, zoom).filter((h) => h.type !== 'rot');
    renderHandles(ctx, handles, zoom);
  }

  // 4. Marquee box
  if (overlay.marquee) {
    ctx.save();
    ctx.fillStyle = 'rgba(59, 130, 246, 0.12)';
    ctx.strokeStyle = '#3b82f6';
    ctx.lineWidth = 1 / zoom;
    ctx.setLineDash([4 / zoom, 4 / zoom]);
    ctx.fillRect(
      overlay.marquee.x,
      overlay.marquee.y,
      overlay.marquee.width,
      overlay.marquee.height
    );
    ctx.strokeRect(
      overlay.marquee.x,
      overlay.marquee.y,
      overlay.marquee.width,
      overlay.marquee.height
    );
    ctx.restore();
  }

  // 5. Snapping Guidelines (magenta #ec4899)
  if (overlay.guidelines && overlay.guidelines.length > 0) {
    ctx.save();
    ctx.strokeStyle = '#ec4899';
    ctx.lineWidth = 1 / zoom;
    ctx.setLineDash([3 / zoom, 3 / zoom]);

    for (const guide of overlay.guidelines) {
      ctx.beginPath();
      if (guide.orientation === 'v') {
        const start = guide.start !== undefined ? guide.start : -100000;
        const end = guide.end !== undefined ? guide.end : 100000;
        ctx.moveTo(guide.pos, start);
        ctx.lineTo(guide.pos, end);
      } else {
        const start = guide.start !== undefined ? guide.start : -100000;
        const end = guide.end !== undefined ? guide.end : 100000;
        ctx.moveTo(start, guide.pos);
        ctx.lineTo(end, guide.pos);
      }
      ctx.stroke();
    }
    ctx.restore();
  }

  // 6. Hovered Binding Port Indicator
  if (overlay.hoveredBinding) {
    const pt = overlay.hoveredBinding.point;
    ctx.save();
    ctx.beginPath();
    ctx.arc(pt.x, pt.y, 6 / zoom, 0, Math.PI * 2);
    ctx.fillStyle = '#10b981';
    ctx.fill();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2 / zoom;
    ctx.stroke();
    ctx.restore();
  }

  // 7. Lasso crop path preview
  if (overlay.lassoPoints && overlay.lassoPoints.length > 1) {
    ctx.save();
    ctx.strokeStyle = '#f59e0b';
    ctx.lineWidth = 2 / zoom;
    ctx.setLineDash([3 / zoom, 3 / zoom]);
    ctx.beginPath();
    ctx.moveTo(overlay.lassoPoints[0].x, overlay.lassoPoints[0].y);
    for (let i = 1; i < overlay.lassoPoints.length; i++) {
      ctx.lineTo(overlay.lassoPoints[i].x, overlay.lassoPoints[i].y);
    }
    ctx.stroke();
    ctx.restore();
  }
}

function drawFramingStageBounds(
  ctx: CanvasRenderingContext2D,
  objects: CanvasObject[],
  viewport: ViewportState,
  settings?: GlobalSettings
) {
  const stage = computeCanvasSize(objects, viewport, settings);

  ctx.save();
  ctx.strokeStyle = viewport.canvasLocked ? '#3b82f6' : 'rgba(255, 255, 255, 0.4)';
  ctx.lineWidth = 1.5;
  ctx.strokeRect(stage.x, stage.y, stage.width, stage.height);
  ctx.restore();
}

function renderHandles(
  ctx: CanvasRenderingContext2D,
  handles: HandlePosition[],
  zoom: number
) {
  const handleRadius = Math.max(3.5, 4.5 / zoom);

  for (const h of handles) {
    ctx.save();
    ctx.beginPath();
    if (h.type === 'rot') {
      ctx.arc(h.x, h.y, handleRadius + 1 / zoom, 0, Math.PI * 2);
      ctx.fillStyle = '#3b82f6';
      ctx.fill();
      ctx.lineWidth = 1.5 / zoom;
      ctx.strokeStyle = '#ffffff';
      ctx.stroke();
    } else {
      ctx.rect(
        h.x - handleRadius,
        h.y - handleRadius,
        handleRadius * 2,
        handleRadius * 2
      );
      ctx.fillStyle = '#ffffff';
      ctx.fill();
      ctx.lineWidth = 1.5 / zoom;
      ctx.strokeStyle = '#3b82f6';
      ctx.stroke();
    }
    ctx.restore();
  }
}
