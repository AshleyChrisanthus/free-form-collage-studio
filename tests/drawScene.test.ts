import { describe, it, expect, vi } from 'vitest';
import { drawScene } from '../src/canvas/drawScene';
import { isImage, isLine } from '../src/types/guards';
import type { ImageObject, LineObject } from '../src/types/scene';

describe('drawScene and Type Guards', () => {
  it('correctly distinguishes ImageObject and LineObject with type guards', () => {
    const img: ImageObject = {
      id: 'i1',
      type: 'image',
      assetId: 'a1',
      x: 0,
      y: 0,
      width: 100,
      height: 100,
      origWidth: 100,
      origHeight: 100,
      mimeType: 'image/png',
      groupId: null,
      opacity: 1,
      rotation: 0,
      flipH: false,
      flipV: false,
    };

    const line: LineObject = {
      id: 'l1',
      type: 'line',
      points: [
        { x: 0, y: 0 },
        { x: 50, y: 50 },
      ],
      strokeColor: '#000000',
      strokeWidth: 2,
      strokeStyle: 'solid',
      roughness: 0,
      roughSeed: 123,
      lineType: 'straight',
      startArrowhead: 'none',
      endArrowhead: 'arrow',
      startBinding: null,
      endBinding: null,
      groupId: null,
      opacity: 1,
      rotation: 0,
      flipH: false,
      flipV: false,
      x: 0,
      y: 0,
      width: 50,
      height: 50,
    };

    expect(isImage(img)).toBe(true);
    expect(isLine(img)).toBe(false);
    expect(isLine(line)).toBe(true);
    expect(isImage(line)).toBe(false);
  });

  it('runs drawScene without error on mixed object scene', () => {
    // Mock canvas context 2D
    const ctx = {
      save: vi.fn(),
      restore: vi.fn(),
      translate: vi.fn(),
      rotate: vi.fn(),
      scale: vi.fn(),
      fillRect: vi.fn(),
      strokeRect: vi.fn(),
      beginPath: vi.fn(),
      moveTo: vi.fn(),
      lineTo: vi.fn(),
      stroke: vi.fn(),
      fill: vi.fn(),
      setLineDash: vi.fn(),
      quadraticCurveTo: vi.fn(),
      arc: vi.fn(),
      closePath: vi.fn(),
      drawImage: vi.fn(),
      globalAlpha: 1,
      strokeStyle: '#000000',
      fillStyle: '#000000',
      lineWidth: 1,
    } as unknown as CanvasRenderingContext2D;

    const img: ImageObject = {
      id: 'i1',
      type: 'image',
      assetId: 'a1',
      x: 10,
      y: 10,
      width: 100,
      height: 100,
      origWidth: 100,
      origHeight: 100,
      mimeType: 'image/png',
      groupId: null,
      opacity: 0.8,
      rotation: 45,
      flipH: true,
      flipV: false,
    };

    const line: LineObject = {
      id: 'l1',
      type: 'line',
      points: [
        { x: 0, y: 0 },
        { x: 50, y: 50 },
      ],
      strokeColor: '#3b82f6',
      strokeWidth: 3,
      strokeStyle: 'dashed',
      roughness: 0,
      roughSeed: 456,
      lineType: 'straight',
      startArrowhead: 'none',
      endArrowhead: 'triangle',
      startBinding: null,
      endBinding: null,
      groupId: null,
      opacity: 1,
      rotation: 0,
      flipH: false,
      flipV: false,
      x: 0,
      y: 0,
      width: 50,
      height: 50,
    };

    expect(() => {
      drawScene(ctx, [img, line], { background: '#ffffff' });
    }).not.toThrow();

    expect(ctx.save).toHaveBeenCalled();
    expect(ctx.restore).toHaveBeenCalled();
  });
});
