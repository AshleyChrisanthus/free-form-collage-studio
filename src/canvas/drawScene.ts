import type { BoundingBox, CanvasObject, Point, Arrowhead, LineObject } from '../types/scene';
import { isImage, isLine } from '../types/guards';
import { rectIntersectsObject } from '../lib/geometry';
import { assetCache } from './assetCache';

export interface DrawSceneOptions {
  clipRect?: BoundingBox;
  background?: string;
  includeIds?: string[];
  pixelRatio?: number;
  stageBounds?: BoundingBox;
  dimExterior?: boolean;
  transparentBg?: boolean;
}

/**
 * Pure function to render scene objects onto any 2D canvas context.
 * Reused for screen display, offscreen thumbnails, and multi-format exporters.
 */
export function drawScene(
  ctx: CanvasRenderingContext2D,
  objects: CanvasObject[],
  opts?: DrawSceneOptions
): void {
  const includeSet = opts?.includeIds ? new Set(opts.includeIds) : null;

  // 1. Framing Engine Bounded Stage Rendering
  if (opts?.stageBounds) {
    const { x, y, width, height } = opts.stageBounds;

    // In edit view with exterior dimming:
    if (opts.dimExterior) {
      // Pass A: Draw dimmed ghost objects outside the stage (40% alpha)
      for (const obj of objects) {
        if (obj.hidden) continue;
        if (includeSet && !includeSet.has(obj.id)) continue;
        if (opts.clipRect && !rectIntersectsObject(opts.clipRect, obj)) continue;
        drawSingleObject(ctx, obj, 0.4);
      }
    }

    // Draw the stage backdrop surface with drop shadow
    ctx.save();
    ctx.shadowColor = 'rgba(0, 0, 0, 0.45)';
    ctx.shadowBlur = 28;
    ctx.shadowOffsetY = 8;
    ctx.fillStyle = opts.transparentBg ? '#1e293b' : (opts.background || '#ffffff');
    ctx.fillRect(x, y, width, height);
    ctx.restore();

    // If transparentBg, draw checkerboard pattern inside stage
    if (opts.transparentBg) {
      drawCheckerboard(ctx, x, y, width, height, 16);
    }

    // Pass B: Clip to the bounded stage and draw full-opacity objects
    ctx.save();
    ctx.beginPath();
    ctx.rect(x, y, width, height);
    ctx.clip();

    for (const obj of objects) {
      if (obj.hidden) continue;
      if (includeSet && !includeSet.has(obj.id)) continue;
      if (opts.clipRect && !rectIntersectsObject(opts.clipRect, obj)) continue;
      drawSingleObject(ctx, obj, 1.0);
    }
    ctx.restore();
    return;
  }

  // 2. Creation Engine (Unlimited Canvas) Rendering
  if (opts?.background) {
    ctx.save();
    ctx.fillStyle = opts.background;
    if (opts.clipRect) {
      ctx.fillRect(opts.clipRect.x, opts.clipRect.y, opts.clipRect.width, opts.clipRect.height);
    } else {
      ctx.fillRect(-100000, -100000, 200000, 200000);
    }
    ctx.restore();
  }

  for (const obj of objects) {
    if (obj.hidden) {
      continue;
    }
    if (includeSet && !includeSet.has(obj.id)) {
      continue;
    }

    // Viewport culling
    if (opts?.clipRect) {
      if (!rectIntersectsObject(opts.clipRect, obj)) {
        continue;
      }
    }

    drawSingleObject(ctx, obj, 1.0);
  }
}

function drawCheckerboard(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  size: number = 16
) {
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, w, h);
  ctx.clip();
  for (let cy = y; cy < y + h; cy += size) {
    for (let cx = x; cx < x + w; cx += size) {
      const isEven = (Math.floor(cx / size) + Math.floor(cy / size)) % 2 === 0;
      ctx.fillStyle = isEven ? '#334155' : '#1e293b';
      ctx.fillRect(cx, cy, size, size);
    }
  }
  ctx.restore();
}

