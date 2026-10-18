import type { BoundingBox } from '../types/scene';
import type { ResizeHandleType } from './drawOverlay';

/**
 * Computes resized bounding box with opposite anchor pinned in local/rotated space.
 * Corner handles preserve aspect ratio by default (unless preserveAspect === false).
 * Edge handles stretch only along that axis.
 * fromCenter (Alt) expands equally around center.
 */
export function computeResize(
  initial: BoundingBox & { rotation?: number },
  handle: ResizeHandleType,
  dx: number,
  dy: number,
  preserveAspect = false,
  fromCenter = false
): BoundingBox {
  const rot = initial.rotation || 0;
  const rotRad = (rot * Math.PI) / 180;
  const cos = Math.cos(rotRad);
  const sin = Math.sin(rotRad);

  // Project world dx, dy into object local space
  const ldx = dx * cos + dy * sin;
  const ldy = -dx * sin + dy * cos;

  const w0 = Math.max(1, initial.width);
  const h0 = Math.max(1, initial.height);
  const origAspect = w0 / h0;

  let dw = 0;
  let dh = 0;

  switch (handle) {
    case 'br':
      dw = ldx;
      dh = ldy;
      break;
    case 'bl':
      dw = -ldx;
      dh = ldy;
      break;
    case 'tr':
      dw = ldx;
      dh = -ldy;
      break;
    case 'tl':
      dw = -ldx;
      dh = -ldy;
      break;
    case 'mr':
      dw = ldx;
      dh = 0;
      break;
    case 'ml':
      dw = -ldx;
      dh = 0;
      break;
    case 'bc':
      dw = 0;
      dh = ldy;
      break;
    case 'tc':
      dw = 0;
      dh = -ldy;
      break;
    default:
      return { x: initial.x, y: initial.y, width: initial.width, height: initial.height };
  }

  if (fromCenter) {
    dw *= 2;
    dh *= 2;
  }

  let w1 = Math.max(20, w0 + dw);
  let h1 = Math.max(20, h0 + dh);

  const isCorner = ['tl', 'tr', 'bl', 'br'].includes(handle);
  if (isCorner && preserveAspect) {
    // Keep proportional scaling based on dominant axis
    if (Math.abs(dw / w0) >= Math.abs(dh / h0)) {
      h1 = Math.max(20, Math.round(w1 / origAspect));
    } else {
      w1 = Math.max(20, Math.round(h1 * origAspect));
    }
  }

  // Anchor points relative to unrotated center:
  let anchorOldX = 0;
  let anchorOldY = 0;
  let anchorNewX = 0;
  let anchorNewY = 0;

  switch (handle) {
    case 'br':
      anchorOldX = -w0 / 2; anchorOldY = -h0 / 2;
      anchorNewX = -w1 / 2; anchorNewY = -h1 / 2;
      break;
    case 'bl':
      anchorOldX = w0 / 2; anchorOldY = -h0 / 2;
      anchorNewX = w1 / 2; anchorNewY = -h1 / 2;
      break;
    case 'tr':
      anchorOldX = -w0 / 2; anchorOldY = h0 / 2;
      anchorNewX = -w1 / 2; anchorNewY = h1 / 2;
      break;
    case 'tl':
      anchorOldX = w0 / 2; anchorOldY = h0 / 2;
      anchorNewX = w1 / 2; anchorNewY = h1 / 2;
      break;
    case 'mr':
      anchorOldX = -w0 / 2; anchorOldY = 0;
      anchorNewX = -w1 / 2; anchorNewY = 0;
      break;
    case 'ml':
      anchorOldX = w0 / 2; anchorOldY = 0;
      anchorNewX = w1 / 2; anchorNewY = 0;
      break;
    case 'bc':
      anchorOldX = 0; anchorOldY = -h0 / 2;
      anchorNewX = 0; anchorNewY = -h1 / 2;
      break;
    case 'tc':
      anchorOldX = 0; anchorOldY = h0 / 2;
      anchorNewX = 0; anchorNewY = h1 / 2;
      break;
  }

  const cx0 = initial.x + w0 / 2;
  const cy0 = initial.y + h0 / 2;

  let cx1 = cx0;
  let cy1 = cy0;

  if (!fromCenter) {
    const dAnchorX = anchorOldX - anchorNewX;
    const dAnchorY = anchorOldY - anchorNewY;
    cx1 = cx0 + (dAnchorX * cos - dAnchorY * sin);
    cy1 = cy0 + (dAnchorX * sin + dAnchorY * cos);
  }

  return {
    x: Math.round(cx1 - w1 / 2),
    y: Math.round(cy1 - h1 / 2),
    width: Math.round(w1),
    height: Math.round(h1),
  };
}

/**
 * Computes multi-object resize, scaling positions and dimensions proportionally.
 */
export function computeMultiResize(
  initialBoxes: Map<string, BoundingBox>,
  targetIds: string[],
  handle: ResizeHandleType,
  dx: number,
  dy: number,
  preserveAspect = false,
  fromCenter = false
): Map<string, BoundingBox> {
  const initialUnion = initialBoxes.get('__multi__');
  if (!initialUnion || initialUnion.width <= 0 || initialUnion.height <= 0) {
    return initialBoxes;
  }

  const newUnion = computeResize(initialUnion, handle, dx, dy, preserveAspect, fromCenter);
  const scaleX = newUnion.width / initialUnion.width;
  const scaleY = newUnion.height / initialUnion.height;

  const result = new Map<string, BoundingBox>();
  result.set('__multi__', newUnion);

  for (const id of targetIds) {
    const init = initialBoxes.get(id);
    if (!init) continue;

    const relX = (init.x - initialUnion.x) * scaleX;
    const relY = (init.y - initialUnion.y) * scaleY;

    result.set(id, {
      x: Math.round(newUnion.x + relX),
      y: Math.round(newUnion.y + relY),
      width: Math.max(20, Math.round(init.width * scaleX)),
      height: Math.max(20, Math.round(init.height * scaleY)),
    });
  }

  return result;
}
