import { describe, it, expect, beforeEach } from 'vitest';
import {
  detectBackgroundColor,
  removeBackgroundHeuristic,
  heuristicRemover,
  neuralRemover,
  executeBackgroundRemoval,
} from '../src/ai/bgRemoval';
import { useSceneStore } from '../src/store/sceneStore';
import { useVariantStore } from '../src/store/variantStore';
import { db } from '../src/db/db';
import type { ImageObject } from '../src/types/scene';

describe('Background Removal Engine (#29)', () => {
  beforeEach(async () => {
    useSceneStore.getState().resetScene();
    await db.assets.clear();
    await db.kv.clear();
  });

  // Helper to create 20x20 test image with white background and red 8x8 center square
  function createTestImageData(): ImageData {
    const w = 20;
    const h = 20;
    const data = new Uint8ClampedArray(w * h * 4);

    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const idx = (y * w + x) * 4;
        const isCenter = x >= 6 && x < 14 && y >= 6 && y < 14;

        if (isCenter) {
          // Red foreground subject
          data[idx] = 255;
          data[idx + 1] = 0;
          data[idx + 2] = 0;
          data[idx + 3] = 255;
        } else {
          // White background
          data[idx] = 255;
          data[idx + 1] = 255;
          data[idx + 2] = 255;
          data[idx + 3] = 255;
        }
      }
    }

    return new ImageData(data, w, h);
  }

  it('detects white background color from 4 corner samples', () => {
    const imgData = createTestImageData();
    const bg = detectBackgroundColor(imgData);

    expect(bg.r).toBe(255);
    expect(bg.g).toBe(255);
    expect(bg.b).toBe(255);
  });

  it('zeroes alpha on background pixels while keeping foreground intact (Heuristic)', () => {
    const imgData = createTestImageData();
    const result = removeBackgroundHeuristic(imgData, { threshold: 40 });

    // Corner pixel (0, 0) should be transparent (alpha = 0)
    const cornerAlpha = result.data[3];
    expect(cornerAlpha).toBe(0);

    // Center pixel (10, 10) should remain opaque red
    const centerIdx = (10 * 20 + 10) * 4;
    expect(result.data[centerIdx]).toBe(255); // Red
    expect(result.data[centerIdx + 1]).toBe(0); // Green
    expect(result.data[centerIdx + 2]).toBe(0); // Blue
    expect(result.data[centerIdx + 3]).toBe(255); // Full alpha
  });

  it('feathers edge transitions with partial alpha values', () => {
    const w = 10;
    const h = 10;
    const data = new Uint8ClampedArray(w * h * 4);

    // Create a gradient from 255,255,255 down to 200,200,200
    for (let i = 0; i < w * h; i++) {
      const idx = i * 4;
      const v = 255 - i; // ΔC will be i * 3
      data[idx] = v;
      data[idx + 1] = v;
      data[idx + 2] = v;
      data[idx + 3] = 255;
    }

    const testImg = new ImageData(data, w, h);
    const result = removeBackgroundHeuristic(testImg, {
      threshold: 20,
      feather: true,
    });

    // Check that some intermediate pixels have feathered alpha (between 1 and 254)
    let hasFeathered = false;
    for (let i = 0; i < w * h; i++) {
      const a = result.data[i * 4 + 3];
      if (a > 0 && a < 255) {
        hasFeathered = true;
        break;
      }
    }
    expect(hasFeathered).toBe(true);
  });

  it('executes background removal on an ImageObject with undo support', async () => {
    const initialBlob = new Blob(['sample-img'], { type: 'image/png' });
    await db.assets.put({
      id: 'asset-bg-1',
      workspaceId: 'default',
      mimeType: 'image/png',
      blob: initialBlob,
      width: 20,
      height: 20,
      createdAt: Date.now(),
    });

    const targetObj: ImageObject = {
      id: 'obj-bg-1',
      type: 'image',
      assetId: 'asset-bg-1',
      x: 50,
      y: 50,
      width: 200,
      height: 200,
      origWidth: 20,
      origHeight: 20,
      rotation: 0,
      flipH: false,
      flipV: false,
      opacity: 1,
      groupId: null,
    };

    useSceneStore.getState().addObject(targetObj);

    const newAssetId = await executeBackgroundRemoval(targetObj, { threshold: 40 });
    expect(newAssetId).toBeDefined();

    const updated = useSceneStore.getState().objects[0] as ImageObject;
    expect(updated.assetId).toBe(newAssetId);

    // Verify Undo restores original assetId
    useSceneStore.getState().undo();
    const undone = useSceneStore.getState().objects[0] as ImageObject;
    expect(undone.assetId).toBe('asset-bg-1');

    // Verify Redo re-applies background removal
    useSceneStore.getState().redo();
    const redone = useSceneStore.getState().objects[0] as ImageObject;
    expect(redone.assetId).toBe(newAssetId);
  });

  it('switches between Heuristic and Neural variants seamlessly', async () => {
    await useVariantStore.getState().setVariant('bgRemoval', 'heuristic');
    expect(useVariantStore.getState().variants.bgRemoval).toBe('heuristic');

    await useVariantStore.getState().setVariant('bgRemoval', 'neural');
    expect(useVariantStore.getState().variants.bgRemoval).toBe('neural');

    // Both providers implement the same interface
    expect(heuristicRemover.id).toBe('heuristic');
    expect(neuralRemover.id).toBe('neural');
  });
});
