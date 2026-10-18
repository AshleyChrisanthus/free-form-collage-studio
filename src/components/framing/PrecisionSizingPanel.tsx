import { useState, useMemo } from 'react';
import {
  AlertTriangle,
  Link2,
  Lock,
  Unlock,
  Maximize2,
} from 'lucide-react';
import { useSceneStore } from '../../store/sceneStore';
import {
  PAPER_PRESETS,
  COMMON_DPI_LIST,
  toPx,
  fromPx,
  isCanvasSizeExceeded,
} from '../../lib/units';
import {
  isValidRatioString,
  computeCanvasSize,
} from '../../framing/canvasSize';
import type { CanvasPreset, Unit } from '../../types/scene';

export function PrecisionSizingPanel() {
  const viewport = useSceneStore((state) => state.viewport);
  const settings = useSceneStore((state) => state.settings);
  const objects = useSceneStore((state) => state.objects);
  const setCanvasPreset = useSceneStore((state) => state.setCanvasPreset);
  const setCanvasLock = useSceneStore((state) => state.setCanvasLock);
  const setCustomCanvasSize = useSceneStore((state) => state.setCustomCanvasSize);
  const wrapToContent = useSceneStore((state) => state.wrapToContent);
  const updateSettings = useSceneStore((state) => state.updateSettings);

  const [aspectLocked, setAspectLocked] = useState(false);
  const [customRatioInput, setCustomRatioInput] = useState('');
  const [customRatioError, setCustomRatioError] = useState(false);

  const stageSize = useMemo(() => {
    return computeCanvasSize(objects, viewport, settings);
  }, [objects, viewport, settings]);

  const currentUnit = settings.unit || 'px';
  const currentDpi = settings.dpi || 300;

  // Convert stage dimensions to current unit
  const displayW = fromPx(stageSize.width, currentUnit, currentDpi);
  const displayH = fromPx(stageSize.height, currentUnit, currentDpi);
  const megaPixels = ((stageSize.width * stageSize.height) / 1000000).toFixed(1);
  const sizeExceeded = isCanvasSizeExceeded(stageSize.width, stageSize.height);

  const handleApplyPreset = (preset: CanvasPreset) => {
    setCanvasPreset(preset);
  };

  const handleApplyPaperPreset = (presetId: string) => {
    const preset = PAPER_PRESETS.find((p) => p.id === presetId);
    if (!preset) return;
    updateSettings({ unit: preset.unit });
    const wPx = toPx(preset.width, preset.unit, currentDpi);
    const hPx = toPx(preset.height, preset.unit, currentDpi);
    setCustomCanvasSize(wPx, hPx);
    setCanvasPreset('custom');
  };

  const handleCustomRatioChange = (val: string) => {
    setCustomRatioInput(val);
    if (val.trim() === '') {
      setCustomRatioError(false);
      return;
    }
    if (isValidRatioString(val)) {
      setCustomRatioError(false);
      setCanvasPreset(val.trim() as CanvasPreset);
    } else {
      setCustomRatioError(true);
    }
  };

  const handleWidthChange = (valStr: string) => {
    const num = parseFloat(valStr);
    if (isNaN(num) || num <= 0) return;
    const newWPx = toPx(num, currentUnit, currentDpi);
    let newHPx = stageSize.height;

    if (aspectLocked && stageSize.width > 0) {
      const ratio = stageSize.height / stageSize.width;
      newHPx = Math.round(newWPx * ratio);
    }

    setCustomCanvasSize(newWPx, newHPx);
    setCanvasPreset('custom');
  };

  const handleHeightChange = (valStr: string) => {
    const num = parseFloat(valStr);
    if (isNaN(num) || num <= 0) return;
    const newHPx = toPx(num, currentUnit, currentDpi);
    let newWPx = stageSize.width;

    if (aspectLocked && stageSize.height > 0) {
      const ratio = stageSize.width / stageSize.height;
      newWPx = Math.round(newHPx * ratio);
    }

    setCustomCanvasSize(newWPx, newHPx);
    setCanvasPreset('custom');
  };

  return (
    <div className="space-y-3">
      {/* Aspect Ratio Preset Select */}
      <div className="space-y-1.5">
        <label className="text-[11px] font-semibold text-fg-muted uppercase tracking-wider">
          Aspect Ratio
        </label>
        <select
          value={
            ['auto', '1:1', '16:9', '9:16', '4:3', '3:4', 'custom'].includes(viewport.canvasMode)
              ? viewport.canvasMode
              : 'custom-ratio'
          }
          onChange={(e) => {
            const val = e.target.value;
            if (val !== 'custom-ratio') {
              handleApplyPreset(val as CanvasPreset);
            }
          }}
          className="apple-input w-full text-xs py-1"
        >
          <option value="auto">Auto (Wrap to Content)</option>
          <option value="1:1">1:1 Square</option>
          <option value="16:9">16:9 Landscape</option>
          <option value="9:16">9:16 Story / Reel</option>
          <option value="4:3">4:3 Standard</option>
          <option value="3:4">3:4 Portrait</option>
          <option value="custom">Custom Dimensions</option>
          <option value="custom-ratio">Custom Ratio (e.g. 21:9)</option>
        </select>
      </div>

      {/* Arbitrary Ratio Input */}
      {(!['auto', '1:1', '16:9', '9:16', '4:3', '3:4', 'custom'].includes(viewport.canvasMode) ||
        customRatioInput !== '') && (
        <div className="space-y-1">
          <div className="flex items-center justify-between text-[11px]">
            <span className="text-fg-muted">Custom Ratio (W:H)</span>
            {customRatioError && (
              <span className="text-[10px] text-rose-500 font-medium">Format: 21:9</span>
            )}
          </div>
          <input
            type="text"
            placeholder="e.g. 21:9 or 2.35:1"
            value={customRatioInput || (!['auto', '1:1', '16:9', '9:16', '4:3', '3:4', 'custom'].includes(viewport.canvasMode) ? viewport.canvasMode : '')}
            onChange={(e) => handleCustomRatioChange(e.target.value)}
            className={`apple-input w-full text-xs py-1 ${
              customRatioError ? 'border-rose-500' : ''
            }`}
          />
        </div>
      )}

      {/* Paper Presets Dropdown */}
      <div className="space-y-1.5">
        <label className="text-[11px] font-semibold text-fg-muted uppercase tracking-wider">
          Standard Print / Paper
        </label>
        <select
          defaultValue=""
          onChange={(e) => {
            if (e.target.value) {
              handleApplyPaperPreset(e.target.value);
              e.target.value = '';
            }
          }}
          className="apple-input w-full text-xs py-1"
        >
          <option value="" disabled>
            Choose Paper Preset...
          </option>
          {PAPER_PRESETS.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </div>

      {/* Precision Dimension Inputs (W / H, Unit, DPI) */}
      <div className="space-y-2 border-t border-[var(--border)] pt-2.5">
        <div className="flex items-center justify-between">
          <label className="text-[11px] font-semibold text-fg-muted uppercase tracking-wider">
            Precision Dimensions
          </label>
          <button
            onClick={() => setAspectLocked(!aspectLocked)}
            className={`apple-btn apple-btn-ghost apple-btn-icon h-5 w-5 ${
              aspectLocked ? 'text-accent' : 'text-fg-muted'
            }`}
            title={aspectLocked ? 'Aspect Ratio Locked' : 'Lock Aspect Ratio'}
          >
            <Link2 size={12} />
          </button>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div>
            <span className="text-[10px] text-fg-muted font-mono">W ({currentUnit})</span>
            <input
              type="number"
              step="any"
              value={displayW}
              onChange={(e) => handleWidthChange(e.target.value)}
              className="apple-input w-full text-xs py-1 mt-0.5 font-mono"
            />
          </div>
          <div>
            <span className="text-[10px] text-fg-muted font-mono">H ({currentUnit})</span>
            <input
              type="number"
              step="any"
              value={displayH}
              onChange={(e) => handleHeightChange(e.target.value)}
              className="apple-input w-full text-xs py-1 mt-0.5 font-mono"
            />
          </div>
        </div>

        {/* Unit and DPI selectors */}
        <div className="grid grid-cols-2 gap-2 pt-1">
          <div>
            <span className="text-[10px] text-fg-muted">Unit</span>
            <select
              value={currentUnit}
              onChange={(e) => updateSettings({ unit: e.target.value as Unit })}
              className="apple-input w-full text-xs py-1 mt-0.5"
            >
              <option value="px">px (Pixels)</option>
              <option value="in">in (Inches)</option>
              <option value="cm">cm (Centimeters)</option>
              <option value="mm">mm (Millimeters)</option>
            </select>
          </div>
          <div>
            <span className="text-[10px] text-fg-muted">DPI</span>
            <select
              value={currentDpi}
              onChange={(e) => updateSettings({ dpi: Number(e.target.value) })}
              className="apple-input w-full text-xs py-1 mt-0.5 font-mono"
            >
              {COMMON_DPI_LIST.map((dpi) => (
                <option key={dpi} value={dpi}>
                  {dpi} DPI {dpi === 300 ? '(Print)' : dpi === 72 ? '(Screen)' : ''}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Computed Pixel Resolution & Megapixels */}
        <div className="rounded-lg bg-[var(--surface)] p-2 text-[11px] font-mono text-center text-fg-muted flex items-center justify-between">
          <span>Resolution:</span>
          <span className="font-semibold text-fg">
            {stageSize.width} × {stageSize.height} px ({megaPixels} MP)
          </span>
        </div>

        {/* High Resolution Warning */}
        {sizeExceeded.exceeded && (
          <div className="rounded-lg bg-amber-500/15 border border-amber-500/30 p-2 text-[11px] text-amber-600 dark:text-amber-400 flex items-start gap-1.5">
            <AlertTriangle size={14} className="shrink-0 mt-0.5" />
            <span>{sizeExceeded.reason}</span>
          </div>
        )}
      </div>

      {/* Stage Actions: Lock & Wrap to content */}
      <div className="space-y-2 border-t border-[var(--border)] pt-2.5">
        <label className="text-[11px] font-semibold text-fg-muted uppercase tracking-wider">
          Stage Actions
        </label>
        <div className="grid grid-cols-2 gap-1.5">
          <button
            className={`apple-btn justify-center gap-1.5 py-1 text-xs ${
              viewport.canvasLocked ? 'bg-accent text-white' : 'apple-btn-ghost'
            }`}
            onClick={() => setCanvasLock(!viewport.canvasLocked)}
            title="Lock stage size (Ctrl+L)"
          >
            {viewport.canvasLocked ? <Lock size={13} /> : <Unlock size={13} />}
            <span>{viewport.canvasLocked ? 'Locked' : 'Lock Size'}</span>
          </button>

          <button
            className="apple-btn apple-btn-ghost justify-center gap-1.5 py-1 text-xs"
            onClick={wrapToContent}
            title="Fit canvas to tight bounds of all content"
          >
            <Maximize2 size={13} /> Wrap Content
          </button>
        </div>
      </div>
    </div>
  );
}
