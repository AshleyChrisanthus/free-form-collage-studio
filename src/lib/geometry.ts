import type { BaseCanvasObject, BoundingBox, CanvasObject, Point, BindingEdge } from '../types/scene';

export function clamp(val: number, min: number, max: number): number {
  return Math.min(Math.max(val, min), max);
}

/**
 * Rotate a point around a center by degrees.
 */
export function rotatePoint(pt: Point, center: Point, angleDeg: number): Point {
  if (angleDeg === 0) return { x: pt.x, y: pt.y };
  const rad = (angleDeg * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  const dx = pt.x - center.x;
  const dy = pt.y - center.y;
  return {
    x: center.x + (dx * cos - dy * sin),
    y: center.y + (dx * sin + dy * cos),
  };
}

/**
 * Compute the axis-aligned bounding box (AABB) of a rotated object.
 */
export function getRotatedAABB(obj: BaseCanvasObject): BoundingBox {
  const width = Math.max(1, obj.width || 1);
  const height = Math.max(1, obj.height || 1);
  const x = obj.x;
  const y = obj.y;

  if (!obj.rotation || obj.rotation % 360 === 0) {
    return { x, y, width, height };
  }

  const cx = x + width / 2;
  const cy = y + height / 2;

  const corners: Point[] = [
    { x, y },
    { x: x + width, y },
    { x: x + width, y: y + height },
    { x, y: y + height },
  ];

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  for (const c of corners) {
    const rot = rotatePoint(c, { x: cx, y: cy }, obj.rotation);
    minX = Math.min(minX, rot.x);
    minY = Math.min(minY, rot.y);
    maxX = Math.max(maxX, rot.x);
    maxY = Math.max(maxY, rot.y);
  }

  return {
    x: minX,
    y: minY,
    width: maxX - minX,
    height: maxY - minY,
  };
}

/**
 * Compute bounding box of multi-point lines, ensuring finite width & height (min 1px).
 * Prevents NaN / Infinity bug.
 */
export function lineBounds(points: Point[], strokeWidth: number = 2): BoundingBox {
  if (!points || points.length === 0) {
    const pad = Math.max(1, strokeWidth / 2);
    return { x: 0, y: 0, width: pad * 2, height: pad * 2 };
  }

  let minX = points[0].x;
  let minY = points[0].y;
  let maxX = points[0].x;
  let maxY = points[0].y;

  for (let i = 1; i < points.length; i++) {
    const p = points[i];
    if (p.x < minX) minX = p.x;
    if (p.x > maxX) maxX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.y > maxY) maxY = p.y;
  }

  const pad = Math.max(1, strokeWidth / 2);
  const x = minX - pad;
  const y = minY - pad;
  const width = Math.max(1, maxX - minX + pad * 2);
  const height = Math.max(1, maxY - minY + pad * 2);

  return { x, y, width, height };
}

/**
 * Compute the union bounding box enclosing all given objects.
 */
export function unionBounds(objs: BaseCanvasObject[]): BoundingBox | null {
  if (!objs || objs.length === 0) return null;

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  for (const obj of objs) {
    const box = getRotatedAABB(obj);
    minX = Math.min(minX, box.x);
    minY = Math.min(minY, box.y);
    maxX = Math.max(maxX, box.x + box.width);
    maxY = Math.max(maxY, box.y + box.height);
  }

  if (minX === Infinity) return null;

  return {
    x: minX,
    y: minY,
    width: maxX - minX,
    height: maxY - minY,
  };
}

/**
 * Perpendicular distance from point p to line segment (a, b).
 */
export function distanceToSegment(p: Point, a: Point, b: Point): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) return Math.hypot(p.x - a.x, p.y - a.y);

  // Project point onto segment, clamped to [0, 1]
  const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / lenSq));
  const projX = a.x + t * dx;
  const projY = a.y + t * dy;
  return Math.hypot(p.x - projX, p.y - projY);
}

/**
 * Test if point is near a line or arrow object within stroke tolerance.
 */
export function pointNearLine(pt: Point, line: { points: Point[]; strokeWidth: number }, zoom = 1): boolean {
  const tolerance = Math.max(6, line.strokeWidth / 2 + 4) / zoom;
  const points = line.points;
  if (!points || points.length === 0) return false;
  if (points.length === 1) {
    return Math.hypot(pt.x - points[0].x, pt.y - points[0].y) <= tolerance;
  }

  for (let i = 0; i < points.length - 1; i++) {
    if (distanceToSegment(pt, points[i], points[i + 1]) <= tolerance) {
      return true;
    }
  }
  return false;
}

/**
 * Test if a point is inside an object, taking object rotation into account.
 */
export function pointInObject(pt: Point, obj: CanvasObject, zoom = 1): boolean {
  if (obj.type === 'line') {
    return pointNearLine(pt, obj, zoom);
  }

  const width = Math.max(1, obj.width);
  const height = Math.max(1, obj.height);
  const cx = obj.x + width / 2;
  const cy = obj.y + height / 2;

  // Unrotate point around object center
  const unrotated = rotatePoint(pt, { x: cx, y: cy }, -obj.rotation);

  return (
    unrotated.x >= obj.x &&
    unrotated.x <= obj.x + width &&
    unrotated.y >= obj.y &&
    unrotated.y <= obj.y + height
  );
}

/**
 * Test if a rectangle (e.g. marquee) intersects an object (AABB check with rotated bounds).
 */
export function rectIntersectsObject(rect: BoundingBox, obj: CanvasObject): boolean {
  const aabb = getRotatedAABB(obj);
  return !(
    rect.x > aabb.x + aabb.width ||
    rect.x + rect.width < aabb.x ||
    rect.y > aabb.y + aabb.height ||
    rect.y + rect.height < aabb.y
  );
}

/**
 * Compute binding anchor point (top, bottom, left, right, center) on an object.
 */
export function getBindingAnchor(obj: CanvasObject, edge: BindingEdge): Point {
  const cx = obj.x + obj.width / 2;
  const cy = obj.y + obj.height / 2;

  let unrotatedAnchor: Point;
  switch (edge) {
    case 'top':
      unrotatedAnchor = { x: cx, y: obj.y };
      break;
    case 'bottom':
      unrotatedAnchor = { x: cx, y: obj.y + obj.height };
      break;
    case 'left':
      unrotatedAnchor = { x: obj.x, y: cy };
      break;
    case 'right':
      unrotatedAnchor = { x: obj.x + obj.width, y: cy };
      break;
    case 'center':
    default:
      unrotatedAnchor = { x: cx, y: cy };
      break;
  }

  return rotatePoint(unrotatedAnchor, { x: cx, y: cy }, obj.rotation || 0);
}
