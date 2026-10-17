import type {
  BoundingBox,
  CanvasObject,
  Point,
  ViewportState,
} from '../types/scene';

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
  guidelines: { orientation: 'h' | 'v'; pos: number }[];
  hoveredBinding: { objId: string; edge: string; point: Point } | null;
  cropRect: BoundingBox | null;
  lassoPoints: Point[] | null;
}

export function getObjectResizeHandles(
  obj: CanvasObject,
  zoom: number
): HandlePosition[] {
  const width = Math.max(1, obj.width);
  const height = Math.max(1, obj.height);
  const cx = obj.x + width / 2;
  const cy = obj.y + height / 2;
  const rotRad = ((obj.rotation || 0) * Math.PI) / 180;
  const cos = Math.cos(rotRad);
  const sin = Math.sin(rotRad);

  const localHandles: Array<{ type: ResizeHandleType; lx: number; ly: number; cursor: string }> = [
    { type: 'tl', lx: -width / 2, ly: -height / 2, cursor: 'nwse-resize' },
    { type: 'tc', lx: 0, ly: -height / 2, cursor: 'ns-resize' },
    { type: 'tr', lx: width / 2, ly: -height / 2, cursor: 'nesw-resize' },
    { type: 'ml', lx: -width / 2, ly: 0, cursor: 'ew-resize' },
    { type: 'mr', lx: width / 2, ly: 0, cursor: 'ew-resize' },
    { type: 'bl', lx: -width / 2, ly: height / 2, cursor: 'nesw-resize' },
    { type: 'bc', lx: 0, ly: height / 2, cursor: 'ns-resize' },
    { type: 'br', lx: width / 2, ly: height / 2, cursor: 'nwse-resize' },
    // Rotation handle 24px above top center
    { type: 'rot', lx: 0, ly: -height / 2 - 24 / zoom, cursor: 'crosshair' },
  ];

  return localHandles.map((h) => ({
    type: h.type,
    x: cx + (h.lx * cos - h.ly * sin),
    y: cy + (h.lx * sin + h.ly * cos),
    cursor: h.cursor,
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
  zoom: number
): void {
  const selectedObjs = objects.filter((o) => overlay.selection.includes(o.id));

  // 1. Framing Stage Border (in standard framing mode)
  if (viewport.workMode === 'standard') {
    drawFramingStageBounds(ctx, viewport);
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

    // Stalk line connecting rotation handle to top-center
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

  // 3. Handles for single selection
  if (selectedObjs.length === 1) {
    const handles = getObjectResizeHandles(selectedObjs[0], zoom);
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
        ctx.moveTo(guide.pos, -100000);
        ctx.lineTo(guide.pos, 100000);
      } else {
        ctx.moveTo(-100000, guide.pos);
        ctx.lineTo(100000, guide.pos);
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

function drawFramingStageBounds(ctx: CanvasRenderingContext2D, viewport: ViewportState) {
  const w = viewport.lockedCanvasW || viewport.customCanvasW || 1200;
  const h = viewport.lockedCanvasH || viewport.customCanvasH || 800;
  const x = viewport.renderOffsetX || 0;
  const y = viewport.renderOffsetY || 0;

  ctx.save();
  // Shadowed boundary around framing canvas
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.25)';
  ctx.lineWidth = 2;
  ctx.strokeRect(x, y, w, h);
  ctx.restore();
}
