import { describe, it, expect } from 'vitest';
import {
  computeCanvasSize,
  isValidRatioString,
  parseRatio,
} from '../src/framing/canvasSize';
import type { CanvasObject, ViewportState } from '../src/types/scene';
import { DEFAULT_VIEWPORT } from '../src/store/sceneStore';

describe('Framing Stage & Canvas Size', () => {
  it('validates custom ratio strings correctly', () => {
    expect(isValidRatioString('16:9')).toBe(true);
    expect(isValidRatioString('21:9')).toBe(true);
    expect(isValidRatioString('2.35:1')).toBe(true);
    expect(isValidRatioString('invalid')).toBe(false);
    expect(isValidRatioString('16:')).toBe(false);
    expect(isValidRatioString('0:0')).toBe(false);
  });

  it('parses presets and custom ratios', () => {
    expect(parseRatio('1:1')).toBe(1.0);
    expect(parseRatio('16:9')).toBeCloseTo(16 / 9, 4);
    expect(parseRatio('9:16')).toBeCloseTo(9 / 16, 4);
    expect(parseRatio('21:9')).toBeCloseTo(21 / 9, 4);
    expect(parseRatio('auto')).toBeNull();
  });

  it('computes exact aspect ratio and contains all content for presets', () => {
    const objects: CanvasObject[] = [
      {
        id: '1',
        type: 'image',
        x: 100,
        y: 100,
        width: 400,
        height: 200,
        opacity: 1,
        rotation: 0,
        flipH: false,
        flipV: false,
        groupId: null,
        assetId: 'a1',
      },
    ];

    const vp1_1: ViewportState = {
      ...DEFAULT_VIEWPORT,
      workMode: 'standard',
      canvasMode: '1:1',
    };

    const stage1_1 = computeCanvasSize(objects, vp1_1);
    // Content is 400x200. For 1:1, width 400 means height must be 400.
    expect(stage1_1.width).toBe(400);
    expect(stage1_1.height).toBe(400);
    expect(stage1_1.aspectRatio).toBe(1.0);
    // Content centered:
    expect(stage1_1.x).toBe(100);
    expect(stage1_1.y).toBe(0); // 100 - (400 - 200) / 2 = 0

    // Test 16:9 preset
    const vp16_9: ViewportState = {
      ...DEFAULT_VIEWPORT,
      workMode: 'standard',
      canvasMode: '16:9',
    };
    const stage16_9 = computeCanvasSize(objects, vp16_9);
    expect(stage16_9.width / stage16_9.height).toBeCloseTo(16 / 9, 2);
    // Verify it fully contains the content
    expect(stage16_9.x).toBeLessThanOrEqual(100);
    expect(stage16_9.y).toBeLessThanOrEqual(100);
    expect(stage16_9.x + stage16_9.width).toBeGreaterThanOrEqual(500);
    expect(stage16_9.y + stage16_9.height).toBeGreaterThanOrEqual(300);
  });

  it('auto mode wraps tightly to content bounds', () => {
    const objects: CanvasObject[] = [
      {
        id: '1',
        type: 'image',
        x: 50,
        y: 80,
        width: 300,
        height: 200,
        opacity: 1,
        rotation: 0,
        flipH: false,
        flipV: false,
        groupId: null,
        assetId: 'a1',
      },
    ];

    const vp: ViewportState = {
      ...DEFAULT_VIEWPORT,
      workMode: 'standard',
      canvasMode: 'auto',
    };

    const stage = computeCanvasSize(objects, vp);
    expect(stage.x).toBe(50);
    expect(stage.y).toBe(80);
    expect(stage.width).toBe(300);
    expect(stage.height).toBe(200);
  });
});
