import { useSceneStore } from '../store/sceneStore';
import { drawScene } from './drawScene';
import {
  drawOverlay,
  getObjectResizeHandles,
  type OverlayState,
  type ResizeHandleType,
} from './drawOverlay';
import { pointInObject } from '../lib/geometry';
import type { CanvasObject, Point } from '../types/scene';
import { assetCache } from './assetCache';
import { computeCanvasSize } from '../framing/canvasSize';

export interface RendererOptions {
  container: HTMLDivElement;
  sceneCanvas: HTMLCanvasElement;
  overlayCanvas: HTMLCanvasElement;
  getOverlayState: () => OverlayState;
}

export interface Renderer {
  requestRenderScene: () => void;
  requestRenderOverlay: () => void;
  hitTest: (worldPt: Point) => CanvasObject | null;
  hitTestHandle: (
    worldPt: Point,
    zoom: number
  ) => { obj: CanvasObject; handle: ResizeHandleType; cursor: string } | null;
  screenToWorld: (screenX: number, screenY: number) => Point;
  worldToScreen: (worldX: number, worldY: number) => Point;
  destroy: () => void;
}

export function createRenderer({
  container,
  sceneCanvas,
  overlayCanvas,
  getOverlayState,
}: RendererOptions): Renderer {
  const sceneCtx = sceneCanvas.getContext('2d', { alpha: true });
  const overlayCtx = overlayCanvas.getContext('2d', { alpha: true });

  let sceneDirty = true;
  let overlayDirty = true;
  let animFrameId: number | null = null;
  let isDestroyed = false;

  let width = container.clientWidth || 800;
  let height = container.clientHeight || 600;
  let dpr = window.devicePixelRatio || 1;

  const updateSize = () => {
    width = container.clientWidth || 800;
    height = container.clientHeight || 600;
    dpr = window.devicePixelRatio || 1;

    if (sceneCanvas.width !== Math.round(width * dpr)) {
      sceneCanvas.width = Math.round(width * dpr);
      sceneCanvas.height = Math.round(height * dpr);
      sceneCanvas.style.width = `${width}px`;
      sceneCanvas.style.height = `${height}px`;
      sceneDirty = true;
    }

    if (overlayCanvas.width !== Math.round(width * dpr)) {
      overlayCanvas.width = Math.round(width * dpr);
      overlayCanvas.height = Math.round(height * dpr);
      overlayCanvas.style.width = `${width}px`;
      overlayCanvas.style.height = `${height}px`;
      overlayDirty = true;
    }
  };

  const getViewport = () => useSceneStore.getState().viewport;

  const getCamera = () => {
    const vp = getViewport();
    if (vp.workMode === 'unlimited') {
      return { panX: vp.ulPanX, panY: vp.ulPanY, zoom: vp.ulZoom };
    }
    const state = useSceneStore.getState();
    const stage = computeCanvasSize(state.objects, vp, state.settings);
    const stageCenterX = stage.x + stage.width / 2;
    const stageCenterY = stage.y + stage.height / 2;
    return {
      panX: width / 2 - stageCenterX * vp.zoomLevel + (vp.renderOffsetX || 0),
      panY: height / 2 - stageCenterY * vp.zoomLevel + (vp.renderOffsetY || 0),
      zoom: vp.zoomLevel,
    };
  };

  const screenToWorld = (screenX: number, screenY: number): Point => {
    const { panX, panY, zoom } = getCamera();
    return {
      x: (screenX - panX) / zoom,
      y: (screenY - panY) / zoom,
    };
  };

  const worldToScreen = (worldX: number, worldY: number): Point => {
    const { panX, panY, zoom } = getCamera();
    return {
      x: worldX * zoom + panX,
      y: worldY * zoom + panY,
    };
  };

  const render = () => {
    if (isDestroyed) return;

    const { panX, panY, zoom } = getCamera();
    const state = useSceneStore.getState();
    const isFraming = state.viewport.workMode === 'standard';
    const stage = isFraming ? computeCanvasSize(state.objects, state.viewport, state.settings) : undefined;

    // Redraw Scene Layer
    if (sceneDirty && sceneCtx) {
      sceneCtx.setTransform(1, 0, 0, 1, 0, 0);
      sceneCtx.clearRect(0, 0, sceneCanvas.width, sceneCanvas.height);

      // Apply DPR and Camera Transform
      sceneCtx.setTransform(dpr * zoom, 0, 0, dpr * zoom, dpr * panX, dpr * panY);

      // Compute visible world rect for culling
      const topLeft = screenToWorld(0, 0);
      const botRight = screenToWorld(width, height);
      const clipRect = {
        x: topLeft.x - 50,
        y: topLeft.y - 50,
        width: botRight.x - topLeft.x + 100,
        height: botRight.y - topLeft.y + 100,
      };

      drawScene(sceneCtx, state.objects, {
        clipRect,
        stageBounds: stage,
        dimExterior: isFraming,
        background: isFraming ? state.settings.bgColor : undefined,
        transparentBg: isFraming ? state.settings.transparentBg : undefined,
      });
      sceneDirty = false;
    }

    // Redraw Interactive Overlay Layer
    if (overlayDirty && overlayCtx) {
      overlayCtx.setTransform(1, 0, 0, 1, 0, 0);
      overlayCtx.clearRect(0, 0, overlayCanvas.width, overlayCanvas.height);

      overlayCtx.setTransform(dpr * zoom, 0, 0, dpr * zoom, dpr * panX, dpr * panY);

      const overlay = getOverlayState();
      drawOverlay(overlayCtx, state.objects, overlay, state.viewport, zoom, state.settings);
      overlayDirty = false;
    }

    animFrameId = requestAnimationFrame(render);
  };

  // Subscribe to store updates
  const unsubscribeStore = useSceneStore.subscribe((curr, prev) => {
    if (
      curr.objects !== prev.objects ||
      curr.viewport.ulPanX !== prev.viewport.ulPanX ||
      curr.viewport.ulPanY !== prev.viewport.ulPanY ||
      curr.viewport.ulZoom !== prev.viewport.ulZoom ||
      curr.viewport.zoomLevel !== prev.viewport.zoomLevel ||
      curr.viewport.workMode !== prev.viewport.workMode
    ) {
      sceneDirty = true;
    }
    overlayDirty = true;
  });

  // Subscribe to decoded asset ready events
  const unsubscribeAssets = assetCache.subscribe(() => {
    sceneDirty = true;
  });

  // Resize observer
  const resizeObserver = new ResizeObserver(() => {
    updateSize();
  });
  resizeObserver.observe(container);

  updateSize();
  animFrameId = requestAnimationFrame(render);

  const hitTest = (worldPt: Point): CanvasObject | null => {
    const objects = useSceneStore.getState().objects;
    // Iterate in reverse (front to back)
    for (let i = objects.length - 1; i >= 0; i--) {
      const obj = objects[i];
      if (pointInObject(worldPt, obj)) {
        return obj;
      }
    }
    return null;
  };

  const hitTestHandle = (
    worldPt: Point,
    zoom: number
  ): { obj: CanvasObject; handle: ResizeHandleType; cursor: string } | null => {
    const state = useSceneStore.getState();
    if (state.selection.length !== 1) return null;

    const obj = state.objects.find((o) => o.id === state.selection[0]);
    if (!obj) return null;

    const handles = getObjectResizeHandles(obj, zoom);
    const hitRadius = Math.max(8, 10 / zoom);

    for (const h of handles) {
      const dist = Math.hypot(worldPt.x - h.x, worldPt.y - h.y);
      if (dist <= hitRadius) {
        return { obj, handle: h.type, cursor: h.cursor };
      }
    }
    return null;
  };

  return {
    requestRenderScene: () => {
      sceneDirty = true;
    },
    requestRenderOverlay: () => {
      overlayDirty = true;
    },
    hitTest,
    hitTestHandle,
    screenToWorld,
    worldToScreen,
    destroy: () => {
      isDestroyed = true;
      if (animFrameId) cancelAnimationFrame(animFrameId);
      unsubscribeStore();
      unsubscribeAssets();
      resizeObserver.disconnect();
    },
  };
}
