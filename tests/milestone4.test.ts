import { describe, it, expect, beforeEach } from 'vitest';
import { useSceneStore } from '../src/store/sceneStore';
import { useVariantStore } from '../src/store/variantStore';
import { db } from '../src/db/db';
import {
  worldToLocal,
  localToWorld,
  computeCroppedObjectPlacement,
  clampRectToImage,
} from '../src/crop/geometry';
import { applyCrop } from '../src/crop/applyCrop';
import {
  computeCostMap,
  findSnapAnchor,
  findScissorsPath,
  initScissorsSession,
  smoothLassoPolygon,
} from '../src/crop/scissors';
import {
  detectBackgroundColor,
  removeBackgroundHeuristic,
  executeBackgroundRemoval,
  heuristicRemover,
  neuralRemover,
} from '../src/ai/bgRemoval';
import type { ImageObject } from '../src/types/scene';

describe('Milestone 4 – Cropping Suite, Intelligent Scissors & AI Background Removal Acceptance Suite (#27–#29)', () => {
  beforeEach(async () => {
    useSceneStore.getState().resetScene();
    await db.assets.clear();
    await db.kv.clear();

    const mockBlob = new Blob(['sample-pixel-data'], { type: 'image/png' });
    await db.assets.put({
      id: 'm4-test-asset',
      workspaceId: 'default',
      mimeType: 'image/png',
      blob: mockBlob,
      width: 400,
      height: 300,
      createdAt: Date.now(),
    });
  });

  describe('Issue #27: Rectangular & Freeform Lasso Crop with Crop / Duplicate / Cut actions', () => {
    it('verifies cropping a rotated and flipped image keeps the selected region exactly stationary in world space', () => {
      const rotatedFlippedImg: ImageObject = {
        id: 'test-img-1',
        type: 'image',
        assetId: 'm4-test-asset',
        x: 250,
        y: 180,
        width: 300,
        height: 200,
        origWidth: 600,
        origHeight: 400,
        rotation: 45,
        flipH: true,
        flipV: false,
        opacity: 0.9,
        groupId: null,
      };

      const cropBox = { x: 50, y: 40, width: 120, height: 80 };
      const placement = computeCroppedObjectPlacement(rotatedFlippedImg, cropBox);

      expect(placement.width).toBe(120);
      expect(placement.height).toBe(80);

      // Verify center of sub-rectangle in local coordinates maps to identical world coordinates
      const subRectLocalCenter = {
        x: cropBox.x + cropBox.width / 2,
        y: cropBox.y + cropBox.height / 2,
      };
      const worldCenterBefore = localToWorld(rotatedFlippedImg, subRectLocalCenter);

      const worldCenterAfter = {
        x: placement.x + placement.width / 2,
        y: placement.y + placement.height / 2,
      };

      expect(worldCenterAfter.x).toBeCloseTo(worldCenterBefore.x, 3);
      expect(worldCenterAfter.y).toBeCloseTo(worldCenterBefore.y, 3);
    });

    it('verifies Crop action replaces asset in-place and preserves full undo/redo cycle', async () => {
      const img: ImageObject = {
        id: 'img-action-1',
        type: 'image',
        assetId: 'm4-test-asset',
        x: 100,
        y: 100,
        width: 200,
        height: 200,
        origWidth: 400,
        origHeight: 400,
        rotation: 0,
        flipH: false,
        flipV: false,
        opacity: 1,
        groupId: null,
      };
      useSceneStore.getState().addObject(img);

      const polygon = [
        { x: 10, y: 10 },
        { x: 110, y: 10 },
        { x: 110, y: 110 },
        { x: 10, y: 110 },
      ];

      const res = await applyCrop(img, polygon, 'crop');
      expect(res).not.toBeNull();
      expect(res?.action).toBe('crop');

      const afterCrop = useSceneStore.getState().objects[0] as ImageObject;
      expect(afterCrop.assetId).toBe(res?.croppedAssetId);
      expect(afterCrop.width).toBe(100);
      expect(afterCrop.height).toBe(100);

      // Undo reverts to original asset and dimensions
      useSceneStore.getState().undo();
      const afterUndo = useSceneStore.getState().objects[0] as ImageObject;
      expect(afterUndo.assetId).toBe('m4-test-asset');
      expect(afterUndo.width).toBe(200);

      // Redo re-applies the crop
      useSceneStore.getState().redo();
      const afterRedo = useSceneStore.getState().objects[0] as ImageObject;
      expect(afterRedo.assetId).toBe(res?.croppedAssetId);
      expect(afterRedo.width).toBe(100);
    });

    it('verifies Duplicate action spawns new object and leaves original intact', async () => {
      const img: ImageObject = {
        id: 'img-dup-1',
        type: 'image',
        assetId: 'm4-test-asset',
        x: 50,
        y: 50,
        width: 200,
        height: 150,
        origWidth: 400,
        origHeight: 300,
        rotation: 15,
        flipH: false,
        flipV: false,
        opacity: 1,
        groupId: null,
      };
      useSceneStore.getState().addObject(img);

      const polygon = [
        { x: 20, y: 20 },
        { x: 120, y: 20 },
        { x: 120, y: 80 },
        { x: 20, y: 80 },
      ];

      const res = await applyCrop(img, polygon, 'duplicate');
      expect(res?.action).toBe('duplicate');
      expect(res?.newObject).toBeDefined();

      const objs = useSceneStore.getState().objects;
      expect(objs.length).toBe(2);
      expect(objs[0].id).toBe('img-dup-1');
      expect(objs[1].id).toBe(res?.newObject?.id);
      expect(objs[1].rotation).toBe(15);
      expect(useSceneStore.getState().selection).toEqual([objs[1].id]);

      // Undo removes duplicate
      useSceneStore.getState().undo();
      expect(useSceneStore.getState().objects.length).toBe(1);
    });

    it('verifies Cut action creates new object and transparently cuts hole in original', async () => {
      const img: ImageObject = {
        id: 'img-cut-1',
        type: 'image',
        assetId: 'm4-test-asset',
        x: 0,
        y: 0,
        width: 300,
        height: 300,
        origWidth: 300,
        origHeight: 300,
        rotation: 0,
        flipH: false,
        flipV: false,
        opacity: 1,
        groupId: null,
      };
      useSceneStore.getState().addObject(img);

      const polygon = [
        { x: 50, y: 50 },
        { x: 150, y: 50 },
        { x: 150, y: 150 },
        { x: 50, y: 150 },
      ];

      const res = await applyCrop(img, polygon, 'cut');
      expect(res?.action).toBe('cut');
      expect(res?.cutAssetId).toBeDefined();

      const objs = useSceneStore.getState().objects;
      expect(objs.length).toBe(2);
      expect((objs[0] as ImageObject).assetId).toBe(res?.cutAssetId);

      // Undo restores original asset
      useSceneStore.getState().undo();
      expect(useSceneStore.getState().objects.length).toBe(1);
      expect((useSceneStore.getState().objects[0] as ImageObject).assetId).toBe('m4-test-asset');
    });
  });

  describe('Issue #28: Magnetic Lasso (Intelligent Scissors) Engine', () => {
    function createHighContrastImage(w = 32, h = 32): ImageData {
      const data = new Uint8ClampedArray(w * h * 4);
      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          const idx = (y * w + x) * 4;
          // Step edge at x = 16
          const val = x >= 16 ? 240 : 15;
          data[idx] = val;
          data[idx + 1] = val;
          data[idx + 2] = val;
          data[idx + 3] = 255;
        }
      }
      return new ImageData(data, w, h);
    }

    it('generates cost map with minimum cost along edge boundary', () => {
      const imgData = createHighContrastImage(32, 32);
      const costMap = computeCostMap(imgData);

      // Edge magnitude along x=16
      const edgeM = costMap.magnitude[16 * 32 + 16];
      const flatM = costMap.magnitude[16 * 32 + 4];
      expect(edgeM).toBeGreaterThan(flatM);

      // Cost is inversely proportional to gradient: cost = 255 - M_norm + 1
      const edgeCost = costMap.cost[16 * 32 + 16];
      const flatCost = costMap.cost[16 * 32 + 4];
      expect(edgeCost).toBeLessThan(flatCost);
    });

    it('snaps anchor within configurable radius to strongest gradient peak', () => {
      const imgData = createHighContrastImage(32, 32);
      const { magnitude, width, height } = computeCostMap(imgData);

      // Point at (13, 16) is within 8px radius of edge at x=16
      const snapped = findSnapAnchor(magnitude, width, height, { x: 13, y: 16 }, 8);
      expect(Math.abs(snapped.x - 16)).toBeLessThanOrEqual(1);
      expect(snapped.y).toBe(16);
    });

    it('traces edge path using both Dijkstra (Legacy) and A* (Improved) variants', async () => {
      const imgData = createHighContrastImage(32, 32);
      const session = initScissorsSession(imgData);

      const start = { x: 16, y: 4 };
      const end = { x: 16, y: 28 };

      // 1. Improved A*
      await useVariantStore.getState().setVariant('scissors', 'astar-worker');
      const astarPath = findScissorsPath(session, start, end);
      expect(astarPath.length).toBeGreaterThan(1);
      expect(astarPath[0]).toEqual(start);
      expect(astarPath[astarPath.length - 1]).toEqual(end);

      // 2. Legacy Dijkstra
      await useVariantStore.getState().setVariant('scissors', 'dijkstra-main');
      const dijkstraPath = findScissorsPath(session, start, end);
      expect(dijkstraPath.length).toBeGreaterThan(1);
      expect(dijkstraPath[0]).toEqual(start);
      expect(dijkstraPath[dijkstraPath.length - 1]).toEqual(end);

      // Reset variant
      await useVariantStore.getState().setVariant('scissors', 'astar-worker');
    });

    it('smooths closed lasso contours using Douglas-Peucker and Chaikin subdivision', async () => {
      const polygon = [
        { x: 10, y: 10 },
        { x: 90, y: 10 },
        { x: 90, y: 90 },
        { x: 10, y: 90 },
      ];

      await useVariantStore.getState().setVariant('pathSmooth', 'dp-chaikin');
      const smoothed = smoothLassoPolygon(polygon);

      // Chaikin subdivision creates refined rounded polygon corners
      expect(smoothed.length).toBeGreaterThan(polygon.length);
    });
  });

  describe('Issue #29: Automated Background Removal (Legacy Heuristic & Improved Neural)', () => {
    function createPortraitMock(w = 24, h = 24): ImageData {
      const data = new Uint8ClampedArray(w * h * 4);
      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          const idx = (y * w + x) * 4;
          const isSubject = x >= 8 && x < 16 && y >= 8 && y < 16;
          if (isSubject) {
            // Dark foreground subject (RGB 20, 20, 20)
            data[idx] = 20;
            data[idx + 1] = 20;
            data[idx + 2] = 20;
            data[idx + 3] = 255;
          } else {
            // Clean white studio backdrop (RGB 250, 250, 250)
            data[idx] = 250;
            data[idx + 1] = 250;
            data[idx + 2] = 250;
            data[idx + 3] = 255;
          }
        }
      }
      return new ImageData(data, w, h);
    }

    it('detects background color from corner sampling accurately', () => {
      const imgData = createPortraitMock(24, 24);
      const bg = detectBackgroundColor(imgData);
      expect(bg.r).toBe(250);
      expect(bg.g).toBe(250);
      expect(bg.b).toBe(250);
    });

    it('clears alpha on backdrop while preserving subject pixels', () => {
      const imgData = createPortraitMock(24, 24);
      const res = removeBackgroundHeuristic(imgData, { threshold: 40 });

      // Corner (0, 0) should have alpha = 0
      expect(res.data[3]).toBe(0);

      // Center (12, 12) should have alpha = 255 and dark RGB
      const centerIdx = (12 * 24 + 12) * 4;
      expect(res.data[centerIdx]).toBe(20);
      expect(res.data[centerIdx + 3]).toBe(255);
    });

    it('switches between Heuristic and Neural variants without requiring reload', async () => {
      await useVariantStore.getState().setVariant('bgRemoval', 'heuristic');
      expect(useVariantStore.getState().variants.bgRemoval).toBe('heuristic');
      const heuristicAvail = await heuristicRemover.isAvailable();
      expect(heuristicAvail.ok).toBe(true);

      await useVariantStore.getState().setVariant('bgRemoval', 'neural');
      expect(useVariantStore.getState().variants.bgRemoval).toBe('neural');
      const neuralAvail = await neuralRemover.isAvailable();
      expect(neuralAvail.ok).toBe(true);
    });

    it('executes background removal on canvas image and registers undoable transaction', async () => {
      const testObj: ImageObject = {
        id: 'bg-remove-obj-1',
        type: 'image',
        assetId: 'm4-test-asset',
        x: 100,
        y: 100,
        width: 200,
        height: 200,
        origWidth: 24,
        origHeight: 24,
        rotation: 0,
        flipH: false,
        flipV: false,
        opacity: 1,
        groupId: null,
      };
      useSceneStore.getState().addObject(testObj);

      const newAssetId = await executeBackgroundRemoval(testObj, { threshold: 40 });
      expect(newAssetId).toBeDefined();

      const updated = useSceneStore.getState().objects[0] as ImageObject;
      expect(updated.assetId).toBe(newAssetId);

      // Undo restores original assetId
      useSceneStore.getState().undo();
      const reverted = useSceneStore.getState().objects[0] as ImageObject;
      expect(reverted.assetId).toBe('m4-test-asset');

      // Redo restores transparent assetId
      useSceneStore.getState().redo();
      const redone = useSceneStore.getState().objects[0] as ImageObject;
      expect(redone.assetId).toBe(newAssetId);
    });
  });
});
