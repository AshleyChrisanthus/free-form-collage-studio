import { describe, it, expect } from 'vitest';
import {
  getRotatedAABB,
  lineBounds,
  unionBounds,
  pointInObject,
  rectIntersectsObject,
  clamp,
} from '../src/lib/geometry';
import type { BaseCanvasObject, CanvasObject } from '../src/types/scene';

describe('Geometry Helpers', () => {
  it('correctly calculates rotated AABB at 0°, 45°, 90°, and -180°', () => {
    const obj: BaseCanvasObject = {
      id: 'test-1',
      x: 100,
      y: 100,
      width: 100,
      height: 100,
      rotation: 0,
      opacity: 1,
      flipH: false,
      flipV: false,
      groupId: null,
    };

    // 0 degrees
    const aabb0 = getRotatedAABB(obj);
    expect(aabb0.x).toBeCloseTo(100);
    expect(aabb0.y).toBeCloseTo(100);
    expect(aabb0.width).toBeCloseTo(100);
    expect(aabb0.height).toBeCloseTo(100);

    // 90 degrees
    const aabb90 = getRotatedAABB({ ...obj, rotation: 90 });
    expect(aabb90.x).toBeCloseTo(100);
    expect(aabb90.y).toBeCloseTo(100);
    expect(aabb90.width).toBeCloseTo(100);
    expect(aabb90.height).toBeCloseTo(100);

    // 45 degrees
    const aabb45 = getRotatedAABB({ ...obj, rotation: 45 });
    const diagonal = 100 * Math.SQRT2;
    expect(aabb45.width).toBeCloseTo(diagonal, 1);
    expect(aabb45.height).toBeCloseTo(diagonal, 1);

    // -180 degrees
    const aabb180 = getRotatedAABB({ ...obj, rotation: -180 });
    expect(aabb180.width).toBeCloseTo(100);
    expect(aabb180.height).toBeCloseTo(100);
  });

  it('guarantees finite bounds for empty and single-point lines (fixes NaN/Infinity bug)', () => {
    const emptyBounds = lineBounds([], 2);
    expect(Number.isFinite(emptyBounds.x)).toBe(true);
    expect(Number.isFinite(emptyBounds.width)).toBe(true);
    expect(emptyBounds.width).toBeGreaterThanOrEqual(1);

    const singlePointBounds = lineBounds([{ x: 50, y: 50 }], 4);
    expect(Number.isFinite(singlePointBounds.x)).toBe(true);
    expect(singlePointBounds.width).toBeGreaterThanOrEqual(1);
    expect(singlePointBounds.height).toBeGreaterThanOrEqual(1);
  });

  it('computes union bounds of multiple objects', () => {
    const obj1: BaseCanvasObject = {
      id: '1',
      x: 0,
      y: 0,
      width: 100,
      height: 100,
      rotation: 0,
      opacity: 1,
      flipH: false,
      flipV: false,
      groupId: null,
    };
    const obj2: BaseCanvasObject = {
      id: '2',
      x: 200,
      y: 150,
      width: 50,
      height: 50,
      rotation: 0,
      opacity: 1,
      flipH: false,
      flipV: false,
      groupId: null,
    };

    const union = unionBounds([obj1, obj2]);
    expect(union).not.toBeNull();
    expect(union!.x).toBe(0);
    expect(union!.y).toBe(0);
    expect(union!.width).toBe(250);
    expect(union!.height).toBe(200);
  });

  it('accurately tests pointInObject with rotation', () => {
    const obj: CanvasObject = {
      id: 'img-1',
      type: 'image',
      assetId: 'asset-1',
      x: 100,
      y: 100,
      width: 100,
      height: 100,
      origWidth: 100,
      origHeight: 100,
      mimeType: 'image/png',
      rotation: 45,
      opacity: 1,
      flipH: false,
      flipV: false,
      groupId: null,
    };

    // Center is (150, 150)
    expect(pointInObject({ x: 150, y: 150 }, obj)).toBe(true);
    // Point far away
    expect(pointInObject({ x: 300, y: 300 }, obj)).toBe(false);
  });

  it('clamps numerical values', () => {
    expect(clamp(5, 0, 10)).toBe(5);
    expect(clamp(-5, 0, 10)).toBe(0);
    expect(clamp(15, 0, 10)).toBe(10);
  });
});
