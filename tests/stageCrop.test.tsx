// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import type { OverlayState } from '../src/canvas/drawOverlay';

const drawOverlaySpy = vi.fn();
vi.mock('../src/canvas/drawOverlay', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../src/canvas/drawOverlay')>();
  return { ...actual, drawOverlay: (...args: unknown[]) => drawOverlaySpy(...args) };
});
vi.mock('../src/canvas/drawScene', () => ({ drawScene: vi.fn() }));

import { Stage } from '../src/canvas/Stage';
import { useSceneStore } from '../src/store/sceneStore';
import type { ImageObject } from '../src/types/scene';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const img: ImageObject = {
  id: 'img-1',
  type: 'image',
  assetId: 'asset-1',
  x: 0,
  y: 0,
  width: 400,
  height: 300,
  origWidth: 400,
  origHeight: 300,
  mimeType: 'image/png',
  groupId: null,
  opacity: 1,
  rotation: 0,
  flipH: false,
  flipV: false,
};

let frameCbs: FrameRequestCallback[] = [];
const flushFrames = (n = 2) => {
  for (let i = 0; i < n; i++) {
    const cbs = frameCbs;
    frameCbs = [];
    cbs.forEach((cb) => cb(performance.now()));
  }
};
const lastOverlay = (): OverlayState => drawOverlaySpy.mock.calls.at(-1)![2] as OverlayState;

describe('Stage crop interactions (integration)', () => {
  let host: HTMLDivElement;
  let root: Root;

  const pointer = (type: string, x: number, y: number, buttons = 1) => {
    const container = host.firstElementChild as HTMLElement;
    const ev = new MouseEvent(type, { bubbles: true, clientX: x, clientY: y, button: 0, buttons });
    act(() => {
      container.dispatchEvent(ev);
    });
    flushFrames();
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
    HTMLElement.prototype.setPointerCapture = vi.fn();
    HTMLElement.prototype.releasePointerCapture = vi.fn();

    const store = useSceneStore.getState();
    store.resetScene();
    store.setWorkMode('unlimited');
    store.setPan(0, 0);
    store.setZoom(1);
    store.addObject(img);

    host = document.createElement('div');
    document.body.appendChild(host);
    root = createRoot(host);
    act(() => root.render(<Stage />));
    flushFrames();
  });

  afterEach(() => {
    act(() => root.unmount());
    host.remove();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('rectangular crop: dragging over the image shows a crop rect', () => {
    act(() => useSceneStore.getState().setToolMode('crop_rect'));
    flushFrames();

    pointer('pointerdown', 50, 40);
    pointer('pointermove', 150, 120);
    pointer('pointermove', 250, 200);

    expect(lastOverlay().cropRect).toEqual({ x: 50, y: 40, width: 200, height: 160 });

    pointer('pointerup', 250, 200, 0);
    // Rect stays visible after releasing so the user can apply it
    expect(lastOverlay().cropRect).toEqual({ x: 50, y: 40, width: 200, height: 160 });
  });

  it('rectangular crop: targets the image under the cursor, not just the first image', () => {
    const second: ImageObject = { ...img, id: 'img-2', x: 600, y: 0 };
    act(() => useSceneStore.getState().addObject(second));
    act(() => useSceneStore.getState().setSelection([]));
    act(() => useSceneStore.getState().setToolMode('crop_rect'));
    flushFrames();

    pointer('pointerdown', 650, 40);
    pointer('pointermove', 850, 200);

    expect(lastOverlay().cropRect).toEqual({ x: 650, y: 40, width: 200, height: 160 });
    expect(lastOverlay().cropTargetId).toBe('img-2');
  });

  it('pressing C activates the crop tool', async () => {
    const { SHORTCUTS } = await import('../src/input/shortcuts');
    const sc = SHORTCUTS.find((s) => s.key === 'c' && !s.ctrlOrMeta && !s.shift && !s.alt);
    expect(sc).toBeDefined();
    act(() => sc!.action(new KeyboardEvent('keydown', { key: 'c' })));
    expect(useSceneStore.getState().tool.mode).toBe('crop_rect');
  });

  it('freeform crop: releasing the mouse finishes the lasso; hovering afterwards does not extend it', () => {
    act(() => useSceneStore.getState().setToolMode('crop_freeform'));
    flushFrames();

    pointer('pointerdown', 50, 50);
    pointer('pointermove', 150, 50);
    pointer('pointermove', 150, 150);
    pointer('pointermove', 50, 150);
    pointer('pointerup', 50, 150, 0);

    const closed = lastOverlay().lassoPoints!;
    expect(closed.length).toBeGreaterThanOrEqual(3);

    // Hover (no buttons held) must not mutate the finished lasso
    pointer('pointermove', 300, 250, 0);
    pointer('pointermove', 350, 280, 0);
    expect(lastOverlay().lassoPoints).toEqual(closed);
  });
});
