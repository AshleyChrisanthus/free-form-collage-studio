import type { BoundingBox, CanvasObject, Point, Arrowhead, LineObject } from '../types/scene';
import { isImage, isLine } from '../types/guards';
import { rectIntersectsObject } from '../lib/geometry';
import { assetCache } from './assetCache';

export interface DrawSceneOptions {
  clipRect?: BoundingBox;
  background?: string;
  includeIds?: string[];
  pixelRatio?: number;
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
    if (includeSet && !includeSet.has(obj.id)) {
      continue;
    }

    // Viewport culling
    if (opts?.clipRect) {
      if (!rectIntersectsObject(opts.clipRect, obj)) {
        continue;
      }
    }

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

    ctx.globalAlpha = Math.max(0, Math.min(1, obj.opacity ?? 1.0));

    if (isImage(obj)) {
      const bitmap = assetCache.get(obj.assetId);
      if (bitmap) {
        ctx.drawImage(bitmap, -width / 2, -height / 2, width, height);
      } else {
        // Placeholder while asset is loading
        drawPlaceholder(ctx, -width / 2, -height / 2, width, height);
      }
    } else if (isLine(obj)) {
      drawLineObject(ctx, obj, cx, cy);
    }

    ctx.restore();
  }
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

  // Draw main path
  ctx.beginPath();
  ctx.moveTo(localPts[0].x, localPts[0].y);

  if (line.lineType === 'curve' && localPts.length > 2) {
    for (let i = 1; i < localPts.length - 1; i++) {
      const xc = (localPts[i].x + localPts[i + 1].x) / 2;
      const yc = (localPts[i].y + localPts[i + 1].y) / 2;
      ctx.quadraticCurveTo(localPts[i].x, localPts[i].y, xc, yc);
    }
    ctx.lineTo(localPts[localPts.length - 1].x, localPts[localPts.length - 1].y);
  } else if (line.lineType === 'elbow' && localPts.length === 2) {
    const midX = localPts[1].x;
    const midY = localPts[0].y;
    ctx.lineTo(midX, midY);
    ctx.lineTo(localPts[1].x, localPts[1].y);
  } else {
    for (let i = 1; i < localPts.length; i++) {
      ctx.lineTo(localPts[i].x, localPts[i].y);
    }
  }

  ctx.stroke();

  // Draw arrowheads
  if (line.startArrowhead && line.startArrowhead !== 'none') {
    const angle = Math.atan2(localPts[0].y - localPts[1].y, localPts[0].x - localPts[1].x);
    drawArrowhead(ctx, localPts[0], angle, line.startArrowhead, line.strokeWidth);
  }

  if (line.endArrowhead && line.endArrowhead !== 'none') {
    const len = localPts.length;
    const angle = Math.atan2(localPts[len - 1].y - localPts[len - 2].y, localPts[len - 1].x - localPts[len - 2].x);
    drawArrowhead(ctx, localPts[len - 1], angle, line.endArrowhead, line.strokeWidth);
  }

  ctx.restore();
}

function drawArrowhead(
  ctx: CanvasRenderingContext2D,
  tip: Point,
  angle: number,
  head: Arrowhead,
  strokeWidth: number
) {
  const size = Math.max(10, strokeWidth * 3.5);
  ctx.save();
  ctx.translate(tip.x, tip.y);
  ctx.rotate(angle);

  ctx.beginPath();
  switch (head) {
    case 'arrow':
      ctx.moveTo(-size, -size * 0.5);
      ctx.lineTo(0, 0);
      ctx.lineTo(-size, size * 0.5);
      ctx.stroke();
      break;

    case 'triangle':
      ctx.moveTo(0, 0);
      ctx.lineTo(-size, -size * 0.5);
      ctx.lineTo(-size, size * 0.5);
      ctx.closePath();
      ctx.fill();
      break;

    case 'circle':
      ctx.arc(-size * 0.4, 0, size * 0.4, 0, Math.PI * 2);
      ctx.fill();
      break;

    case 'diamond':
      ctx.moveTo(0, 0);
      ctx.lineTo(-size * 0.5, -size * 0.35);
      ctx.lineTo(-size, 0);
      ctx.lineTo(-size * 0.5, size * 0.35);
      ctx.closePath();
      ctx.fill();
      break;

    case 'bar':
      ctx.moveTo(0, -size * 0.6);
      ctx.lineTo(0, size * 0.6);
      ctx.stroke();
      break;
  }
  ctx.restore();
}
