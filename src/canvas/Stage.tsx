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
import { Upload } from 'lucide-react';

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
    lassoPoints: null,
  });

  const pointerStateRef = useRef<PointerMachineState>(createInitialPointerState());
  const [cursor, setCursor] = useState<string>('default');
  const [isDragOver, setIsDragOver] = useState(false);
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
        boxes.set(handleHit.obj.id, {
          x: handleHit.obj.x,
          y: handleHit.obj.y,
          width: handleHit.obj.width,
          height: handleHit.obj.height,
          rotation: handleHit.obj.rotation,
        });

        snapCandidatesRef.current = precomputeSnapLines(
          store.objects,
          new Set([handleHit.obj.id]),
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
          dragTargetIds: [handleHit.obj.id],
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
          if (targets.includes(obj.id)) {
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
    if (pState.mode === 'resizing' && pState.activeHandle && pState.dragTargetIds[0]) {
      const id = pState.dragTargetIds[0];
      const initial = pState.initialObjectBoxes.get(id);
      if (initial) {
        const zoom =
          store.viewport.workMode === 'unlimited'
            ? store.viewport.ulZoom
            : store.viewport.zoomLevel;

        const dx = worldPt.x - pState.startWorld.x;
        const dy = worldPt.y - pState.startWorld.y;

        let newX = initial.x;
        let newY = initial.y;
        let newW = initial.width;
        let newH = initial.height;

        switch (pState.activeHandle) {
          case 'br':
            newW = Math.max(20, initial.width + dx);
            newH = Math.max(20, initial.height + dy);
            break;
          case 'bl':
            newW = Math.max(20, initial.width - dx);
            newH = Math.max(20, initial.height + dy);
            newX = initial.x + initial.width - newW;
            break;
          case 'tr':
            newW = Math.max(20, initial.width + dx);
            newH = Math.max(20, initial.height - dy);
            newY = initial.y + initial.height - newH;
            break;
          case 'tl':
            newW = Math.max(20, initial.width - dx);
            newH = Math.max(20, initial.height - dy);
            newX = initial.x + initial.width - newW;
            newY = initial.y + initial.height - newH;
            break;
          case 'mr':
            newW = Math.max(20, initial.width + dx);
            break;
          case 'ml':
            newW = Math.max(20, initial.width - dx);
            newX = initial.x + initial.width - newW;
            break;
          case 'bc':
            newH = Math.max(20, initial.height + dy);
            break;
          case 'tc':
            newH = Math.max(20, initial.height - dy);
            newY = initial.y + initial.height - newH;
            break;
        }

        let guides: SnapGuide[] = [];
        const isResizeSnap = store.settings.isResizeSnapping && !e.ctrlKey && !e.metaKey;
        if (isResizeSnap && snapCandidatesRef.current) {
          const snapped = snapResize(
            { x: newX, y: newY, width: newW, height: newH },
            pState.activeHandle,
            snapCandidatesRef.current,
            15 / zoom
          );
          newX = snapped.box.x;
          newY = snapped.box.y;
          newW = snapped.box.width;
          newH = snapped.box.height;
          guides = snapped.guides;
        }

        setOverlayState((prev) => ({ ...prev, guidelines: guides }));
        store.resizeObject(id, { x: newX, y: newY, width: newW, height: newH });
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
    snapCandidatesRef.current = null;
    setOverlayState((prev) => ({ ...prev, marquee: null, guidelines: [] }));

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
