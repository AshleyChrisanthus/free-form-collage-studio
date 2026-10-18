import type { BackgroundRemover, BackgroundRemoverOptions } from './types';

/**
 * Samples a 5x5 pixel block in imageData and computes its average RGB.
 */
function sampleCornerColor(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  startX: number,
  startY: number
): { r: number; g: number; b: number } {
  let sumR = 0;
  let sumG = 0;
  let sumB = 0;
  let count = 0;

  for (let dy = 0; dy < 5; dy++) {
    const y = Math.min(height - 1, Math.max(0, startY + dy));
    for (let dx = 0; dx < 5; dx++) {
      const x = Math.min(width - 1, Math.max(0, startX + dx));
      const idx = (y * width + x) * 4;
      sumR += data[idx];
      sumG += data[idx + 1];
      sumB += data[idx + 2];
      count++;
    }
  }

  return {
    r: Math.round(sumR / count),
    g: Math.round(sumG / count),
    b: Math.round(sumB / count),
  };
}

/**
 * Determines dominant background color from the 4 corners.
 */
export function detectBackgroundColor(
  imageData: ImageData
): { r: number; g: number; b: number } {
  const { width, height, data } = imageData;

  const tl = sampleCornerColor(data, width, height, 0, 0);
  const tr = sampleCornerColor(data, width, height, Math.max(0, width - 5), 0);
  const bl = sampleCornerColor(data, width, height, 0, Math.max(0, height - 5));
  const br = sampleCornerColor(
    data,
    width,
    height,
    Math.max(0, width - 5),
    Math.max(0, height - 5)
  );

  const corners = [tl, tr, bl, br];

  // Check agreement between corners (Manhattan distance < 30)
  let bestCorner = corners[0];
  let maxMatches = -1;

  for (let i = 0; i < 4; i++) {
    let matches = 0;
    for (let j = 0; j < 4; j++) {
      if (i === j) continue;
      const dist =
        Math.abs(corners[i].r - corners[j].r) +
        Math.abs(corners[i].g - corners[j].g) +
        Math.abs(corners[i].b - corners[j].b);
      if (dist < 30) matches++;
    }
    if (matches > maxMatches) {
      maxMatches = matches;
      bestCorner = corners[i];
    }
  }

  return bestCorner;
}

/**
 * Legacy Heuristic background removal algorithm.
 * Manhattan distance ΔC = |ΔR| + |ΔG| + |ΔB|
 */
export function removeBackgroundHeuristic(
  imageData: ImageData,
  opts?: BackgroundRemoverOptions
): ImageData {
  const { width, height, data } = imageData;
  const threshold = opts?.threshold ?? 40;
  const feather = opts?.feather ?? false;
  const floodFill = opts?.floodFill ?? false;

  const bg = detectBackgroundColor(imageData);
  const outputData = new Uint8ClampedArray(data);
  const numPixels = width * height;

  const featherMax = threshold * 1.5;

  if (floodFill) {
    // Breadth-first search from boundary pixels only
    const visited = new Uint8Array(numPixels);
    const queue: number[] = [];

    // Push all border pixels to queue
    for (let x = 0; x < width; x++) {
      queue.push(x); // top
      queue.push((height - 1) * width + x); // bottom
      visited[x] = 1;
      visited[(height - 1) * width + x] = 1;
    }
    for (let y = 1; y < height - 1; y++) {
      queue.push(y * width); // left
      queue.push(y * width + (width - 1)); // right
      visited[y * width] = 1;
      visited[y * width + (width - 1)] = 1;
    }

    let head = 0;
    while (head < queue.length) {
      const idx = queue[head++];
      const pixelIdx = idx * 4;

      const deltaC =
        Math.abs(outputData[pixelIdx] - bg.r) +
        Math.abs(outputData[pixelIdx + 1] - bg.g) +
        Math.abs(outputData[pixelIdx + 2] - bg.b);

      if (deltaC <= threshold) {
        outputData[pixelIdx + 3] = 0; // Transparent

        const px = idx % width;
        const py = Math.floor(idx / width);

        // Check 4-connected neighbors
        const neighbors = [
          px > 0 ? idx - 1 : -1,
          px < width - 1 ? idx + 1 : -1,
          py > 0 ? idx - width : -1,
          py < height - 1 ? idx + width : -1,
        ];

        for (const n of neighbors) {
          if (n !== -1 && !visited[n]) {
            visited[n] = 1;
            queue.push(n);
          }
        }
      } else if (feather && deltaC < featherMax) {
        const factor = (deltaC - threshold) / (featherMax - threshold);
        outputData[pixelIdx + 3] = Math.round(outputData[pixelIdx + 3] * factor);
      }
    }
  } else {
    // Global threshold across entire image
    for (let i = 0; i < numPixels; i++) {
      const pIdx = i * 4;
      const deltaC =
        Math.abs(outputData[pIdx] - bg.r) +
        Math.abs(outputData[pIdx + 1] - bg.g) +
        Math.abs(outputData[pIdx + 2] - bg.b);

      if (deltaC <= threshold) {
        outputData[pIdx + 3] = 0;
      } else if (feather && deltaC < featherMax) {
        const factor = (deltaC - threshold) / (featherMax - threshold);
        outputData[pIdx + 3] = Math.round(outputData[pIdx + 3] * factor);
      }
    }
  }

  return new ImageData(outputData, width, height);
}

export const heuristicRemover: BackgroundRemover = {
  id: 'heuristic',
  async isAvailable() {
    return { ok: true };
  },
  async remove(imageData: ImageData, opts?: BackgroundRemoverOptions) {
    opts?.onProgress?.(20, 'Sampling corners');
    const result = removeBackgroundHeuristic(imageData, opts);
    opts?.onProgress?.(100, 'Complete');
    return result;
  },
};
