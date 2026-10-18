import { describe, it, expect, beforeEach } from 'vitest';
import {
  computeCostMap,
  findSnapAnchor,
  findPathDijkstra,
  findPathAStar,
  douglasPeucker,
  chaikinSubdivision,
  smoothPath,
  initScissorsSession,
  findScissorsPath,
  snapAnchorPoint,
  smoothLassoPolygon,
} from '../src/crop/scissors';
import { useVariantStore } from '../src/store/variantStore';

describe('Intelligent Scissors (Magnetic Lasso) Engine (#28)', () => {
  // Create a 20x20 test image with a high-contrast vertical edge at x = 10
  // Left side: black (0, 0, 0)
  // Right side: white (255, 255, 255)
  function createEdgeImageData(w = 20, h = 20): ImageData {
    const data = new Uint8ClampedArray(w * h * 4);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const idx = (y * w + x) * 4;
        const val = x >= 10 ? 255 : 0;
        data[idx] = val;
        data[idx + 1] = val;
        data[idx + 2] = val;
        data[idx + 3] = 255;
      }
    }
    return new ImageData(data, w, h);
  }

  it('computes edge cost map with low cost on high-contrast edges', () => {
    const imgData = createEdgeImageData(20, 20);
    const { width, height, cost, magnitude } = computeCostMap(imgData);

    expect(width).toBe(20);
    expect(height).toBe(20);

    // Magnitude at edge (x=10, y=10) should be much higher than flat region (x=2, y=10)
    const edgeMag = magnitude[10 * 20 + 10];
    const flatMag = magnitude[10 * 20 + 2];
    expect(edgeMag).toBeGreaterThan(flatMag);

    // Cost at edge should be much lower than flat region
    const edgeCost = cost[10 * 20 + 10];
    const flatCost = cost[10 * 20 + 2];
    expect(edgeCost).toBeLessThan(flatCost);
  });

  it('snaps anchor point to nearest high-contrast edge', () => {
    const imgData = createEdgeImageData(20, 20);
    const { width, height, magnitude } = computeCostMap(imgData);

    // Point at (8, 10) is near edge at x=10
    const snapped = findSnapAnchor(magnitude, width, height, { x: 8, y: 10 }, 5);
    // Should snap closer to x=9 or x=10
    expect(Math.abs(snapped.x - 10)).toBeLessThanOrEqual(1);
    expect(snapped.y).toBe(10);
  });

  it('traces edge path with Dijkstra (Legacy variant)', () => {
    const imgData = createEdgeImageData(20, 20);
    const { width, height, cost } = computeCostMap(imgData);

    const start = { x: 10, y: 2 };
    const end = { x: 10, y: 18 };

    const path = findPathDijkstra(cost, width, height, start, end, 5);
    expect(path.length).toBeGreaterThan(1);
    expect(path[0]).toEqual({ x: 10, y: 2 });
    expect(path[path.length - 1]).toEqual({ x: 10, y: 18 });

    // Every intermediate point should stay along the edge around x=10
    for (const pt of path) {
      expect(Math.abs(pt.x - 10)).toBeLessThanOrEqual(1);
    }
  });

  it('traces edge path with A* (Improved variant)', () => {
    const imgData = createEdgeImageData(20, 20);
    const { width, height, cost } = computeCostMap(imgData);

    const start = { x: 10, y: 2 };
    const end = { x: 10, y: 18 };

    const path = findPathAStar(cost, width, height, start, end, 5);
    expect(path.length).toBeGreaterThan(1);
    expect(path[0]).toEqual({ x: 10, y: 2 });
    expect(path[path.length - 1]).toEqual({ x: 10, y: 18 });

    // Should closely track the edge line
    for (const pt of path) {
      expect(Math.abs(pt.x - 10)).toBeLessThanOrEqual(1);
    }
  });

  it('simplifies collinear vertices with Douglas-Peucker', () => {
    const line = [
      { x: 0, y: 0 },
      { x: 2, y: 0 },
      { x: 5, y: 0.1 },
      { x: 8, y: -0.1 },
      { x: 10, y: 0 },
    ];

    const simplified = douglasPeucker(line, 0.5);
    expect(simplified.length).toBe(2);
    expect(simplified[0]).toEqual({ x: 0, y: 0 });
    expect(simplified[1]).toEqual({ x: 10, y: 0 });
  });

  it('smooths corners with Chaikin subdivision', () => {
    const square = [
      { x: 0, y: 0 },
      { x: 100, y: 0 },
      { x: 100, y: 100 },
      { x: 0, y: 100 },
    ];

    const smoothed = chaikinSubdivision(square, 2, true);
    // 4 points * 2^2 * 2^2 ... after 2 iterations: 4 * 2 * 2 = 16 points
    expect(smoothed.length).toBe(16);
  });

  it('switches between Legacy Dijkstra and Improved A* at runtime', async () => {
    const imgData = createEdgeImageData(20, 20);
    const session = initScissorsSession(imgData);

    // Test with A*
    await useVariantStore.getState().setVariant('scissors', 'astar-worker');
    const pathAStar = findScissorsPath(session, { x: 10, y: 2 }, { x: 10, y: 18 });
    expect(pathAStar.length).toBeGreaterThan(0);

    // Test with Dijkstra
    await useVariantStore.getState().setVariant('scissors', 'dijkstra-main');
    const pathDijkstra = findScissorsPath(session, { x: 10, y: 2 }, { x: 10, y: 18 });
    expect(pathDijkstra.length).toBeGreaterThan(0);

    // Reset back to astar-worker
    await useVariantStore.getState().setVariant('scissors', 'astar-worker');
  });

  it('switches between DP and DP+Chaikin smoothing variants', async () => {
    const poly = [
      { x: 0, y: 0 },
      { x: 50, y: 0 },
      { x: 100, y: 50 },
      { x: 50, y: 100 },
      { x: 0, y: 50 },
    ];

    await useVariantStore.getState().setVariant('pathSmooth', 'dp');
    const dpOnly = smoothLassoPolygon(poly);

    await useVariantStore.getState().setVariant('pathSmooth', 'dp-chaikin');
    const dpChaikin = smoothLassoPolygon(poly);

    // dp-chaikin creates more subdivided points for smoother curvature
    expect(dpChaikin.length).toBeGreaterThan(dpOnly.length);
  });
});
