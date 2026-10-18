import { describe, it, expect, vi } from 'vitest';
import { drawOverlay, type OverlayState } from '../src/canvas/drawOverlay';
import type { ImageObject, ViewportState } from '../src/types/scene';

describe('drawOverlay dotted / marching ants outlines', () => {
  const mockCtx = () => {
    return {
      save: vi.fn(),
      restore: vi.fn(),
      translate: vi.fn(),
      rotate: vi.fn(),
      beginPath: vi.fn(),
      moveTo: vi.fn(),
      lineTo: vi.fn(),
      arc: vi.fn(),
      rect: vi.fn(),
      strokeRect: vi.fn(),
      fillRect: vi.fn(),
      stroke: vi.fn(),
      fill: vi.fn(),
      setLineDash: vi.fn(),
      setTransform: vi.fn(),
      clearRect: vi.fn(),
      strokeStyle: '',
      fillStyle: '',
      lineWidth: 1,
      lineDashOffset: 0,
    } as unknown as CanvasRenderingContext2D;
  };

  const sampleObj: ImageObject = {
    id: 'obj-1',
    type: 'image',
    assetId: 'a1',
    x: 100,
    y: 100,
    width: 200,
    height: 150,
    origWidth: 200,
    origHeight: 150,
    mimeType: 'image/png',
    groupId: null,
    opacity: 1,
    rotation: 0,
    flipH: false,
    flipV: false,
  };

  const vp: ViewportState = {
    zoomLevel: 1,
    canvasLocked: false,
    workMode: 'unlimited',
    ulPanX: 0,
    ulPanY: 0,
    ulZoom: 1,
  };

  it('sets dashed lineDash and lineDashOffset on selected objects', () => {
    const ctx = mockCtx();
    const overlay: OverlayState = {
      selection: ['obj-1'],
      marquee: null,
      guidelines: [],
      hoveredBinding: null,
      cropRect: null,
      lassoPoints: null,
    };

    drawOverlay(ctx, [sampleObj], overlay, vp, 1, undefined, 5);

    expect(ctx.setLineDash).toHaveBeenCalledWith([5, 4]);
    expect(ctx.strokeRect).toHaveBeenCalledWith(-100, -75, 200, 150);
    expect(ctx.lineDashOffset).toBe(-5);
  });

  it('draws dashed rectangle and sets dashOffset during marquee selection', () => {
    const ctx = mockCtx();
    const overlay: OverlayState = {
      selection: [],
      marquee: { x: 50, y: 50, width: 120, height: 80 },
      guidelines: [],
      hoveredBinding: null,
      cropRect: null,
      lassoPoints: null,
    };

    drawOverlay(ctx, [sampleObj], overlay, vp, 1, undefined, 3);

    expect(ctx.setLineDash).toHaveBeenCalledWith([5, 3]);
    expect(ctx.strokeRect).toHaveBeenCalledWith(50, 50, 120, 80);
    expect(ctx.fillRect).toHaveBeenCalledWith(50, 50, 120, 80);
    expect(ctx.lineDashOffset).toBe(-3);
  });

  it('draws dashed path during freeform lasso selection', () => {
    const ctx = mockCtx();
    const overlay: OverlayState = {
      selection: [],
      marquee: null,
      guidelines: [],
      hoveredBinding: null,
      cropRect: null,
      lassoPoints: [
        { x: 10, y: 10 },
        { x: 50, y: 30 },
        { x: 40, y: 80 },
      ],
    };

    drawOverlay(ctx, [sampleObj], overlay, vp, 1, undefined, 7);

    expect(ctx.setLineDash).toHaveBeenCalledWith([5, 3]);
    expect(ctx.beginPath).toHaveBeenCalled();
    expect(ctx.moveTo).toHaveBeenCalledWith(10, 10);
    expect(ctx.lineTo).toHaveBeenCalledWith(50, 30);
    expect(ctx.lineTo).toHaveBeenCalledWith(40, 80);
    expect(ctx.stroke).toHaveBeenCalled();
    expect(ctx.fill).toHaveBeenCalled();
    expect(ctx.lineDashOffset).toBe(-7);
  });

  it('draws dashed path during magnetic selection live-wire path', () => {
    const ctx = mockCtx();
    const overlay: OverlayState = {
      selection: [],
      marquee: null,
      guidelines: [],
      hoveredBinding: null,
      cropRect: null,
      lassoPoints: null,
      magneticAnchors: [{ x: 10, y: 10 }, { x: 100, y: 100 }, { x: 50, y: 120 }],
      magneticLivePath: [
        { x: 100, y: 100 },
        { x: 110, y: 110 },
        { x: 120, y: 120 },
      ],
    };

    drawOverlay(ctx, [sampleObj], overlay, vp, 1, undefined, 4);

    expect(ctx.setLineDash).toHaveBeenCalledWith([5, 3]);
    expect(ctx.stroke).toHaveBeenCalled();
    expect(ctx.fill).toHaveBeenCalled();
    expect(ctx.lineDashOffset).toBe(-4);
  });

  it('draws dashed rectangle and handles on cropRect', () => {
    const ctx = mockCtx();
    const overlay: OverlayState = {
      selection: [],
      marquee: null,
      guidelines: [],
      hoveredBinding: null,
      cropRect: { x: 20, y: 20, width: 80, height: 60 },
      lassoPoints: null,
    };

    drawOverlay(ctx, [sampleObj], overlay, vp, 1, undefined, 6);

    expect(ctx.setLineDash).toHaveBeenCalledWith([6, 4]);
    expect(ctx.strokeRect).toHaveBeenCalledWith(20, 20, 80, 60);
    expect(ctx.lineDashOffset).toBe(-6);
  });
});
