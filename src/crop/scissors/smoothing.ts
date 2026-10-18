import type { Point } from '../../types/scene';

/**
 * Perpendicular distance from point p to line segment (a, b).
 */
function perpendicularDistance(p: Point, a: Point, b: Point): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const lenSq = dx * dx + dy * dy;

  if (lenSq === 0) {
    const px = p.x - a.x;
    const py = p.y - a.y;
    return Math.sqrt(px * px + py * py);
  }

  const cross = Math.abs((p.y - a.y) * dx - (p.x - a.x) * dy);
  return cross / Math.sqrt(lenSq);
}

/**
 * Douglas-Peucker polygon simplification algorithm.
 * @param points Array of points
 * @param epsilon Tolerance threshold (default 1.2)
 */
export function douglasPeucker(points: Point[], epsilon: number = 1.2): Point[] {
  if (points.length <= 2) return points;

  let maxDist = 0;
  let index = 0;
  const last = points.length - 1;

  for (let i = 1; i < last; i++) {
    const dist = perpendicularDistance(points[i], points[0], points[last]);
    if (dist > maxDist) {
      maxDist = dist;
      index = i;
    }
  }

  if (maxDist > epsilon) {
    const rec1 = douglasPeucker(points.slice(0, index + 1), epsilon);
    const rec2 = douglasPeucker(points.slice(index), epsilon);
    return rec1.slice(0, rec1.length - 1).concat(rec2);
  }

  return [points[0], points[last]];
}

/**
 * Chaikin's corner-cutting subdivision smoothing algorithm.
 * @param points Input points
 * @param iterations Number of subdivision passes (default 2)
 * @param closed Whether the path is a closed polygon
 */
export function chaikinSubdivision(
  points: Point[],
  iterations: number = 2,
  closed: boolean = true
): Point[] {
  if (points.length < 3) return points;

  let current = [...points];

  for (let it = 0; it < iterations; it++) {
    const smoothed: Point[] = [];
    const len = current.length;

    if (!closed) {
      smoothed.push(current[0]);
    }

    const maxI = closed ? len : len - 1;
    for (let i = 0; i < maxI; i++) {
      const p0 = current[i];
      const p1 = current[(i + 1) % len];

      const q: Point = {
        x: 0.75 * p0.x + 0.25 * p1.x,
        y: 0.75 * p0.y + 0.25 * p1.y,
      };
      const r: Point = {
        x: 0.25 * p0.x + 0.75 * p1.x,
        y: 0.25 * p0.y + 0.75 * p1.y,
      };

      smoothed.push(q, r);
    }

    if (!closed) {
      smoothed.push(current[len - 1]);
    }

    current = smoothed;
  }

  return current;
}

/**
 * Applies smoothing pipeline based on active engine variant ('dp' or 'dp-chaikin').
 */
export function smoothPath(
  points: Point[],
  variant: 'dp' | 'dp-chaikin' = 'dp-chaikin',
  closed: boolean = true,
  epsilon: number = 1.2
): Point[] {
  if (points.length < 3) return points;

  // Step 1: Douglas-Peucker simplification
  const simplified = douglasPeucker(points, epsilon);

  // Step 2: Chaikin subdivision for 'dp-chaikin'
  if (variant === 'dp-chaikin') {
    return chaikinSubdivision(simplified, 2, closed);
  }

  return simplified;
}
