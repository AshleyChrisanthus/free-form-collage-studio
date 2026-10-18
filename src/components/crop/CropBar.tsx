import { useState } from 'react';
import {
  Crop,
  Scissors,
  Copy,
  X,
  Check,
  Spline,
} from 'lucide-react';
import { useSceneStore } from '../../store/sceneStore';
import type { ToolMode } from '../../types/scene';

export function CropBar() {
  const toolMode = useSceneStore((state) => state.tool.mode);
  const setToolMode = useSceneStore((state) => state.setToolMode);
  const [magneticRadius, setMagneticRadius] = useState(8);

  const isCropMode =
    toolMode === 'crop_rect' ||
    toolMode === 'crop_freeform' ||
    toolMode === 'crop_magnetic';

  if (!isCropMode) return null;

  const handleExecute = (action: 'crop' | 'duplicate' | 'cut') => {
    window.dispatchEvent(
      new CustomEvent('canvas:crop-action', {
        detail: { action },
      })
    );
  };

  const handleCancel = () => {
    window.dispatchEvent(new CustomEvent('canvas:crop-cancel'));
    setToolMode('select');
  };

  const cropModes: Array<{ id: ToolMode; label: string; icon: React.ReactNode }> = [
    { id: 'crop_rect', label: 'Rectangle', icon: <Crop size={14} /> },
    { id: 'crop_freeform', label: 'Freeform', icon: <Spline size={14} /> },
    { id: 'crop_magnetic', label: 'Magnetic Scissors', icon: <Scissors size={14} /> },
  ];

  return (
    <div
      className="glass absolute top-16 left-1/2 -translate-x-1/2 z-30 flex flex-wrap items-center gap-2 rounded-[var(--radius)] px-3 py-1.5 shadow-2xl border border-[var(--border)] text-xs animate-in fade-in slide-in-from-top-2 duration-150"
      role="toolbar"
      aria-label="Crop Studio Bar"
    >
      {/* Mode Switcher */}
      <div className="flex items-center gap-1 bg-black/10 dark:bg-white/10 rounded-md p-0.5">
        {cropModes.map((m) => (
          <button
            key={m.id}
            type="button"
            className={`apple-btn flex items-center gap-1 px-2.5 py-1 text-[11px] rounded transition-all ${
              toolMode === m.id
                ? 'bg-accent text-white font-medium shadow-sm'
                : 'apple-btn-ghost text-fg hover:text-fg'
            }`}
            onClick={() => setToolMode(m.id)}
          >
            {m.icon}
            <span>{m.label}</span>
          </button>
        ))}
      </div>

      {/* Magnetic Snap Radius (only in magnetic mode) */}
      {toolMode === 'crop_magnetic' && (
        <div className="flex items-center gap-1.5 px-2 border-l border-r border-[var(--border)] text-fg-muted text-[11px]">
          <span>Snap Radius:</span>
          <input
            type="range"
            min="3"
            max="30"
            value={magneticRadius}
            onChange={(e) => {
              const val = Number(e.target.value);
              setMagneticRadius(val);
              window.dispatchEvent(
                new CustomEvent('canvas:magnetic-radius', { detail: { radius: val } })
              );
            }}
            className="w-16 accent-accent"
            title={`Magnetic snap radius: ${magneticRadius}px`}
          />
          <span className="font-mono text-fg w-5">{magneticRadius}px</span>
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex items-center gap-1.5">
        <button
          type="button"
          onClick={() => handleExecute('crop')}
          className="apple-btn bg-emerald-600 hover:bg-emerald-500 text-white flex items-center gap-1 px-3 py-1 font-medium shadow-sm"
          title="Crop in-place (replaces original image with cropped region)"
        >
          <Check size={14} />
          <span>Crop</span>
        </button>

        <button
          type="button"
          onClick={() => handleExecute('duplicate')}
          className="apple-btn apple-btn-secondary flex items-center gap-1 px-2.5 py-1"
          title="Duplicate (creates new object, leaves original untouched)"
        >
          <Copy size={13} />
          <span>Duplicate</span>
        </button>

        <button
          type="button"
          onClick={() => handleExecute('cut')}
          className="apple-btn apple-btn-secondary flex items-center gap-1 px-2.5 py-1"
          title="Cut (spawns new object and cuts transparent hole in original)"
        >
          <Scissors size={13} />
          <span>Cut</span>
        </button>

        <button
          type="button"
          onClick={handleCancel}
          className="apple-btn apple-btn-ghost apple-btn-icon text-fg-muted hover:text-fg h-7 w-7"
          title="Cancel Crop (Esc)"
          aria-label="Cancel Crop"
        >
          <X size={15} />
        </button>
      </div>
    </div>
  );
}
