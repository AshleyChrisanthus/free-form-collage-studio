import { useMemo } from 'react';
import {
  Focus,
  Minus,
  Navigation,
  Plus,
  RotateCcw,
} from 'lucide-react';
import { useSceneStore } from '../../store/sceneStore';
import { unionBounds } from '../../lib/geometry';

export function FloatingToolbar() {
  const viewport = useSceneStore((state) => state.viewport);
  const objects = useSceneStore((state) => state.objects);
  const zoomBy = useSceneStore((state) => state.zoomBy);
  const setZoom = useSceneStore((state) => state.setZoom);
  const setPan = useSceneStore((state) => state.setPan);
  const setFramingZoom = useSceneStore((state) => state.setFramingZoom);

  const isUnlimited = viewport.workMode === 'unlimited';
  const currentZoom = isUnlimited ? viewport.ulZoom : viewport.zoomLevel;
  const zoomPercent = Math.round(currentZoom * 100);

  // Compute if all objects are off-screen
  const isOffscreen = useMemo(() => {
    if (!isUnlimited || objects.length === 0) return false;
    const bounds = unionBounds(objects);
    if (!bounds) return false;

    // Viewport world bounds
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const minX = -viewport.ulPanX / viewport.ulZoom - 50;
    const minY = -viewport.ulPanY / viewport.ulZoom - 50;
    const maxX = (-viewport.ulPanX + vw) / viewport.ulZoom + 50;
    const maxY = (-viewport.ulPanY + vh) / viewport.ulZoom + 50;

    // Disjoint if bounds is completely outside
    return (
      bounds.x + bounds.width < minX ||
      bounds.x > maxX ||
      bounds.y + bounds.height < minY ||
      bounds.y > maxY
    );
  }, [objects, isUnlimited, viewport.ulPanX, viewport.ulPanY, viewport.ulZoom]);

  const handleFitContent = () => {
    if (objects.length === 0) return;
    const bounds = unionBounds(objects);
    if (!bounds) return;

    const margin = 80;
    const vw = window.innerWidth;
    const vh = window.innerHeight;

    const scaleX = (vw - margin * 2) / Math.max(1, bounds.width);
    const scaleY = (vh - margin * 2) / Math.max(1, bounds.height);
    const newZoom = Math.min(Math.max(Math.min(scaleX, scaleY), 0.05), 3.0);

    const cx = bounds.x + bounds.width / 2;
    const cy = bounds.y + bounds.height / 2;

    const newPanX = vw / 2 - cx * newZoom;
    const newPanY = vh / 2 - cy * newZoom;

    if (isUnlimited) {
      setZoom(newZoom);
      setPan(newPanX, newPanY);
    } else {
      setFramingZoom(newZoom);
    }
  };

  const handleResetView = () => {
    if (isUnlimited) {
      setZoom(1.0);
      setPan(0, 0);
    } else {
      setFramingZoom(1.0);
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
          >
            <Navigation size={15} />
            <span className="text-xs font-semibold">Scroll back to content</span>
          </button>
        </div>
      )}

      {/* Bottom Floating Zoom Toolbar */}
      <div className="glass absolute bottom-4 left-1/2 -translate-x-1/2 z-20 flex items-center gap-1.5 rounded-full px-3 py-1.5 shadow-lg">
        <button
          className="apple-btn apple-btn-ghost apple-btn-icon h-7 w-7"
          onClick={() => (isUnlimited ? zoomBy(0.85) : setFramingZoom(currentZoom * 0.85))}
          title="Zoom Out"
          aria-label="Zoom Out"
        >
          <Minus size={14} />
        </button>

        <button
          className="apple-btn apple-btn-ghost text-xs font-semibold px-2 h-7"
          onClick={handleResetView}
          title="Click to reset to 100%"
        >
          {zoomPercent}%
        </button>

        <button
          className="apple-btn apple-btn-ghost apple-btn-icon h-7 w-7"
          onClick={() => (isUnlimited ? zoomBy(1.15) : setFramingZoom(currentZoom * 1.15))}
          title="Zoom In"
          aria-label="Zoom In"
        >
          <Plus size={14} />
        </button>

        <div className="mx-1 h-4 w-px bg-[var(--border)]" />

        <button
          className="apple-btn apple-btn-ghost apple-btn-icon h-7 w-7"
          onClick={handleFitContent}
          title="Fit to Content"
          aria-label="Fit to Content"
        >
          <Focus size={14} />
        </button>

        <button
          className="apple-btn apple-btn-ghost apple-btn-icon h-7 w-7"
          onClick={handleResetView}
          title="Reset View (0, 0 at 100%)"
          aria-label="Reset View"
        >
          <RotateCcw size={14} />
        </button>

        {!isUnlimited && (
          <div className="ml-2 border-l border-[var(--border)] pl-2 text-[11px] text-fg-muted font-mono">
            {viewport.lockedCanvasW || viewport.customCanvasW || 1200} ×{' '}
            {viewport.lockedCanvasH || viewport.customCanvasH || 800} px
          </div>
        )}
      </div>
    </>
  );
}
