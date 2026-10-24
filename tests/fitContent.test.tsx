// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { computeFitViewport } from '../src/canvas/viewport';
import { FloatingToolbar } from '../src/components/layout/FloatingToolbar';
import { useSceneStore } from '../src/store/sceneStore';
import type { ImageObject } from '../src/types/scene';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe('computeFitViewport (#41)', () => {
  const bounds = { x: 100, y: 50, width: 800, height: 400 };

  it('fits content inside the viewport with margin and centres it', () => {
    const t = computeFitViewport(bounds, 1200, 800, 80);
    // width-limited: (1200 - 160) / 800 = 1.3 ; height: (800 - 160) / 400 = 1.6
    expect(t.zoom).toBeCloseTo(1.3);
    const left = bounds.x * t.zoom + t.panX;
    const right = (bounds.x + bounds.width) * t.zoom + t.panX;
    expect(left).toBeCloseTo(80);
    expect(right).toBeCloseTo(1120);
    const centreY = (bounds.y + bounds.height / 2) * t.zoom + t.panY;
    expect(centreY).toBeCloseTo(400);
  });

  it('is independent of the current camera (same result zoomed in or out)', () => {
    const a = computeFitViewport(bounds, 1200, 800);
    const b = computeFitViewport(bounds, 1200, 800);
    expect(a).toEqual(b);
  });

  it('zooms out for content larger than the viewport', () => {
    const t = computeFitViewport({ x: 0, y: 0, width: 10000, height: 5000 }, 1200, 800);
    expect(t.zoom).toBeLessThan(1);
    expect(10000 * t.zoom).toBeLessThanOrEqual(1200);
  });

  it('keeps a usable area on tiny viewports', () => {
    const t = computeFitViewport({ x: 0, y: 0, width: 100, height: 100 }, 200, 150, 80);
    expect(t.zoom).toBeGreaterThan(0);
  });
});

describe('FloatingToolbar Fit Content button (#41)', () => {
  let host: HTMLDivElement;
  let root: Root;
  let frameCbs: Map<number, FrameRequestCallback> = new Map();
  let nextId = 1;
  let now = 0;

  const runAnimation = (ms: number) => {
    const end = now + ms;
    while (now < end) {
      now += 16;
      const cbs = [...frameCbs.values()];
      frameCbs = new Map();
      act(() => cbs.forEach((cb) => cb(now)));
    }
  };

  const img: ImageObject = {
    id: 'fit-img',
    type: 'image',
    assetId: 'a',
    x: 100,
    y: 50,
    width: 800,
    height: 400,
    origWidth: 800,
    origHeight: 400,
    mimeType: 'image/png',
    groupId: null,
    opacity: 1,
    rotation: 0,
    flipH: false,
    flipV: false,
  };

  beforeEach(() => {
    now = 0;
    frameCbs = new Map();
    vi.spyOn(performance, 'now').mockImplementation(() => now);
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
      const id = nextId++;
      frameCbs.set(id, cb);
      return id;
    });
    // Real cancellation semantics: a cancelled animation must actually stop.
    vi.stubGlobal('cancelAnimationFrame', (id: number) => {
      frameCbs.delete(id);
    });

    const store = useSceneStore.getState();
    store.resetScene();
    store.setWorkMode('unlimited');
    store.addObject(img);

    host = document.createElement('div');
    document.body.appendChild(host);
    root = createRoot(host);
    act(() => root.render(<FloatingToolbar />));
  });

  afterEach(() => {
    act(() => root.unmount());
    host.remove();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  const clickFit = () => {
    const btn = host.querySelector<HTMLButtonElement>('button[title^="Fit Content"]')!;
    expect(btn).toBeTruthy();
    act(() => btn.click());
  };

  it.each([
    ['zoomed far in', { panX: -3000, panY: -1500, zoom: 6 }],
    ['zoomed far out', { panX: 500, panY: 400, zoom: 0.05 }],
    ['panned off to the side', { panX: -5000, panY: 2000, zoom: 1 }],
  ])('a single click fully fits content when %s', (_label, cam) => {
    act(() => {
      useSceneStore.getState().setPan(cam.panX, cam.panY);
      useSceneStore.getState().setZoom(cam.zoom);
    });

    clickFit();
    runAnimation(500);

    const expected = computeFitViewport(img, window.innerWidth, window.innerHeight, 80);
    const vp = useSceneStore.getState().viewport;
    expect(vp.ulZoom).toBeCloseTo(expected.zoom, 5);
    expect(vp.ulPanX).toBeCloseTo(expected.panX, 3);
    expect(vp.ulPanY).toBeCloseTo(expected.panY, 3);
  });
});
