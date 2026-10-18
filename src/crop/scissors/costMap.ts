import type { Point } from '../../types/scene';

export interface CostMapData {
  width: number;
  height: number;
  cost: Uint16Array;
  magnitude: Uint8Array;
}

/**
 * Computes Gaussian blur (3x3), Sobel multi-channel edge gradient,
 * and inverted edge cost map from ImageData.
 * Cost formula: cost = 255 - M_norm + 1
 */
export function computeCostMap(imageData: ImageData): CostMapData {
  const { width, height, data } = imageData;
  const numPixels = width * height;

  // 1. 3x3 Gaussian Blur: [1 2 1; 2 4 2; 1 2 1] / 16
  const blurred = new Uint8Array(numPixels * 4);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let r = 0, g = 0, b = 0, a = 0;

      for (let ky = -1; ky <= 1; ky++) {
        const py = Math.min(height - 1, Math.max(0, y + ky));
        const wy = ky === 0 ? 2 : 1;

        for (let kx = -1; kx <= 1; kx++) {
          const px = Math.min(width - 1, Math.max(0, x + kx));
          const wx = kx === 0 ? 2 : 1;
          const weight = wx * wy;

          const idx = (py * width + px) * 4;
          r += data[idx] * weight;
          g += data[idx + 1] * weight;
          b += data[idx + 2] * weight;
          a += data[idx + 3] * weight;
        }
      }

      const outIdx = (y * width + x) * 4;
      blurred[outIdx] = r >> 4;
      blurred[outIdx + 1] = g >> 4;
      blurred[outIdx + 2] = b >> 4;
      blurred[outIdx + 3] = a >> 4;
    }
  }

  // 2. Sobel multi-channel gradient: max(G_R, G_G, G_B, G_gray)
  const rawMag = new Float32Array(numPixels);
  let maxMag = 0.0001;

  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      // Sample 3x3 window channels
      let maxChannelMag = 0;

      // 4 channels: 0=R, 1=G, 2=B, 3=Luminance
      for (let c = 0; c < 4; c++) {
        const getVal = (dx: number, dy: number): number => {
          const idx = ((y + dy) * width + (x + dx)) * 4;
          if (c < 3) return blurred[idx + c];
          // Luminance
          return (
            0.299 * blurred[idx] +
            0.587 * blurred[idx + 1] +
            0.114 * blurred[idx + 2]
          );
        };

        const gx =
          -getVal(-1, -1) + getVal(1, -1) +
          -2 * getVal(-1, 0) + 2 * getVal(1, 0) +
          -getVal(-1, 1) + getVal(1, 1);

        const gy =
          -getVal(-1, -1) - 2 * getVal(0, -1) - getVal(1, -1) +
          getVal(-1, 1) + 2 * getVal(0, 1) + getVal(1, 1);

        const mag = Math.sqrt(gx * gx + gy * gy);
        if (mag > maxChannelMag) {
          maxChannelMag = mag;
        }
      }

      const pIdx = y * width + x;
      rawMag[pIdx] = maxChannelMag;
      if (maxChannelMag > maxMag) {
        maxMag = maxChannelMag;
      }
    }
  }

  // 3. Normalize magnitude 0-255 and calculate Cost (255 - M_norm + 1)
  const magnitude = new Uint8Array(numPixels);
  const cost = new Uint16Array(numPixels);

  const normFactor = 255 / maxMag;

  for (let i = 0; i < numPixels; i++) {
    const norm = Math.min(255, Math.round(rawMag[i] * normFactor));
    magnitude[i] = norm;
    cost[i] = 255 - norm + 1; // Range: 1 (strongest edge) to 256 (flat)
  }

  return { width, height, cost, magnitude };
}

/**
 * Searches in a neighborhood radius r around pt for the pixel with highest edge magnitude.
 */
export function findSnapAnchor(
  magnitude: Uint8Array,
  width: number,
  height: number,
  pt: Point,
  radius: number = 8
): Point {
  const cx = Math.round(pt.x);
  const cy = Math.round(pt.y);

  let bestX = cx;
  let bestY = cy;
  let maxM = -1;
  let minDistanceSq = Infinity;

  const minX = Math.max(0, cx - radius);
  const maxX = Math.min(width - 1, cx + radius);
  const minY = Math.max(0, cy - radius);
  const maxY = Math.min(height - 1, cy + radius);

  const rSq = radius * radius;

  for (let y = minY; y <= maxY; y++) {
    for (let x = minX; x <= maxX; x++) {
      const dSq = (x - cx) * (x - cx) + (y - cy) * (y - cy);
      if (dSq > rSq) continue;

      const m = magnitude[y * width + x];
      if (m > maxM || (m === maxM && dSq < minDistanceSq)) {
        maxM = m;
        minDistanceSq = dSq;
        bestX = x;
        bestY = y;
      }
    }
  }

  return { x: bestX, y: bestY };
}
