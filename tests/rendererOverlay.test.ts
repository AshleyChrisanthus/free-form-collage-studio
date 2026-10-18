import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { OverlayState } from '../src/canvas/drawOverlay';

const drawOverlaySpy = vi.fn();
vi.mock('../src/canvas/drawOverlay', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../src/canvas/drawOverlay')>();
  return { ...actual, drawOverlay: (...args: unknown[]) => drawOverlaySpy(...args) };
});
vi.mock('../src/canvas/drawScene', () => ({ drawScene: vi.fn() }));

import { createRenderer } from '../src/canvas/renderer';

const emptyOverlay = (): OverlayState => ({
  selection: [],
  marquee: null,
  guidelines: [],
  hoveredBinding: null,
  cropRect: null,
  lassoPoints: null,
});

describe('renderer overlay wiring (marching ants)', () => {
  let frameCbs: FrameRequestCallback[] = [];

  const stepFrame = () => {
    const cbs = frameCbs;
    frameCbs = [];
    cbs.forEach((cb) => cb(performance.now()));
  };

  beforeEach(() => {
    drawOverlaySpy.mockClear();
    frameCbs = [];
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
      frameCbs.push(cb);
      return frameCbs.length;
    });
    vi.stubGlobal('cancelAnimationFrame', vi.fn());
    vi.stubGlobal(
      'ResizeObserver',
      class {
        observe() {}
        disconnect() {}
        unobserve() {}
      }
    );
    const fakeCtx = new Proxy({}, { get: () => vi.fn() });
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(
      fakeCtx as unknown as CanvasRenderingContext2D
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  const setup = (getOverlayState: () => OverlayState) =>
    createRenderer({
      container: document.createElement('div'),
      sceneCanvas: document.createElement('canvas'),
      overlayCanvas: document.createElement('canvas'),
      getOverlayState,
    });

  it('re-reads the overlay getter every frame so live marquee updates are drawn', () => {
    let current = emptyOverlay();
    const renderer = setup(() => current);

    stepFrame();
    current = { ...emptyOverlay(), marquee: { x: 1, y: 2, width: 30, height: 40 } };
    renderer.requestRenderOverlay();
    stepFrame();

    const lastCall = drawOverlaySpy.mock.calls.at(-1)!;
    expect((lastCall[2] as OverlayState).marquee).toEqual({ x: 1, y: 2, width: 30, height: 40 });
    renderer.destroy();
  });

  it('keeps redrawing with an advancing dash offset while something is selected', () => {
    const renderer = setup(() => ({ ...emptyOverlay(), selection: ['a'] }));
    const nowSpy = vi.spyOn(performance, 'now');

    nowSpy.mockReturnValue(0);
    stepFrame();
    nowSpy.mockReturnValue(200);
    stepFrame();

    const offsets = drawOverlaySpy.mock.calls.map((c) => c[6] as number);
    expect(offsets.length).toBeGreaterThanOrEqual(2);
    expect(offsets.at(-1)).not.toBe(offsets[0]);
    renderer.destroy();
  });

  it('stops redrawing the overlay when idle (no selection / marquee / crop)', () => {
    const renderer = setup(() => emptyOverlay());
    stepFrame();
    const callsAfterFirst = drawOverlaySpy.mock.calls.length;
    stepFrame();
    stepFrame();
    expect(drawOverlaySpy.mock.calls.length).toBe(callsAfterFirst);
    renderer.destroy();
  });
});
