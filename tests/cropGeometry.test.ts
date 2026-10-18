import { describe, it, expect, beforeEach } from 'vitest';
import {
  worldToLocal,
  localToWorld,
  localToPixel,
  pixelToLocal,
  computePolygonBounds,
  clampRectToImage,
  computeCroppedObjectPlacement,
} from '../src/crop/geometry';
import { applyCrop } from '../src/crop/applyCrop';
import { useSceneStore } from '../src/store/sceneStore';
import { db } from '../src/db/db';
import type { ImageObject } from '../src/types/scene';

describe('Crop Geometry & Transforms (#27)', () => {
  const baseImg: ImageObject = {
    id: 'test-img',
    type: 'image',
    assetId: 'asset-1',
    x: 100,
    y: 100,
    width: 200,
    height: 100,
    origWidth: 800,
    origHeight: 400,
    rotation: 0,
    flipH: false,
    flipV: false,
    opacity: 1,
    groupId: null,
  };

  it('maps world coordinates to local and back without rotation or flip', () => {
    const worldPt = { x: 150, y: 125 };
    const local = worldToLocal(baseImg, worldPt);
    expect(local.x).toBe(50);
    expect(local.y).toBe(25);

    const backToWorld = localToWorld(baseImg, local);
    expect(backToWorld.x).toBeCloseTo(150);
    expect(backToWorld.y).toBeCloseTo(125);
  });

  it('maps world coordinates to local and back with 90 degree rotation', () => {
    const rotatedImg: ImageObject = {
      ...baseImg,
      rotation: 90,
    };

    // Center is at (200, 150)
    const localPt = { x: 50, y: 30 };
    const world = localToWorld(rotatedImg, localPt);
    const roundTrippedLocal = worldToLocal(rotatedImg, world);

    expect(roundTrippedLocal.x).toBeCloseTo(50, 3);
    expect(roundTrippedLocal.y).toBeCloseTo(30, 3);
  });

  it('handles horizontal and vertical flips accurately in round trips', () => {
    const flippedImg: ImageObject = {
      ...baseImg,
      rotation: 45,
      flipH: true,
      flipV: true,
    };

    const localPt = { x: 120, y: 80 };
    const world = localToWorld(flippedImg, localPt);
    const roundTripped = worldToLocal(flippedImg, world);

    expect(roundTripped.x).toBeCloseTo(120, 3);
    expect(roundTripped.y).toBeCloseTo(80, 3);
  });

  it('converts between local coordinates and raw pixel coordinates', () => {
    const local = { x: 50, y: 25 };
    const pixel = localToPixel(baseImg, local);
    // origWidth / width = 800 / 200 = 4; origHeight / height = 400 / 100 = 4
    expect(pixel.x).toBe(200);
    expect(pixel.y).toBe(100);

    const backLocal = pixelToLocal(baseImg, pixel);
    expect(backLocal.x).toBe(50);
    expect(backLocal.y).toBe(25);
  });

  it('computes tight polygon bounds and clamps to image', () => {
    const poly = [
      { x: -20, y: 10 },
      { x: 150, y: 120 },
      { x: 40, y: 50 },
    ];
    const bounds = computePolygonBounds(poly);
    expect(bounds.x).toBe(-20);
    expect(bounds.y).toBe(10);
    expect(bounds.width).toBe(170);
    expect(bounds.height).toBe(110);

    const clamped = clampRectToImage(bounds, baseImg.width, baseImg.height);
    expect(clamped.x).toBe(0);
    expect(clamped.y).toBe(10);
    expect(clamped.width).toBe(150);
    expect(clamped.height).toBe(90);
  });

  it('keeps cropped region visually identical in world coordinates even when rotated and flipped', () => {
    const complexImg: ImageObject = {
      ...baseImg,
      x: 300,
      y: 200,
      width: 200,
      height: 200,
      rotation: 30,
      flipH: true,
      flipV: false,
    };

    const croppedBox = { x: 40, y: 40, width: 80, height: 80 };
    const placement = computeCroppedObjectPlacement(complexImg, croppedBox);

    expect(placement.width).toBe(80);
    expect(placement.height).toBe(80);

    // The center of the cropped box in the original object
    const originalLocalCenter = { x: 80, y: 80 };
    const originalWorldCenter = localToWorld(complexImg, originalLocalCenter);

    // The center of the new cropped object
    const newWorldCenter = {
      x: placement.x + placement.width / 2,
      y: placement.y + placement.height / 2,
    };

    expect(newWorldCenter.x).toBeCloseTo(originalWorldCenter.x, 3);
    expect(newWorldCenter.y).toBeCloseTo(originalWorldCenter.y, 3);
  });
});

