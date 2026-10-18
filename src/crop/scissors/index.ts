import type { Point } from '../../types/scene';
import { useVariantStore } from '../../store/variantStore';
import { computeCostMap, findSnapAnchor, type CostMapData } from './costMap';
import { findPathDijkstra } from './dijkstra';
import { findPathAStar } from './astar';
import { smoothPath } from './smoothing';

export { computeCostMap, findSnapAnchor, type CostMapData };
export { findPathDijkstra } from './dijkstra';
export { findPathAStar } from './astar';
export { douglasPeucker, chaikinSubdivision, smoothPath } from './smoothing';

export interface IntelligentScissorsSession {
  costMap: CostMapData;
  scaleX: number;
  scaleY: number;
}

/**
 * Prepares a cost map from source image data, downscaling if long side exceeds maxDimension.
 */
export function initScissorsSession(
  imageData: ImageData,
  maxDimension: number = 2048
): IntelligentScissorsSession {
  const { width, height } = imageData;
  const longSide = Math.max(width, height);

  if (longSide <= maxDimension) {
    const costMap = computeCostMap(imageData);
    return { costMap, scaleX: 1, scaleY: 1 };
  }

  // Downscale image to fit maxDimension
  const scale = maxDimension / longSide;
  const targetW = Math.max(1, Math.round(width * scale));
  const targetH = Math.max(1, Math.round(height * scale));

  const canvas = document.createElement('canvas');
  canvas.width = targetW;
  canvas.height = targetH;
  const ctx = canvas.getContext('2d');

  if (!ctx) {
    const costMap = computeCostMap(imageData);
    return { costMap, scaleX: 1, scaleY: 1 };
  }

  // Draw onto canvas using temporary canvas
  const srcCanvas = document.createElement('canvas');
  srcCanvas.width = width;
  srcCanvas.height = height;
  const srcCtx = srcCanvas.getContext('2d');
  if (srcCtx) {
    srcCtx.putImageData(imageData, 0, 0);
    ctx.drawImage(srcCanvas, 0, 0, targetW, targetH);
  }

  const downscaledData = ctx.getImageData(0, 0, targetW, targetH);
  const costMap = computeCostMap(downscaledData);

  return {
    costMap,
    scaleX: width / targetW,
    scaleY: height / targetH,
  };
}

/**
 * Finds shortest edge path using active engine variant (Dijkstra vs A*).
 */
export function findScissorsPath(
  session: IntelligentScissorsSession,
  start: Point,
  end: Point
): Point[] {
  const { costMap, scaleX, scaleY } = session;

  // Scale input points to cost map resolution
  const mappedStart = { x: start.x / scaleX, y: start.y / scaleY };
  const mappedEnd = { x: end.x / scaleX, y: end.y / scaleY };

  const variant = useVariantStore.getState().variants.scissors;
  let rawPath: Point[];

  if (variant === 'dijkstra-main') {
    rawPath = findPathDijkstra(
      costMap.cost,
      costMap.width,
      costMap.height,
      mappedStart,
      mappedEnd
    );
  } else {
    // Default: 'astar-worker' (uses A* pathfinding)
    rawPath = findPathAStar(
      costMap.cost,
      costMap.width,
      costMap.height,
      mappedStart,
      mappedEnd
    );
  }

  // Map points back to original image coordinates
  if (scaleX === 1 && scaleY === 1) {
    return rawPath;
  }

  return rawPath.map((p) => ({
    x: p.x * scaleX,
    y: p.y * scaleY,
  }));
}

/**
 * Snaps a point to strongest edge in neighborhood radius using cost map.
 */
export function snapAnchorPoint(
  session: IntelligentScissorsSession,
  pt: Point,
  radius: number = 8
): Point {
  const { costMap, scaleX, scaleY } = session;
  const mapped = { x: pt.x / scaleX, y: pt.y / scaleY };
  const mappedRadius = Math.max(1, radius / Math.min(scaleX, scaleY));

  const snapped = findSnapAnchor(
    costMap.magnitude,
    costMap.width,
    costMap.height,
    mapped,
    mappedRadius
  );

  return {
    x: snapped.x * scaleX,
    y: snapped.y * scaleY,
  };
}

/**
 * Smooths closed lasso polygon based on active smoothing variant.
 */
export function smoothLassoPolygon(polygon: Point[]): Point[] {
  const smoothVariant = useVariantStore.getState().variants.pathSmooth;
  return smoothPath(polygon, smoothVariant, true, 1.2);
}
