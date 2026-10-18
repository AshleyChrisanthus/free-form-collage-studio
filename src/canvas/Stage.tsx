import { useEffect, useRef, useState } from 'react';
import { useSceneStore } from '../store/sceneStore';
import { createRenderer, type Renderer } from './renderer';
import type { OverlayState } from './drawOverlay';
import {
  createInitialPointerState,
  type PointerMachineState,
} from '../input/pointerMachine';
import type { Point, BoundingBox, LineObject } from '../types/scene';
import { generateId } from '../lib/id';
import { lineBounds, unionBounds } from '../lib/geometry';
import {
  computeCursorZoom,
  clampFramingZoom,
} from './viewport';
import { ingestFiles, pasteFromClipboard } from '../import/ingest';
import {
  precomputeSnapLines,
  snapMove,
  snapResize,
  type CandidateLines,
  type SnapGuide,
} from '../snapping/snap';
import { computeResize, computeMultiResize } from './transforms';
import { ContextMenu } from '../components/canvas/ContextMenu';
import { Upload } from 'lucide-react';
import { isImage } from '../types/guards';
import type { ImageObject } from '../types/scene';
import { worldToLocal, localToWorld, clampRectToImage } from '../crop/geometry';
import { applyCrop } from '../crop/applyCrop';
import {
  initScissorsSession,
  findScissorsPath,
  snapAnchorPoint,
  smoothLassoPolygon,
  type IntelligentScissorsSession,
} from '../crop/scissors';
import { getImageDataFromAsset } from '../ai/bgRemoval';

