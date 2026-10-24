import { useMemo, useState, useRef, useEffect } from 'react';
import {
  Focus,
  Minus,
  Navigation,
  Plus,
  RotateCcw,
  Lock,
  Unlock,
} from 'lucide-react';
import { useSceneStore } from '../../store/sceneStore';
import { unionBounds } from '../../lib/geometry';
import {
  animateViewport,
  clampUnlimitedZoom,
  clampFramingZoom,
  computeFitViewport,
  type AnimationCancelFn,
} from '../../canvas/viewport';
import { computeCanvasSize } from '../../framing/canvasSize';

const FRAMING_ZOOM_STEPS = [0.05, 0.1, 0.25, 0.33, 0.5, 0.67, 0.75, 1.0, 1.25, 1.5, 2.0, 3.0];

export function FloatingToolbar() {
  const viewport = useSceneStore((state) => state.viewport);
  const objects = useSceneStore((state) => state.objects);
  const settings = useSceneStore((state) => state.settings);
  const zoomBy = useSceneStore((state) => state.zoomBy);
  const setZoom = useSceneStore((state) => state.setZoom);
  const setPan = useSceneStore((state) => state.setPan);
  const setFramingZoom = useSceneStore((state) => state.setFramingZoom);
  const setCanvasLock = useSceneStore((state) => state.setCanvasLock);

  const [isEditingZoom, setIsEditingZoom] = useState(false);
  const [zoomInputValue, setZoomInputValue] = useState('');
  const animCancelRef = useRef<AnimationCancelFn | null>(null);

  const isUnlimited = viewport.workMode === 'unlimited';
  const currentZoom = isUnlimited ? viewport.ulZoom : viewport.zoomLevel;
  const zoomPercent = Math.round(currentZoom * 100);

  // Compute live stage dimensions for framing mode
  const stageSize = useMemo(() => {
    return computeCanvasSize(objects, viewport, settings);
  }, [objects, viewport, settings]);

  // Compute if all objects are off-screen and calculate angle to content centroid
  const { isOffscreen, directionAngleDeg } = useMemo(() => {
    if (!isUnlimited || objects.length === 0) {
      return { isOffscreen: false, directionAngleDeg: 0 };
    }
    const bounds = unionBounds(objects);
    if (!bounds) return { isOffscreen: false, directionAngleDeg: 0 };

    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const minX = -viewport.ulPanX / viewport.ulZoom - 50;
    const minY = -viewport.ulPanY / viewport.ulZoom - 50;
    const maxX = (-viewport.ulPanX + vw) / viewport.ulZoom + 50;
    const maxY = (-viewport.ulPanY + vh) / viewport.ulZoom + 50;

    const offscreen =
      bounds.x + bounds.width < minX ||
      bounds.x > maxX ||
      bounds.y + bounds.height < minY ||
      bounds.y > maxY;

    const contentCentroidX = bounds.x + bounds.width / 2;
    const contentCentroidY = bounds.y + bounds.height / 2;
    const cameraCenterX = (-viewport.ulPanX + vw / 2) / viewport.ulZoom;
    const cameraCenterY = (-viewport.ulPanY + vh / 2) / viewport.ulZoom;

    // Angle from camera center to content centroid
    const angleRad = Math.atan2(
      contentCentroidY - cameraCenterY,
      contentCentroidX - cameraCenterX
    );
    // Adjust by -45° or -90° depending on icon orientation (Navigation points up-right by default ~ -45deg)
    const angleDeg = (angleRad * 180) / Math.PI;

    return { isOffscreen: offscreen, directionAngleDeg: angleDeg - 45 };
  }, [objects, isUnlimited, viewport.ulPanX, viewport.ulPanY, viewport.ulZoom]);

  /** Size of the visible canvas area (excludes side panels), falling back to the window. */
  const getStageViewportSize = () => {
    const el = document.querySelector<HTMLElement>('[data-stage-container]');
    const w = el?.clientWidth || window.innerWidth;
    const h = el?.clientHeight || window.innerHeight;
    return { vw: w, vh: h };
  };

  const handleFitContent = () => {
    animCancelRef.current?.();

    // Read live state: this may run from a keyboard shortcut or mid-animation.
    const state = useSceneStore.getState();
    const objs = state.objects.filter((o) => !o.hidden);
    const vp = state.viewport;

    if (objs.length === 0) {
      handleResetView();
      return;
    }

    const bounds = unionBounds(objs);
    if (!bounds) return;

    const { vw, vh } = getStageViewportSize();

    if (vp.workMode === 'unlimited') {
      const target = computeFitViewport(bounds, vw, vh, 80);
      animCancelRef.current = animateViewport(
        { panX: vp.ulPanX, panY: vp.ulPanY, zoom: vp.ulZoom },
        target,
        350,
        (curr) => {
          setPan(curr.panX, curr.panY);
          setZoom(curr.zoom);
        }
      );
    } else {
      // Framing mode: fit stage to screen
      const stage = computeCanvasSize(state.objects, vp, state.settings);
      const fitZoom = clampFramingZoom(
        Math.min((vw * 0.9) / stage.width, (vh * 0.9) / stage.height)
      );
      setFramingZoom(fitZoom);
    }
  };

  const handleResetView = () => {
    animCancelRef.current?.();
    const vp = useSceneStore.getState().viewport;
    if (vp.workMode === 'unlimited') {
      animCancelRef.current = animateViewport(
        { panX: vp.ulPanX, panY: vp.ulPanY, zoom: vp.ulZoom },
        { panX: 0, panY: 0, zoom: 1.0 },
        350,
        (curr) => {
          setPan(curr.panX, curr.panY);
          setZoom(curr.zoom);
        }
      );
    } else {
      setFramingZoom(1.0);
    }
  };

  // Keyboard shortcut events from shortcuts.ts.
  // Subscribe once: re-subscribing on viewport changes would run the cleanup
  // (which cancels the animation) on the very first animation frame (#41).
  const shortcutHandlersRef = useRef({ fit: handleFitContent, reset: handleResetView });
  shortcutHandlersRef.current = { fit: handleFitContent, reset: handleResetView };

  useEffect(() => {
    const onFit = () => shortcutHandlersRef.current.fit();
    const onReset = () => shortcutHandlersRef.current.reset();
    window.addEventListener('canvas:fit-content', onFit);
    window.addEventListener('canvas:reset-view', onReset);
    return () => {
      window.removeEventListener('canvas:fit-content', onFit);
      window.removeEventListener('canvas:reset-view', onReset);
      animCancelRef.current?.();
    };
  }, []);

  // Zoom step buttons
  const handleZoomOut = () => {
    if (isUnlimited) {
      zoomBy(0.85);
    } else {
      const smaller = [...FRAMING_ZOOM_STEPS].reverse().find((s) => s < currentZoom - 0.001);
      setFramingZoom(smaller ?? FRAMING_ZOOM_STEPS[0]);
    }
  };

  const handleZoomIn = () => {
    if (isUnlimited) {
      zoomBy(1.15);
    } else {
      const larger = FRAMING_ZOOM_STEPS.find((s) => s > currentZoom + 0.001);
      setFramingZoom(larger ?? FRAMING_ZOOM_STEPS[FRAMING_ZOOM_STEPS.length - 1]);
    }
  };

  const handleCommitTypedZoom = () => {
    setIsEditingZoom(false);
    const parsed = parseFloat(zoomInputValue);
    if (!isNaN(parsed) && parsed > 0) {
      const newZoom = parsed / 100;
      if (isUnlimited) {
        setZoom(clampUnlimitedZoom(newZoom));
      } else {
        setFramingZoom(clampFramingZoom(newZoom));
      }
    }
  };

  return (
    <>
      {/* Floating Radar Button: "Scroll back to content" */}
      {isOffscreen && (
        <div className="absolute top-20 left-1/2 -translate-x-1/2 z-20 animate-bounce">
          <button
            onClick={handleFitContent}
            className="apple-btn flex items-center gap-2 rounded-full px-4 py-2 shadow-lg bg-accent text-white"
            title="All objects are off-screen. Click to re-center."
          >
            <Navigation
              size={15}
              style={{
                transform: `rotate(${directionAngleDeg}deg)`,
                transition: 'transform 0.15s ease-out',
              }}
            />
            <span className="text-xs font-semibold">Scroll back to content</span>
          </button>
        </div>
      )}

      {/* Bottom Floating Zoom & Metrics Toolbar */}
      <div className="glass absolute bottom-4 left-1/2 -translate-x-1/2 z-20 flex items-center gap-1.5 rounded-full px-3 py-1.5 shadow-lg">
        {/* Live Canvas Dimensions (Framing Engine) */}
        {!isUnlimited && (
          <>
            <div
              className="mr-1 text-[11px] text-fg-muted font-mono font-medium px-1"
              title="Current stage dimensions"
            >
              {Math.round(stageSize.width)} × {Math.round(stageSize.height)} px
            </div>
            <div className="mx-1 h-4 w-px bg-[var(--border)]" />
          </>
        )}

        <button
          className="apple-btn apple-btn-ghost apple-btn-icon h-7 w-7"
          onClick={handleZoomOut}
          title="Zoom Out"
          aria-label="Zoom Out"
        >
          <Minus size={14} />
        </button>

        {isEditingZoom ? (
          <input
            type="number"
            autoFocus
            className="apple-input h-7 w-16 px-1 text-center font-mono text-xs"
            value={zoomInputValue}
            onChange={(e) => setZoomInputValue(e.target.value)}
            onBlur={handleCommitTypedZoom}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleCommitTypedZoom();
              if (e.key === 'Escape') setIsEditingZoom(false);
            }}
          />
        ) : (
          <button
            className="apple-btn apple-btn-ghost text-xs font-semibold px-2 h-7 font-mono"
            onClick={() => {
              setZoomInputValue(zoomPercent.toString());
              setIsEditingZoom(true);
            }}
            title="Click to type custom zoom %"
          >
            {zoomPercent}%
          </button>
        )}

        <button
          className="apple-btn apple-btn-ghost apple-btn-icon h-7 w-7"
          onClick={handleZoomIn}
          title="Zoom In"
          aria-label="Zoom In"
        >
          <Plus size={14} />
        </button>

        <div className="mx-1 h-4 w-px bg-[var(--border)]" />

        <button
          className="apple-btn apple-btn-ghost apple-btn-icon h-7 w-7"
          onClick={handleFitContent}
          title={isUnlimited ? 'Fit Content (Shift+1)' : 'Fit Stage to Screen (Shift+1)'}
          aria-label="Fit to Content"
        >
          <Focus size={14} />
        </button>

        <button
          className="apple-btn apple-btn-ghost apple-btn-icon h-7 w-7"
          onClick={handleResetView}
          title="Reset View 100% (Shift+0)"
          aria-label="Reset View"
        >
          <RotateCcw size={14} />
        </button>

        {/* Lock toggle for Framing Engine */}
        {!isUnlimited && (
          <>
            <div className="mx-1 h-4 w-px bg-[var(--border)]" />
            <button
              className={`apple-btn apple-btn-ghost apple-btn-icon h-7 w-7 ${
                viewport.canvasLocked ? 'text-accent' : 'text-fg-muted'
              }`}
              onClick={() => setCanvasLock(!viewport.canvasLocked)}
              title={
                viewport.canvasLocked
                  ? 'Canvas Size Locked (Ctrl+L)'
                  : 'Lock Canvas Size (Ctrl+L)'
              }
              aria-label="Toggle Canvas Lock"
            >
              {viewport.canvasLocked ? <Lock size={14} /> : <Unlock size={14} />}
            </button>
          </>
        )}
      </div>
    </>
  );
}