function drawSingleObject(
  ctx: CanvasRenderingContext2D,
  obj: CanvasObject,
  alphaMod: number = 1.0
) {
  const width = Math.max(1, obj.width || 1);
  const height = Math.max(1, obj.height || 1);
  const cx = obj.x + width / 2;
  const cy = obj.y + height / 2;

  ctx.save();
  ctx.translate(cx, cy);

  if (obj.rotation) {
    ctx.rotate((obj.rotation * Math.PI) / 180);
  }

  const scaleX = obj.flipH ? -1 : 1;
  const scaleY = obj.flipV ? -1 : 1;
  if (scaleX !== 1 || scaleY !== 1) {
    ctx.scale(scaleX, scaleY);
  }

  ctx.globalAlpha = Math.max(0, Math.min(1, (obj.opacity ?? 1.0) * alphaMod));

  if (isImage(obj)) {
    const bitmap = assetCache.get(obj.assetId);
    if (bitmap) {
      ctx.drawImage(bitmap, -width / 2, -height / 2, width, height);
    } else {
      drawPlaceholder(ctx, -width / 2, -height / 2, width, height);
    }
  } else if (isLine(obj)) {
    drawLineObject(ctx, obj, cx, cy);
  }

  ctx.restore();
}

function drawPlaceholder(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  ctx.save();
  ctx.fillStyle = 'rgba(148, 163, 184, 0.15)';
  ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = 'rgba(148, 163, 184, 0.4)';
  ctx.lineWidth = 1;
  ctx.setLineDash([4, 4]);
  ctx.strokeRect(x, y, w, h);
  ctx.restore();
}

function drawLineObject(
  ctx: CanvasRenderingContext2D,
  line: LineObject,
  cx: number,
  cy: number
) {
  const points = line.points;
  if (!points || points.length < 2) return;

  // Convert points to local coordinates centered at (cx, cy)
  const localPts: Point[] = points.map((p) => ({
    x: p.x - cx,
    y: p.y - cy,
  }));

  ctx.save();
  ctx.strokeStyle = line.strokeColor || '#3b82f6';
  ctx.fillStyle = line.strokeColor || '#3b82f6';
  ctx.lineWidth = Math.max(1, line.strokeWidth || 2);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  if (line.strokeStyle === 'dashed') {
    ctx.setLineDash([line.strokeWidth * 3, line.strokeWidth * 2]);
  } else if (line.strokeStyle === 'dotted') {
    ctx.setLineDash([line.strokeWidth, line.strokeWidth * 2]);
  } else {
    ctx.setLineDash([]);
  }

  ctx.beginPath();
  ctx.moveTo(localPts[0].x, localPts[0].y);
  for (let i = 1; i < localPts.length; i++) {
    ctx.lineTo(localPts[i].x, localPts[i].y);
  }
  ctx.stroke();

  // Draw arrowheads if any
  if (line.startArrowhead && line.startArrowhead !== 'none') {
    drawArrowhead(ctx, localPts[1], localPts[0], line.startArrowhead, line.strokeWidth);
  }
  if (line.endArrowhead && line.endArrowhead !== 'none') {
    drawArrowhead(
      ctx,
      localPts[localPts.length - 2],
      localPts[localPts.length - 1],
      line.endArrowhead,
      line.strokeWidth
    );
  }

  ctx.restore();
}

function drawArrowhead(
  ctx: CanvasRenderingContext2D,
  from: Point,
  to: Point,
  type: Arrowhead,
  strokeWidth: number
) {
  const angle = Math.atan2(to.y - from.y, to.x - from.x);
  const size = Math.max(8, strokeWidth * 3.5);

  ctx.save();
  ctx.translate(to.x, to.y);
  ctx.rotate(angle);

  ctx.beginPath();
  switch (type) {
    case 'arrow':
      ctx.moveTo(-size, -size / 2);
      ctx.lineTo(0, 0);
      ctx.lineTo(-size, size / 2);
      ctx.stroke();
      break;
    case 'triangle':
      ctx.moveTo(-size, -size / 2);
      ctx.lineTo(0, 0);
      ctx.lineTo(-size, size / 2);
      ctx.closePath();
      ctx.fill();
      break;
    case 'circle':
      ctx.arc(-size / 2, 0, size / 2, 0, Math.PI * 2);
      ctx.fill();
      break;
    case 'diamond':
      ctx.moveTo(-size, 0);
      ctx.lineTo(-size / 2, -size / 2);
      ctx.lineTo(0, 0);
      ctx.lineTo(-size / 2, size / 2);
      ctx.closePath();
      ctx.fill();
      break;
    case 'bar':
      ctx.moveTo(0, -size / 2);
      ctx.lineTo(0, size / 2);
      ctx.stroke();
      break;
  }

  ctx.restore();
}