export function Stage() {
  const containerRef = useRef<HTMLDivElement>(null);
  const sceneCanvasRef = useRef<HTMLCanvasElement>(null);
  const overlayCanvasRef = useRef<HTMLCanvasElement>(null);
  const rendererRef = useRef<Renderer | null>(null);
  const isSpacePressedRef = useRef<boolean>(false);

  const [overlayState, setOverlayState] = useState<OverlayState>({
    selection: [],
    marquee: null,
    guidelines: [],
    hoveredBinding: null,
    cropRect: null,
    cropTargetId: null,
    lassoPoints: null,
    magneticAnchors: null,
    magneticLivePath: null,
  });

  const cropSessionRef = useRef<{
    targetId: string | null;
    rectStartLocal: Point | null;
    rectCurrentLocal: BoundingBox | null;
    freeformPointsLocal: Point[];
    magneticSession: IntelligentScissorsSession | null;
    magneticAnchorsLocal: Point[];
    magneticRadius: number;
  }>({
    targetId: null,
    rectStartLocal: null,
    rectCurrentLocal: null,
    freeformPointsLocal: [],
    magneticSession: null,
    magneticAnchorsLocal: [],
    magneticRadius: 8,
  });

  const pointerStateRef = useRef<PointerMachineState>(createInitialPointerState());
  const [cursor, setCursor] = useState<string>('default');
  const [isDragOver, setIsDragOver] = useState(false);
  const [contextMenu, setContextMenu] = useState<{
    isOpen: boolean;
    x: number;
    y: number;
  }>({ isOpen: false, x: 0, y: 0 });
  const snapCandidatesRef = useRef<CandidateLines | null>(null);

  const workMode = useSceneStore((state) => state.viewport.workMode);
  const unlimitedTheme = useSceneStore((state) => state.viewport.unlimitedTheme);
  const ulZoom = useSceneStore((state) => state.viewport.ulZoom);
  const ulPanX = useSceneStore((state) => state.viewport.ulPanX);
  const ulPanY = useSceneStore((state) => state.viewport.ulPanY);
  const zoomLevel = useSceneStore((state) => state.viewport.zoomLevel);
  const renderOffsetX = useSceneStore((state) => state.viewport.renderOffsetX);
  const renderOffsetY = useSceneStore((state) => state.viewport.renderOffsetY);
  const selection = useSceneStore((state) => state.selection);

  // Keep overlay state in sync with store selection
  useEffect(() => {
    setOverlayState((prev) => ({ ...prev, selection }));
  }, [selection]);

  // Initialize renderer
  useEffect(() => {
    if (!containerRef.current || !sceneCanvasRef.current || !overlayCanvasRef.current) {
      return;
    }

    const renderer = createRenderer({
      container: containerRef.current,
      sceneCanvas: sceneCanvasRef.current,
      overlayCanvas: overlayCanvasRef.current,
      getOverlayState: () => overlayState,
    });

    rendererRef.current = renderer;

    return () => {
      renderer.destroy();
      rendererRef.current = null;
    };
  }, []);

  // Sync overlay changes to renderer
  useEffect(() => {
    rendererRef.current?.requestRenderOverlay();
  }, [overlayState]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space' && !e.repeat) {
        const target = e.target as HTMLElement | null;
        if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) return;
        isSpacePressedRef.current = true;
        if (pointerStateRef.current.mode === 'idle') {
          setCursor('grab');
        }
      }
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        isSpacePressedRef.current = false;
        if (pointerStateRef.current.mode === 'idle') {
          const store = useSceneStore.getState();
          setCursor(store.tool.mode === 'pan' ? 'grab' : 'default');
        }
      }
    };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, []);

  // Global paste handler for image ingestion
  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      const activeEl = document.activeElement;
      if (
        activeEl &&
        (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA' || (activeEl as HTMLElement).isContentEditable)
      ) {
        return;
      }
      void pasteFromClipboard(e);
    };

    window.addEventListener('paste', handlePaste);
    return () => {
      window.removeEventListener('paste', handlePaste);
    };
  }, []);

  const toolMode = useSceneStore((state) => state.tool.mode);

  // Sync crop session when entering or leaving crop modes
  useEffect(() => {
    const isCropMode =
      toolMode === 'crop_rect' ||
      toolMode === 'crop_freeform' ||
      toolMode === 'crop_magnetic';

    if (!isCropMode) {
      cropSessionRef.current = {
        targetId: null,
        rectStartLocal: null,
        rectCurrentLocal: null,
        freeformPointsLocal: [],
        magneticSession: null,
        magneticAnchorsLocal: [],
        magneticRadius: 8,
      };
      setOverlayState((prev) => ({
        ...prev,
        cropRect: null,
        cropTargetId: null,
        lassoPoints: null,
        magneticAnchors: null,
        magneticLivePath: null,
      }));
      return;
    }

    const store = useSceneStore.getState();
    let target = store.objects.find(
      (o) => store.selection.includes(o.id) && isImage(o)
    ) as ImageObject | undefined;

    if (!target) {
      target = store.objects.find((o) => isImage(o)) as ImageObject | undefined;
      if (target) {
        store.setSelection([target.id]);
      }
    }

    if (!target) {
      store.showToast('Please import or select an image to crop', 'info');
      store.setToolMode('select');
      return;
    }

    cropSessionRef.current.targetId = target.id;
    setOverlayState((prev) => ({ ...prev, cropTargetId: target!.id }));

    if (toolMode === 'crop_magnetic') {
      void (async () => {
        try {
          const imgData = await getImageDataFromAsset(
            target!.assetId,
            target!.origWidth,
            target!.origHeight
          );
          if (imgData) {
            cropSessionRef.current.magneticSession = initScissorsSession(imgData);
          }
        } catch (err) {
          console.warn('Failed to init magnetic scissors session:', err);
        }
      })();
    }
  }, [toolMode]);

  // Crop Action and Radius Event Listeners
  useEffect(() => {
    const onCropAction = async (e: Event) => {
      const customEvent = e as CustomEvent<{ action: 'crop' | 'duplicate' | 'cut' }>;
      const action = customEvent.detail?.action;
      if (!action) return;

      const store = useSceneStore.getState();
      const targetId = cropSessionRef.current.targetId;
      if (!targetId) return;

      const target = store.objects.find((o) => o.id === targetId && isImage(o)) as
        | ImageObject
        | undefined;
      if (!target) return;

      let polygon: Point[] = [];
      const mode = store.tool.mode;

      if (mode === 'crop_rect' && cropSessionRef.current.rectCurrentLocal) {
        const { x, y, width, height } = cropSessionRef.current.rectCurrentLocal;
        polygon = [
          { x, y },
          { x: x + width, y },
          { x: x + width, y: y + height },
          { x, y: y + height },
        ];
      } else if (
        (mode === 'crop_freeform' || mode === 'crop_magnetic') &&
        cropSessionRef.current.freeformPointsLocal.length >= 3
      ) {
        polygon = cropSessionRef.current.freeformPointsLocal;
      } else if (
        mode === 'crop_magnetic' &&
        cropSessionRef.current.magneticAnchorsLocal.length >= 3
      ) {
        polygon = smoothLassoPolygon([
          ...cropSessionRef.current.magneticAnchorsLocal,
          cropSessionRef.current.magneticAnchorsLocal[0],
        ]);
      }

      if (polygon.length < 3) {
        store.showToast('Please define a crop area first', 'info');
        return;
      }

      try {
        await applyCrop(target, polygon, action);
        store.showToast(
          `${action === 'crop' ? 'Image cropped' : action === 'duplicate' ? 'Region duplicated' : 'Region cut'} successfully`,
          'success'
        );
      } catch (err) {
        console.error('Failed to apply crop action:', err);
        store.showToast('Failed to apply crop', 'error');
      }

      store.setToolMode('select');
    };

    const onCropCancel = () => {
      useSceneStore.getState().setToolMode('select');
    };

    const onMagneticRadius = (e: Event) => {
      const customEvent = e as CustomEvent<{ radius: number }>;
      if (customEvent.detail?.radius) {
        cropSessionRef.current.magneticRadius = customEvent.detail.radius;
      }
    };

    window.addEventListener('canvas:crop-action', onCropAction);
    window.addEventListener('canvas:crop-cancel', onCropCancel);
    window.addEventListener('canvas:magnetic-radius', onMagneticRadius);

    return () => {
      window.removeEventListener('canvas:crop-action', onCropAction);
      window.removeEventListener('canvas:crop-cancel', onCropCancel);
      window.removeEventListener('canvas:magnetic-radius', onMagneticRadius);
    };
  }, []);

  // Native non-passive wheel listener for smooth cursor-anchored zoom & trackpad pan
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const onWheelNative = (e: WheelEvent) => {
      e.preventDefault();
      const store = useSceneStore.getState();
      const rect = el.getBoundingClientRect();
      const cursor: Point = { x: e.clientX - rect.left, y: e.clientY - rect.top };

      if (store.viewport.workMode === 'unlimited') {
        // Plain two-finger trackpad scroll (no ctrl, deltaMode 0, has deltaX) pans
        if (!e.ctrlKey && e.deltaMode === 0 && Math.abs(e.deltaX) > 0) {
          store.panBy(-e.deltaX, -e.deltaY);
        } else {
          // Wheel zoom anchored at cursor
          const res = computeCursorZoom(
            store.viewport.ulZoom,
            { x: store.viewport.ulPanX, y: store.viewport.ulPanY },
            cursor,
            e.deltaY,
            e.ctrlKey
          );
          store.setZoom(res.zoom);
          store.setPan(res.panX, res.panY);
        }
      } else {
        // Framing mode zoom
        const factor = Math.exp(-e.deltaY * (e.ctrlKey ? 0.005 : 0.0015));
        store.setFramingZoom(clampFramingZoom(store.viewport.zoomLevel * factor));
      }
    };

    el.addEventListener('wheel', onWheelNative, { passive: false });
    return () => {
      el.removeEventListener('wheel', onWheelNative);
    };
  }, []);

  // Pointer event handlers
  const handlePointerDown = (e: React.PointerEvent) => {
    const renderer = rendererRef.current;
    if (!renderer || !containerRef.current) return;

    (e.target as HTMLElement).setPointerCapture(e.pointerId);

    const rect = containerRef.current.getBoundingClientRect();
    const screenPt: Point = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    const worldPt = renderer.screenToWorld(screenPt.x, screenPt.y);

    const store = useSceneStore.getState();
    const activeTool = store.tool.mode;

    // Middle click or spacebar held initiates panning
    if (e.button === 1 || isSpacePressedRef.current || activeTool === 'pan') {
      pointerStateRef.current = {
        ...createInitialPointerState(),
        mode: 'panning',
        startScreen: screenPt,
        startWorld: worldPt,
        currentScreen: screenPt,
        currentWorld: worldPt,
      };
      setCursor('grabbing');
      return;
    }

    if (e.button !== 0) return; // Only primary button for drawing/selection

    // 0. Crop modes handling
    if (
      activeTool === 'crop_rect' ||
      activeTool === 'crop_freeform' ||
      activeTool === 'crop_magnetic'
    ) {
      const targetId = cropSessionRef.current.targetId;
      const targetObj = store.objects.find(
        (o) => o.id === targetId && isImage(o)
      ) as ImageObject | undefined;
      if (!targetObj) return;

      const localPt = worldToLocal(targetObj, worldPt);

      if (activeTool === 'crop_rect') {
        cropSessionRef.current.rectStartLocal = localPt;
        cropSessionRef.current.rectCurrentLocal = {
          x: localPt.x,
          y: localPt.y,
          width: 0,
          height: 0,
        };
        return;
      }

      if (activeTool === 'crop_freeform') {
        cropSessionRef.current.freeformPointsLocal = [localPt];
        setOverlayState((prev) => ({
          ...prev,
          lassoPoints: [worldPt],
        }));
        return;
      }

      if (activeTool === 'crop_magnetic') {
        let snapped = localPt;
        if (cropSessionRef.current.magneticSession) {
          snapped = snapAnchorPoint(
            cropSessionRef.current.magneticSession,
            localPt,
            cropSessionRef.current.magneticRadius
          );
        }

        const anchors = cropSessionRef.current.magneticAnchorsLocal;

        // Check if user clicked near first anchor to close loop
        if (anchors.length >= 3) {
          const firstWorld = localToWorld(targetObj, anchors[0]);
          const distToFirst = Math.hypot(
            worldPt.x - firstWorld.x,
            worldPt.y - firstWorld.y
          );
          const zoom =
            store.viewport.workMode === 'unlimited'
              ? store.viewport.ulZoom
              : store.viewport.zoomLevel;
          if (distToFirst < 14 / zoom) {
            // Close loop
            const closedLocal = smoothLassoPolygon([...anchors, anchors[0]]);
            cropSessionRef.current.freeformPointsLocal = closedLocal;
            cropSessionRef.current.magneticAnchorsLocal = [];

            setOverlayState((prev) => ({
              ...prev,
              lassoPoints: closedLocal.map((p) => localToWorld(targetObj, p)),
              magneticAnchors: null,
              magneticLivePath: null,
            }));
            return;
          }
        }

        anchors.push(snapped);
        setOverlayState((prev) => ({
          ...prev,
          magneticAnchors: anchors.map((p) => localToWorld(targetObj, p)),
        }));
        return;
      }
    }

    // 1. Line or Arrow drawing
    if (activeTool === 'line' || activeTool === 'arrow') {
      store.beginTransaction(activeTool === 'arrow' ? 'Draw Arrow' : 'Draw Line');
      const newLineId = generateId();
      const newLine: LineObject = {
        id: newLineId,
        type: 'line',
        x: worldPt.x,
        y: worldPt.y,
        width: 1,
        height: 1,
        points: [worldPt, { ...worldPt }],
        strokeColor: store.tool.lineDefaults.strokeColor,
        strokeWidth: store.tool.lineDefaults.strokeWidth,
        strokeStyle: store.tool.lineDefaults.strokeStyle,
        roughness: store.tool.lineDefaults.roughness,
        roughSeed: Math.floor(Math.random() * 100000),
        lineType: store.tool.lineDefaults.lineType,
        startArrowhead: store.tool.lineDefaults.startArrowhead,
        endArrowhead:
          activeTool === 'arrow'
            ? store.tool.lineDefaults.endArrowhead === 'none'
              ? 'arrow'
              : store.tool.lineDefaults.endArrowhead
            : store.tool.lineDefaults.endArrowhead,
        startBinding: null,
        endBinding: null,
        groupId: null,
        opacity: 1,
        rotation: 0,
        flipH: false,
        flipV: false,
      };

      store.addObject(newLine);
      pointerStateRef.current = {
        ...createInitialPointerState(),
        mode: 'drawingLine',
        startScreen: screenPt,
        startWorld: worldPt,
        currentScreen: screenPt,
        currentWorld: worldPt,
        dragTargetIds: [newLineId],
      };
      return;
    }

    // 2. Selection tool
    if (activeTool === 'select') {
      const currentZoom =
        store.viewport.workMode === 'unlimited'
          ? store.viewport.ulZoom
          : store.viewport.zoomLevel;

      // Check for resize / rotation handle hit
      const handleHit = renderer.hitTestHandle(worldPt, currentZoom);
      if (handleHit) {
        store.beginTransaction(
          handleHit.handle === 'rot' ? 'Rotate Object' : 'Resize Object'
        );
        const boxes = new Map<string, BoundingBox & { rotation: number }>();
        if (handleHit.isMulti) {
          boxes.set('__multi__', {
            x: handleHit.obj.x,
            y: handleHit.obj.y,
            width: handleHit.obj.width,
            height: handleHit.obj.height,
            rotation: 0,
          });
          for (const obj of store.objects) {
            if (store.selection.includes(obj.id)) {
              boxes.set(obj.id, {
                x: obj.x,
                y: obj.y,
                width: obj.width,
                height: obj.height,
                rotation: obj.rotation,
              });
            }
          }
        } else {
          boxes.set(handleHit.obj.id, {
            x: handleHit.obj.x,
            y: handleHit.obj.y,
            width: handleHit.obj.width,
            height: handleHit.obj.height,
            rotation: handleHit.obj.rotation,
          });
        }

        snapCandidatesRef.current = precomputeSnapLines(
          store.objects,
          new Set(handleHit.isMulti ? store.selection : [handleHit.obj.id]),
          store.viewport,
          store.settings
        );

        pointerStateRef.current = {
          ...createInitialPointerState(),
          mode: handleHit.handle === 'rot' ? 'rotating' : 'resizing',
          startScreen: screenPt,
          startWorld: worldPt,
          currentScreen: screenPt,
          currentWorld: worldPt,
          activeHandle: handleHit.handle,
          dragTargetIds: handleHit.isMulti ? [...store.selection] : [handleHit.obj.id],
          initialObjectBoxes: boxes,
        };
        setCursor(handleHit.cursor);
        return;
      }

      // Check for object hit
      const objHit = renderer.hitTest(worldPt);
      if (objHit) {
        let targets = store.selection;
        if (e.shiftKey) {
          store.toggleSelection(objHit.id);
          targets = useSceneStore.getState().selection;
        } else if (!store.selection.includes(objHit.id)) {
          store.setSelection([objHit.id]);
          targets = [objHit.id];
        }

        store.beginTransaction('Move Objects');
        const boxes = new Map<string, BoundingBox & { rotation: number }>();
        for (const obj of store.objects) {
          if (targets.includes(obj.id) && !obj.locked) {
            boxes.set(obj.id, {
              x: obj.x,
              y: obj.y,
              width: obj.width,
              height: obj.height,
              rotation: obj.rotation,
            });
          }
        }

        snapCandidatesRef.current = precomputeSnapLines(
          store.objects,
          new Set(targets),
          store.viewport,
          store.settings
        );

        pointerStateRef.current = {
          ...createInitialPointerState(),
          mode: 'dragging',
          startScreen: screenPt,
          startWorld: worldPt,
          currentScreen: screenPt,
          currentWorld: worldPt,
          dragTargetIds: targets,
          initialObjectBoxes: boxes,
        };
        setCursor('move');
        return;
      }

      // Hit empty canvas -> clear selection & start marquee
      if (!e.shiftKey) {
        store.clearSelection();
      }

      pointerStateRef.current = {
        ...createInitialPointerState(),
        mode: 'marquee',
        startScreen: screenPt,
        startWorld: worldPt,
        currentScreen: screenPt,
        currentWorld: worldPt,
      };
      setOverlayState((prev) => ({
        ...prev,
        marquee: { x: worldPt.x, y: worldPt.y, width: 0, height: 0 },
      }));
    }
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    const renderer = rendererRef.current;
    if (!renderer || !containerRef.current) return;

    const rect = containerRef.current.getBoundingClientRect();
    const screenPt: Point = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    const worldPt = renderer.screenToWorld(screenPt.x, screenPt.y);

    const pState = pointerStateRef.current;
    const store = useSceneStore.getState();
    const activeTool = store.tool.mode;

    // 0. Crop modes pointer move
    if (activeTool === 'crop_rect' && cropSessionRef.current.rectStartLocal) {
      const targetId = cropSessionRef.current.targetId;
      const targetObj = store.objects.find(
        (o) => o.id === targetId && isImage(o)
      ) as ImageObject | undefined;
      if (targetObj) {
        const localPt = worldToLocal(targetObj, worldPt);
        const start = cropSessionRef.current.rectStartLocal;
        const minX = Math.min(start.x, localPt.x);
        const minY = Math.min(start.y, localPt.y);
        const w = Math.abs(localPt.x - start.x);
        const h = Math.abs(localPt.y - start.y);
        const clamped = clampRectToImage(
          { x: minX, y: minY, width: w, height: h },
          targetObj.width,
          targetObj.height
        );
        cropSessionRef.current.rectCurrentLocal = clamped;

        const tl = localToWorld(targetObj, { x: clamped.x, y: clamped.y });
        const br = localToWorld(targetObj, {
          x: clamped.x + clamped.width,
          y: clamped.y + clamped.height,
        });
        setOverlayState((prev) => ({
          ...prev,
          cropRect: {
            x: Math.min(tl.x, br.x),
            y: Math.min(tl.y, br.y),
            width: Math.abs(br.x - tl.x),
            height: Math.abs(br.y - tl.y),
          },
        }));
      }
      return;
    }

    if (
      activeTool === 'crop_freeform' &&
      cropSessionRef.current.freeformPointsLocal.length > 0
    ) {
      const targetId = cropSessionRef.current.targetId;
      const targetObj = store.objects.find(
        (o) => o.id === targetId && isImage(o)
      ) as ImageObject | undefined;
      if (targetObj) {
        const localPt = worldToLocal(targetObj, worldPt);
        const pts = cropSessionRef.current.freeformPointsLocal;
        const last = pts[pts.length - 1];
        if (Math.hypot(localPt.x - last.x, localPt.y - last.y) >= 2) {
          pts.push(localPt);
          setOverlayState((prev) => ({
            ...prev,
            lassoPoints: pts.map((p) => localToWorld(targetObj, p)),
          }));
        }
      }
      return;
    }

    if (
      activeTool === 'crop_magnetic' &&
      cropSessionRef.current.magneticAnchorsLocal.length > 0
    ) {
      const targetId = cropSessionRef.current.targetId;
      const targetObj = store.objects.find(
        (o) => o.id === targetId && isImage(o)
      ) as ImageObject | undefined;
      if (targetObj && cropSessionRef.current.magneticSession) {
        const localPt = worldToLocal(targetObj, worldPt);
        const anchors = cropSessionRef.current.magneticAnchorsLocal;
        const lastAnchor = anchors[anchors.length - 1];
        const rawLivePath = findScissorsPath(
          cropSessionRef.current.magneticSession,
          lastAnchor,
          localPt
        );
        setOverlayState((prev) => ({
          ...prev,
          magneticLivePath: rawLivePath.map((p) => localToWorld(targetObj, p)),
        }));
      }
      return;
    }

    // 1. Panning
    if (pState.mode === 'panning') {
      const dx = screenPt.x - pState.currentScreen.x;
      const dy = screenPt.y - pState.currentScreen.y;
      pState.currentScreen = screenPt;
      pState.currentWorld = worldPt;
      store.panBy(dx, dy);
      return;
    }

    // 2. Dragging objects
    if (pState.mode === 'dragging') {
      const isSnap = store.settings.isSnapping && !e.ctrlKey && !e.metaKey;
      const zoom =
        store.viewport.workMode === 'unlimited'
          ? store.viewport.ulZoom
          : store.viewport.zoomLevel;

      let totalDx = worldPt.x - pState.startWorld.x;
      let totalDy = worldPt.y - pState.startWorld.y;

      let guides: SnapGuide[] = [];
      if (isSnap && snapCandidatesRef.current && pState.dragTargetIds.length > 0) {
        const boxes = pState.dragTargetIds
          .map((id) => pState.initialObjectBoxes.get(id))
          .filter(Boolean) as (BoundingBox & { rotation: number })[];
        const union = unionBounds(boxes);
        if (union) {
          const projected = {
            x: union.x + totalDx,
            y: union.y + totalDy,
            width: union.width,
            height: union.height,
          };
          const snap = snapMove(projected, snapCandidatesRef.current, 15 / zoom);
          totalDx += snap.deltaX;
          totalDy += snap.deltaY;
          guides = snap.guides;
        }
      }

      setOverlayState((prev) => ({ ...prev, guidelines: guides }));

      for (const id of pState.dragTargetIds) {
        const init = pState.initialObjectBoxes.get(id);
        const curr = store.objects.find((o) => o.id === id);
        if (init && curr) {
          const shiftX = init.x + totalDx - curr.x;
          const shiftY = init.y + totalDy - curr.y;
          if (shiftX !== 0 || shiftY !== 0) {
            store.moveObjects([id], shiftX, shiftY);
          }
        }
      }
      pState.currentScreen = screenPt;
      pState.currentWorld = worldPt;
      return;
    }

    // 3. Resizing object
    if (pState.mode === 'resizing' && pState.activeHandle) {
      const isMulti = pState.dragTargetIds.length > 1 || pState.initialObjectBoxes.has('__multi__');
      const isCorner = ['tl', 'tr', 'bl', 'br'].includes(pState.activeHandle);
      const preserveAspect = isCorner ? !e.shiftKey : false;
      const fromCenter = e.altKey;

      const dx = worldPt.x - pState.startWorld.x;
      const dy = worldPt.y - pState.startWorld.y;

      const zoom =
        store.viewport.workMode === 'unlimited'
          ? store.viewport.ulZoom
          : store.viewport.zoomLevel;

      if (isMulti) {
        const resizedMap = computeMultiResize(
          pState.initialObjectBoxes,
          pState.dragTargetIds,
          pState.activeHandle,
          dx,
          dy,
          preserveAspect,
          fromCenter
        );
        for (const id of pState.dragTargetIds) {
          const newBox = resizedMap.get(id);
          if (newBox) {
            store.resizeObject(id, newBox);
          }
        }
      } else if (pState.dragTargetIds[0]) {
        const id = pState.dragTargetIds[0];
        const initial = pState.initialObjectBoxes.get(id);
        if (initial) {
          let newBox = computeResize(
            initial,
            pState.activeHandle,
            dx,
            dy,
            preserveAspect,
            fromCenter
          );

          let guides: SnapGuide[] = [];
          const isResizeSnap = store.settings.isResizeSnapping && !e.ctrlKey && !e.metaKey;
          if (isResizeSnap && snapCandidatesRef.current) {
            const snapped = snapResize(
              newBox,
              pState.activeHandle,
              snapCandidatesRef.current,
              15 / zoom
            );
            newBox = snapped.box;
            guides = snapped.guides;
          }

          setOverlayState((prev) => ({ ...prev, guidelines: guides }));
          store.resizeObject(id, newBox);
        }
      }
      return;
    }

    // 4. Rotating object
    if (pState.mode === 'rotating' && pState.dragTargetIds[0]) {
      const id = pState.dragTargetIds[0];
      const initial = pState.initialObjectBoxes.get(id);
      if (initial) {
        const cx = initial.x + initial.width / 2;
        const cy = initial.y + initial.height / 2;
        const angleRad = Math.atan2(worldPt.y - cy, worldPt.x - cx);
        let angleDeg = (angleRad * 180) / Math.PI + 90;
        if (e.shiftKey) {
          angleDeg = Math.round(angleDeg / 15) * 15; // 15° snap
        }
        angleDeg = Math.round(((angleDeg % 360) + 360) % 360);
        store.setRotation(id, angleDeg);
      }
      return;
    }

    // 5. Marquee selection
    if (pState.mode === 'marquee') {
      const minX = Math.min(pState.startWorld.x, worldPt.x);
      const minY = Math.min(pState.startWorld.y, worldPt.y);
      const width = Math.abs(worldPt.x - pState.startWorld.x);
      const height = Math.abs(worldPt.y - pState.startWorld.y);

      const marqueeBox = { x: minX, y: minY, width, height };
      setOverlayState((prev) => ({ ...prev, marquee: marqueeBox }));

      // Select intersected objects
      const intersectedIds: string[] = [];
      for (const obj of store.objects) {
        if (
          obj.x < minX + width &&
          obj.x + obj.width > minX &&
          obj.y < minY + height &&
          obj.y + obj.height > minY
        ) {
          intersectedIds.push(obj.id);
        }
      }
      store.setSelection(intersectedIds);
      return;
    }

    // 6. Drawing line endpoint update
    if (pState.mode === 'drawingLine' && pState.dragTargetIds[0]) {
      const lineId = pState.dragTargetIds[0];
      const obj = store.objects.find((o) => o.id === lineId) as LineObject | undefined;
      if (obj) {
        const points = [obj.points[0], worldPt];
        const bounds = lineBounds(points, obj.strokeWidth);
        store.updateObject(
          lineId,
          {
            points,
            x: bounds.x,
            y: bounds.y,
            width: bounds.width,
            height: bounds.height,
          },
          'Draw Line'
        );
      }
      return;
    }

    // 7. Idle cursor hover detection
    if (pState.mode === 'idle') {
      const currentZoom =
        store.viewport.workMode === 'unlimited'
          ? store.viewport.ulZoom
          : store.viewport.zoomLevel;

      const handleHit = renderer.hitTestHandle(worldPt, currentZoom);
      if (handleHit) {
        setCursor(handleHit.cursor);
        return;
      }

      const objHit = renderer.hitTest(worldPt);
      if (objHit) {
        setCursor('move');
        return;
      }

      setCursor(store.tool.mode === 'pan' ? 'grab' : 'default');
    }
  };

  const handlePointerUp = () => {
    const store = useSceneStore.getState();
    const pState = pointerStateRef.current;
    snapCandidatesRef.current = null;
    setOverlayState((prev) => ({ ...prev, marquee: null, guidelines: [] }));

    const activeTool = store.tool.mode;
    if (activeTool === 'crop_freeform') {
      const targetId = cropSessionRef.current.targetId;
      const targetObj = store.objects.find(
        (o) => o.id === targetId && isImage(o)
      ) as ImageObject | undefined;
      const pts = cropSessionRef.current.freeformPointsLocal;
      if (targetObj && pts.length >= 3) {
        const closed = smoothLassoPolygon([...pts, pts[0]]);
        cropSessionRef.current.freeformPointsLocal = closed;
        setOverlayState((prev) => ({
          ...prev,
          lassoPoints: closed.map((p) => localToWorld(targetObj, p)),
        }));
      }
      return;
    }

    if (activeTool === 'crop_rect') {
      cropSessionRef.current.rectStartLocal = null;
      return;
    }

    if (
      pState.mode === 'dragging' ||
      pState.mode === 'resizing' ||
      pState.mode === 'rotating' ||
      pState.mode === 'drawingLine'
    ) {
      store.commitTransaction();
      if (pState.mode === 'drawingLine' && !store.tool.locked) {
        store.setToolMode('select');
      }
    }

    pointerStateRef.current = createInitialPointerState();
    setCursor(store.tool.mode === 'pan' ? 'grab' : 'default');
  };

  // Calculate adaptive dot grid CSS background
  const isUnlimited = workMode === 'unlimited';
  const isDark = unlimitedTheme === 'dark';
  const dotColor = isDark ? 'rgba(148, 163, 184, 0.35)' : 'rgba(100, 116, 139, 0.4)';
  const bgColor = isUnlimited ? (isDark ? '#020617' : '#f8fafc') : 'var(--surface-sunken, #090d16)';

  let gridSpacing = 40 * (isUnlimited ? ulZoom : zoomLevel);
  while (gridSpacing < 15) gridSpacing *= 2;
  while (gridSpacing > 80) gridSpacing /= 2;

  const panX = isUnlimited ? ulPanX : renderOffsetX;
  const panY = isUnlimited ? ulPanY : renderOffsetY;
  const bgPosX = ((panX % gridSpacing) + gridSpacing) % gridSpacing;
  const bgPosY = ((panY % gridSpacing) + gridSpacing) % gridSpacing;

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!isDragOver) setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const renderer = rendererRef.current;
      const container = containerRef.current;
      let dropWorldPoint: Point | undefined;

      if (renderer && container) {
        const rect = container.getBoundingClientRect();
        dropWorldPoint = renderer.screenToWorld(e.clientX - rect.left, e.clientY - rect.top);
      }

      void ingestFiles(Array.from(e.dataTransfer.files), dropWorldPoint);
    }
  };

  const handleDoubleClick = () => {
    const store = useSceneStore.getState();
    if (store.tool.mode === 'crop_magnetic') {
      const targetId = cropSessionRef.current.targetId;
      const targetObj = store.objects.find(
        (o) => o.id === targetId && isImage(o)
      ) as ImageObject | undefined;
      const anchors = cropSessionRef.current.magneticAnchorsLocal;
      if (targetObj && anchors.length >= 3) {
        const closed = smoothLassoPolygon([...anchors, anchors[0]]);
        cropSessionRef.current.freeformPointsLocal = closed;
        cropSessionRef.current.magneticAnchorsLocal = [];
        setOverlayState((prev) => ({
          ...prev,
          lassoPoints: closed.map((p) => localToWorld(targetObj, p)),
          magneticAnchors: null,
          magneticLivePath: null,
        }));
      }
    }
  };

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    const renderer = rendererRef.current;
    if (!renderer || !containerRef.current) return;

    const rect = containerRef.current.getBoundingClientRect();
    const worldPt = renderer.screenToWorld(e.clientX - rect.left, e.clientY - rect.top);
    const store = useSceneStore.getState();

    const hit = renderer.hitTest(worldPt);
    if (hit) {
      if (!store.selection.includes(hit.id)) {
        store.setSelection([hit.id]);
      }
    }

    setContextMenu({
      isOpen: true,
      x: e.clientX,
      y: e.clientY,
    });
  };

  return (
    <div
      ref={containerRef}
      className="relative flex-1 h-full w-full overflow-hidden select-none"
      style={{
        cursor,
        backgroundColor: bgColor,
        backgroundImage: isUnlimited
          ? `radial-gradient(${dotColor} 1.25px, transparent 1.25px)`
          : 'none',
        backgroundSize: `${gridSpacing}px ${gridSpacing}px`,
        backgroundPosition: `${bgPosX}px ${bgPosY}px`,
      }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      onDoubleClick={handleDoubleClick}
      onContextMenu={handleContextMenu}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* Layer 2: Scene Canvas */}
      <canvas
        ref={sceneCanvasRef}
        className="absolute inset-0 pointer-events-none"
      />

      {/* Layer 3: Interactive Overlay Canvas */}
      <canvas
        ref={overlayCanvasRef}
        className="absolute inset-0 pointer-events-none"
      />

      {/* Canvas Context Menu */}
      <ContextMenu
        isOpen={contextMenu.isOpen}
        x={contextMenu.x}
        y={contextMenu.y}
        onClose={() => setContextMenu((prev) => ({ ...prev, isOpen: false }))}
      />

      {/* Drag & Drop Visual Glass Overlay */}
      {isDragOver && (
        <div className="absolute inset-4 z-40 flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-accent bg-[var(--surface)]/80 backdrop-blur-md pointer-events-none transition-all duration-150">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-accent/20 text-accent mb-3 animate-pulse">
            <Upload size={32} />
          </div>
          <span className="text-base font-semibold text-fg">Drop Images to Import</span>
          <span className="text-xs text-fg-muted mt-1">
            Supports PNG, JPEG, WebP, AVIF, GIF, SVG, TIFF, and JPEG XL (.jxl)
          </span>
        </div>
      )}
    </div>
  );
}
