import type { BoundingBox, CanvasObject, ImageObject, Point } from '../types/scene';

/**
 * Maps a world coordinate (from canvas stage) into an object's local coordinate space.
 * In local space: (0, 0) is top-left of the unrotated/unflipped object,
 * and (obj.width, obj.height) is the bottom-right corner.
 */
export function worldToLocal(obj: CanvasObject, worldPt: Point): Point {
  const width = obj.width;
  const height = obj.height;
  const cx = obj.x + width / 2;
  const cy = obj.y + height / 2;

  const dx = worldPt.x - cx;
  const dy = worldPt.y - cy;

  const rad = -(obj.rotation * Math.PI) / 180;
  let rx = dx * Math.cos(rad) - dy * Math.sin(rad);
  let ry = dx * Math.sin(rad) + dy * Math.cos(rad);

  if (obj.flipH) rx = -rx;
  if (obj.flipV) ry = -ry;

  return {
    x: rx + width / 2,
    y: ry + height / 2,
  };
}

/**
 * Maps an object's local coordinate space back to the canvas world coordinate space.
 */
export function localToWorld(obj: CanvasObject, localPt: Point): Point {
  const width = obj.width;
  const height = obj.height;
  const cx = obj.x + width / 2;
  const cy = obj.y + height / 2;

  let rx = localPt.x - width / 2;
  let ry = localPt.y - height / 2;

  if (obj.flipH) rx = -rx;
  if (obj.flipV) ry = -ry;

  const rad = (obj.rotation * Math.PI) / 180;
  const wx = cx + (rx * Math.cos(rad) - ry * Math.sin(rad));
  const wy = cy + (rx * Math.sin(rad) + ry * Math.cos(rad));

  return { x: wx, y: wy };
}

/**
 * Converts local object coordinates to original asset pixel coordinates.
 */
export function localToPixel(obj: ImageObject, localPt: Point): Point {
  const scaleX = obj.origWidth / (obj.width || 1);
  const scaleY = obj.origHeight / (obj.height || 1);
  return {
    x: localPt.x * scaleX,
    y: localPt.y * scaleY,
  };
}

/**
 * Converts original asset pixel coordinates to local object coordinates.
 */
export function pixelToLocal(obj: ImageObject, pixelPt: Point): Point {
  const scaleX = (obj.width || 1) / obj.origWidth;
  const scaleY = (obj.height || 1) / obj.origHeight;
  return {
    x: pixelPt.x * scaleX,
    y: pixelPt.y * scaleY,
  };
}

/**
 * Computes tight axis-aligned bounding box of a list of points.
 */
export function computePolygonBounds(points: Point[]): BoundingBox {
  if (points.length === 0) {
    return { x: 0, y: 0, width: 0, height: 0 };
  }

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  for (const p of points) {
    if (p.x < minX) minX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.x > maxX) maxX = p.x;
    if (p.y > maxY) maxY = p.y;
  }

  return {
    x: minX,
    y: minY,
    width: Math.max(1, maxX - minX),
    height: Math.max(1, maxY - minY),
  };
}

/**
 * Clamps a local bounding box to be within image boundaries.
 */
export function clampRectToImage(
  rect: BoundingBox,
  imageWidth: number,
  imageHeight: number
): BoundingBox {
  const x1 = Math.max(0, Math.min(imageWidth, rect.x));
  const y1 = Math.max(0, Math.min(imageHeight, rect.y));
  const x2 = Math.max(0, Math.min(imageWidth, rect.x + rect.width));
  const y2 = Math.max(0, Math.min(imageHeight, rect.y + rect.height));

  const minX = Math.min(x1, x2);
  const minY = Math.min(y1, y2);
  const width = Math.max(1, Math.abs(x2 - x1));
  const height = Math.max(1, Math.abs(y2 - y1));

  return { x: minX, y: minY, width, height };
}

/**
 * Calculates new placement (x, y, width, height) of a cropped sub-region
 * so that it stays at the EXACT visual location in world space, preserving
 * the original object's rotation and flip.
 */
export function computeCroppedObjectPlacement(
  original: ImageObject,
  croppedLocalBox: BoundingBox
): { x: number; y: number; width: number; height: number } {
  const localCenterX = croppedLocalBox.x + croppedLocalBox.width / 2;
  const localCenterY = croppedLocalBox.y + croppedLocalBox.height / 2;

  // The center of the cropped box mapped to world coordinates
  const worldCenter = localToWorld(original, { x: localCenterX, y: localCenterY });

  const newWidth = croppedLocalBox.width;
  const newHeight = croppedLocalBox.height;

  return {
    x: worldCenter.x - newWidth / 2,
    y: worldCenter.y - newHeight / 2,
    width: newWidth,
    height: newHeight,
  };
}