describe('applyCrop Actions: Crop, Duplicate, Cut (#27)', () => {
  beforeEach(async () => {
    useSceneStore.getState().resetScene();
    await db.assets.clear();

    const dummyBlob = new Blob(['mock-data'], { type: 'image/png' });
    await db.assets.put({
      id: 'mock-asset',
      workspaceId: 'default',
      mimeType: 'image/png',
      blob: dummyBlob,
      width: 400,
      height: 400,
      createdAt: Date.now(),
    });
  });

  const testImg: ImageObject = {
    id: 'img-crop-1',
    type: 'image',
    assetId: 'mock-asset',
    x: 100,
    y: 100,
    width: 200,
    height: 200,
    origWidth: 400,
    origHeight: 400,
    rotation: 45,
    flipH: false,
    flipV: false,
    opacity: 1,
    groupId: null,
  };

  const cropPoly = [
    { x: 20, y: 20 },
    { x: 120, y: 20 },
    { x: 120, y: 120 },
    { x: 20, y: 120 },
  ];

  it('performs Crop action in-place with undo support', async () => {
    useSceneStore.getState().addObject(testImg);

    const res = await applyCrop(testImg, cropPoly, 'crop');
    expect(res).not.toBeNull();
    expect(res?.action).toBe('crop');

    const updated = useSceneStore.getState().objects[0] as ImageObject;
    expect(updated.assetId).toBe(res?.croppedAssetId);
    expect(updated.width).toBe(100);
    expect(updated.height).toBe(100);

    // Verify undo restores original dimensions and asset
    useSceneStore.getState().undo();
    const undone = useSceneStore.getState().objects[0] as ImageObject;
    expect(undone.assetId).toBe('mock-asset');
    expect(undone.width).toBe(200);
    expect(undone.height).toBe(200);
  });

  it('performs Duplicate action leaving original untouched and adding new object', async () => {
    useSceneStore.getState().addObject(testImg);

    const res = await applyCrop(testImg, cropPoly, 'duplicate');
    expect(res).not.toBeNull();
    expect(res?.action).toBe('duplicate');

    const objs = useSceneStore.getState().objects;
    expect(objs.length).toBe(2);
    expect(objs[0].id).toBe(testImg.id);
    expect(objs[1].id).toBe(res?.newObject?.id);
    expect(useSceneStore.getState().selection).toEqual([objs[1].id]);

    // Undo removes duplicated object
    useSceneStore.getState().undo();
    expect(useSceneStore.getState().objects.length).toBe(1);
    expect(useSceneStore.getState().objects[0].id).toBe(testImg.id);
  });

  it('performs Cut action creating new cropped object and updating original', async () => {
    useSceneStore.getState().addObject(testImg);

    const res = await applyCrop(testImg, cropPoly, 'cut');
    expect(res).not.toBeNull();
    expect(res?.action).toBe('cut');
    expect(res?.cutAssetId).toBeDefined();

    const objs = useSceneStore.getState().objects;
    expect(objs.length).toBe(2);
    // Original image got a new cutAssetId
    expect((objs[0] as ImageObject).assetId).toBe(res?.cutAssetId);

    // Undo restores original asset
    useSceneStore.getState().undo();
    expect(useSceneStore.getState().objects.length).toBe(1);
    expect((useSceneStore.getState().objects[0] as ImageObject).assetId).toBe('mock-asset');
  });
});
