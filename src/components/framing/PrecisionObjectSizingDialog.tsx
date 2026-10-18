import { useState, useEffect } from 'react';
import {
  X,
  Link2,
  Unlink2,
  RotateCcw,
  Maximize2,
  Check,
} from 'lucide-react';
import { useSceneStore } from '../../store/sceneStore';
import { useSelectedObjects } from '../../store/selectors';
import { isImage } from '../../types/guards';
import type { Unit } from '../../types/scene';
import { db } from '../../db/db';
import { assetCache } from '../../canvas/assetCache';
import {
  OBJECT_RATIO_PRESETS,
  type FitStrategy,
  calculateAspectDimensions,
  convertDimensionsToUnit,
  convertDimensionsToPx,
} from './precisionSizing';

export function PrecisionObjectSizingDialog() {
  const activeDialog = useSceneStore((state) => state.ui.activeDialog);
  const setActiveDialog = useSceneStore((state) => state.setActiveDialog);
  const selectedObjects = useSelectedObjects();
  const settings = useSceneStore((state) => state.settings);
  const resizeObject = useSceneStore((state) => state.resizeObject);
  const beginTransaction = useSceneStore((state) => state.beginTransaction);
  const commitTransaction = useSceneStore((state) => state.commitTransaction);

  const isOpen = activeDialog === 'precision-object-sizing';

  const [unit, setUnit] = useState<Unit>(settings.unit || 'px');
  const [aspectLocked, setAspectLocked] = useState(true);
  const [fitStrategy, setFitStrategy] = useState<FitStrategy>('width');
  const [widthVal, setWidthVal] = useState<number>(100);
  const [heightVal, setHeightVal] = useState<number>(100);
  const [ratio, setRatio] = useState<number>(1);
  const [originalSize, setOriginalSize] = useState<{ width: number; height: number } | null>(null);

  const dpi = settings.dpi || 300;

  // Initialize from current selection
  useEffect(() => {
    if (!isOpen || selectedObjects.length === 0) return;

    // Use primary selected object bounds
    const primary = selectedObjects[0];
    const initialW = primary.width;
    const initialH = primary.height;

    setRatio(initialW / Math.max(1, initialH));
    const converted = convertDimensionsToUnit(initialW, initialH, unit, dpi);
    setWidthVal(converted.width);
    setHeightVal(converted.height);

    // Look up original asset dimensions if image
    if (isImage(primary)) {
      const cached = assetCache.get(primary.assetId);
      if (cached) {
        setOriginalSize({ width: cached.width, height: cached.height });
      } else {
        void db.assets.get(primary.assetId).then((rec) => {
          if (rec) {
            setOriginalSize({ width: rec.width, height: rec.height });
          }
        });
      }
    } else {
      setOriginalSize({ width: initialW, height: initialH });
    }
  }, [isOpen, selectedObjects, unit, dpi]);

  if (!isOpen) return null;

  const handleUnitChange = (newUnit: Unit) => {
    if (newUnit === unit) return;
    const px = convertDimensionsToPx(widthVal, heightVal, unit, dpi);
    const converted = convertDimensionsToUnit(px.widthPx, px.heightPx, newUnit, dpi);
    setUnit(newUnit);
    setWidthVal(converted.width);
    setHeightVal(converted.height);
  };

  const handleWidthChange = (valStr: string) => {
    const num = parseFloat(valStr);
    if (isNaN(num) || num <= 0) return;
    setWidthVal(num);

    if (aspectLocked && ratio > 0) {
      const px = convertDimensionsToPx(num, heightVal, unit, dpi);
      const newHeightPx = Math.round(px.widthPx / ratio);
      const newHeightUnit = convertDimensionsToUnit(px.widthPx, newHeightPx, unit, dpi).height;
      setHeightVal(newHeightUnit);
    }
  };

  const handleHeightChange = (valStr: string) => {
    const num = parseFloat(valStr);
    if (isNaN(num) || num <= 0) return;
    setHeightVal(num);

    if (aspectLocked && ratio > 0) {
      const px = convertDimensionsToPx(widthVal, num, unit, dpi);
      const newWidthPx = Math.round(px.heightPx * ratio);
      const newWidthUnit = convertDimensionsToUnit(newWidthPx, px.heightPx, unit, dpi).width;
      setWidthVal(newWidthUnit);
    }
  };

  const handleApplyPreset = (presetRatio: number) => {
    setRatio(presetRatio);
    const px = convertDimensionsToPx(widthVal, heightVal, unit, dpi);
    const adjusted = calculateAspectDimensions(px.widthPx, px.heightPx, presetRatio, fitStrategy);
    const converted = convertDimensionsToUnit(adjusted.width, adjusted.height, unit, dpi);
    setWidthVal(converted.width);
    setHeightVal(converted.height);
  };

  const handleResetToOriginal = () => {
    if (!originalSize) return;
    setRatio(originalSize.width / Math.max(1, originalSize.height));
    const converted = convertDimensionsToUnit(originalSize.width, originalSize.height, unit, dpi);
    setWidthVal(converted.width);
    setHeightVal(converted.height);
  };

  const handleApply = () => {
    if (selectedObjects.length === 0) {
      setActiveDialog(null);
      return;
    }

    const targetPx = convertDimensionsToPx(widthVal, heightVal, unit, dpi);
    beginTransaction('Precision Resize');

    if (selectedObjects.length === 1) {
      const obj = selectedObjects[0];
      resizeObject(obj.id, {
        x: obj.x,
        y: obj.y,
        width: targetPx.widthPx,
        height: targetPx.heightPx,
      });
    } else {
      // Proportional resize for multiple objects
      for (const obj of selectedObjects) {
        resizeObject(obj.id, {
          x: obj.x,
          y: obj.y,
          width: targetPx.widthPx,
          height: targetPx.heightPx,
        });
      }
    }

    commitTransaction();
    setActiveDialog(null);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="precision-sizing-title"
    >
      <div className="glass w-[360px] rounded-[var(--radius)] border border-[var(--border)] shadow-2xl p-5 space-y-4 animate-in fade-in zoom-in-95 duration-150 text-xs">
        {/* Header */}
        <div className="flex items-center justify-between pb-2 border-b border-[var(--border)]">
          <div className="flex items-center gap-2 font-semibold text-sm">
            <Maximize2 size={16} className="text-accent" />
            <span id="precision-sizing-title">Precision Object Sizing</span>
          </div>
          <button
            onClick={() => setActiveDialog(null)}
            className="apple-btn apple-btn-ghost apple-btn-icon h-7 w-7"
            aria-label="Close dialog"
          >
            <X size={15} />
          </button>
        </div>

        {selectedObjects.length === 0 ? (
          <p className="text-fg-muted py-4 text-center">No object selected to resize.</p>
        ) : (
          <div className="space-y-4">
            {/* Units & DPI bar */}
            <div className="flex items-center justify-between">
              <span className="text-fg-muted">Measurement Unit:</span>
              <div className="flex items-center gap-2">
                <select
                  value={unit}
                  onChange={(e) => handleUnitChange(e.target.value as Unit)}
                  className="apple-input py-1 px-2 text-xs font-medium cursor-pointer"
                >
                  <option value="px">Pixels (px)</option>
                  <option value="in">Inches (in)</option>
                  <option value="cm">Centimeters (cm)</option>
                  <option value="mm">Millimeters (mm)</option>
                </select>
                <span className="text-[10px] text-fg-muted font-mono">{dpi} DPI</span>
              </div>
            </div>

            {/* Width & Height Inputs */}
            <div className="grid grid-cols-[1fr,auto,1fr] gap-2 items-center">
              <div>
                <label className="text-[10px] text-fg-muted block mb-1">
                  Width ({unit})
                </label>
                <input
                  type="number"
                  step={unit === 'px' ? '1' : '0.01'}
                  value={widthVal}
                  onChange={(e) => handleWidthChange(e.target.value)}
                  className="apple-input w-full py-1.5 px-2 font-mono text-xs"
                />
              </div>

              {/* Aspect Ratio Lock Toggle */}
              <div className="pt-4 flex justify-center">
                <button
                  type="button"
                  onClick={() => setAspectLocked(!aspectLocked)}
                  className={`apple-btn apple-btn-icon h-8 w-8 ${
                    aspectLocked ? 'apple-btn-primary' : 'apple-btn-secondary'
                  }`}
                  title={aspectLocked ? 'Aspect ratio locked' : 'Aspect ratio unlocked'}
                  aria-label={aspectLocked ? 'Aspect ratio locked' : 'Aspect ratio unlocked'}
                >
                  {aspectLocked ? <Link2 size={14} /> : <Unlink2 size={14} />}
                </button>
              </div>

              <div>
                <label className="text-[10px] text-fg-muted block mb-1">
                  Height ({unit})
                </label>
                <input
                  type="number"
                  step={unit === 'px' ? '1' : '0.01'}
                  value={heightVal}
                  onChange={(e) => handleHeightChange(e.target.value)}
                  className="apple-input w-full py-1.5 px-2 font-mono text-xs"
                />
              </div>
            </div>

            {/* Ratio Presets */}
            <div className="space-y-1.5 pt-1">
              <div className="flex items-center justify-between text-[11px]">
                <span className="font-semibold text-fg-muted">Ratio Presets</span>
                {/* Fit strategy selector */}
                <div className="flex items-center gap-1 bg-surface-raised rounded p-0.5 border border-[var(--border)]">
                  <button
                    type="button"
                    onClick={() => setFitStrategy('width')}
                    className={`px-1.5 py-0.5 rounded text-[10px] font-medium transition-colors ${
                      fitStrategy === 'width' ? 'bg-accent text-white shadow-sm' : 'text-fg-muted hover:text-fg'
                    }`}
                  >
                    Fit Width
                  </button>
                  <button
                    type="button"
                    onClick={() => setFitStrategy('height')}
                    className={`px-1.5 py-0.5 rounded text-[10px] font-medium transition-colors ${
                      fitStrategy === 'height' ? 'bg-accent text-white shadow-sm' : 'text-fg-muted hover:text-fg'
                    }`}
                  >
                    Fit Height
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-4 gap-1.5">
                {OBJECT_RATIO_PRESETS.map((preset) => (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => handleApplyPreset(preset.ratio)}
                    className="apple-btn apple-btn-secondary py-1 text-[11px] font-mono hover:border-accent"
                  >
                    {preset.id}
                  </button>
                ))}
              </div>
            </div>

            {/* Reset to Original Dimensions */}
            {originalSize && (
              <div className="pt-1">
                <button
                  type="button"
                  onClick={handleResetToOriginal}
                  className="apple-btn apple-btn-secondary w-full flex items-center justify-center gap-1.5 py-1.5 text-xs text-fg-muted hover:text-fg"
                >
                  <RotateCcw size={12} />
                  <span>Reset to Original ({originalSize.width} × {originalSize.height} px)</span>
                </button>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex items-center justify-end gap-2 pt-3 border-t border-[var(--border)]">
              <button
                type="button"
                onClick={() => setActiveDialog(null)}
                className="apple-btn apple-btn-secondary px-3 py-1.5"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleApply}
                className="apple-btn apple-btn-primary flex items-center gap-1.5 px-4 py-1.5"
              >
                <Check size={14} />
                <span>Apply</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
