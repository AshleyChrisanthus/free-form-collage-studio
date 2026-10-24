import { useState } from 'react';
import {
  ChevronRight,
  Copy,
  FlipHorizontal,
  FlipVertical,
  Group,
  RotateCcw,
  Sliders,
  Trash2,
  Ungroup,
  ArrowUpToLine,
  ArrowDownToLine,
  ChevronUp,
  ChevronDown,
  Maximize2,
  Crop,
  Scissors,
  Sparkles,
  Wand2,
} from 'lucide-react';
import { useSceneStore } from '../../store/sceneStore';
import { useSingleSelectedObject, useSelectedObjects } from '../../store/selectors';
import { isImage, isLine } from '../../types/guards';
import type { StrokeStyle, LineType } from '../../types/scene';
import { executeBackgroundRemoval } from '../../ai/bgRemoval';
import { useVariantStore } from '../../store/variantStore';

export function ObjectPropertiesPanel() {
  const isOpen = useSceneStore((state) => state.ui.propertiesOpen);
  const toggleOpen = useSceneStore((state) => state.toggleProperties);

  const selectedObjects = useSelectedObjects();
  const singleObject = useSingleSelectedObject();

  // Store action hooks
  const updateObject = useSceneStore((state) => state.updateObject);
  const resizeObject = useSceneStore((state) => state.resizeObject);
  const setRotation = useSceneStore((state) => state.setRotation);
  const setOpacity = useSceneStore((state) => state.setOpacity);
  const flipObjects = useSceneStore((state) => state.flipObjects);
  const duplicateObjects = useSceneStore((state) => state.duplicateObjects);
  const removeObjects = useSceneStore((state) => state.removeObjects);
  const bringToFront = useSceneStore((state) => state.bringToFront);
  const sendToBack = useSceneStore((state) => state.sendToBack);
  const bringForward = useSceneStore((state) => state.bringForward);
  const sendBackward = useSceneStore((state) => state.sendBackward);
  const groupSelected = useSceneStore((state) => state.groupSelected);
  const ungroupSelected = useSceneStore((state) => state.ungroupSelected);
  const setActiveDialog = useSceneStore((state) => state.setActiveDialog);
  const setToolMode = useSceneStore((state) => state.setToolMode);

  const [bgThreshold, setBgThreshold] = useState(40);
  const [isRemovingBg, setIsRemovingBg] = useState(false);
  const bgVariant = useVariantStore((state) => state.variants.bgRemoval);

  if (selectedObjects.length === 0) {
    return null;
  }

  const panelTitle = singleObject
    ? isImage(singleObject)
      ? 'Image Properties'
      : 'Vector Properties'
    : `${selectedObjects.length} Objects Selected`;

  if (!isOpen) {
    return (
      <button
        onClick={() => toggleOpen(true)}
        className="glass pointer-events-auto self-end apple-btn flex items-center gap-1.5 px-3 py-1.5 text-xs shadow-md flex-shrink-0"
        title={`Open ${panelTitle}`}
        aria-label="Open Properties Inspector"
      >
        <Sliders size={14} className="text-accent" />
        <span>{panelTitle}</span>
      </button>
    );
  }

  const selectedIds = selectedObjects.map((o) => o.id);

  return (
    <aside
      className="glass pointer-events-auto flex w-72 flex-col min-h-0 flex-[1.25] overflow-hidden rounded-[var(--radius)] shadow-xl text-xs"
      aria-label="Properties Inspector"
    >
      {/* Panel header */}
      <div className="flex items-center justify-between border-b border-[var(--border)] px-3 py-2.5 flex-shrink-0">
        <div className="flex items-center gap-2 font-semibold">
          <Sliders size={14} className="text-accent" />
          <span>{panelTitle}</span>
        </div>
        <button
          onClick={() => toggleOpen(false)}
          className="apple-btn apple-btn-ghost apple-btn-icon h-6 w-6"
          title="Collapse Properties Panel"
          aria-label="Collapse Properties Panel"
        >
          <ChevronRight size={14} />
        </button>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-4 overscroll-contain pb-8">
        {/* CASE 1: Single Object Selected */}
        {singleObject && (
          <>
            {/* Dimensions and Position */}
            <div className="space-y-2">
              <label className="text-[11px] font-semibold text-fg-muted uppercase tracking-wider">
                Transform
              </label>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <span className="text-[10px] text-fg-muted">W (px)</span>
                  <input
                    type="number"
                    value={Math.round(singleObject.width)}
                    onChange={(e) =>
                      resizeObject(singleObject.id, {
                        x: singleObject.x,
                        y: singleObject.y,
                        width: Math.max(20, Number(e.target.value)),
                        height: singleObject.height,
                      })
                    }
                    className="apple-input w-full mt-0.5 text-xs py-1"
                  />
                </div>
                <div>
                  <span className="text-[10px] text-fg-muted">H (px)</span>
                  <input
                    type="number"
                    value={Math.round(singleObject.height)}
                    onChange={(e) =>
                      resizeObject(singleObject.id, {
                        x: singleObject.x,
                        y: singleObject.y,
                        width: singleObject.width,
                        height: Math.max(20, Number(e.target.value)),
                      })
                    }
                    className="apple-input w-full mt-0.5 text-xs py-1"
                  />
                </div>
              </div>

              <button
                type="button"
                onClick={() => setActiveDialog('precision-object-sizing')}
                className="apple-btn apple-btn-secondary w-full flex items-center justify-center gap-1.5 py-1 text-[11px] mt-1"
                title="Precision Sizing Dialog (Presets, Units, Aspect Lock)"
              >
                <Maximize2 size={12} className="text-accent" />
                <span>Precision Sizing...</span>
              </button>

              {/* Rotation */}
              <div className="pt-2">
                <div className="flex items-center justify-between text-[11px] mb-1">
                  <span className="text-fg-muted">Rotation</span>
                  <div className="flex items-center gap-1 font-mono">
                    <span>{Math.round(singleObject.rotation || 0)}°</span>
                    <button
                      className="apple-btn apple-btn-ghost apple-btn-icon h-5 w-5"
                      onClick={() => setRotation(singleObject.id, 0)}
                      title="Reset rotation to 0°"
                    >
                      <RotateCcw size={11} />
                    </button>
                  </div>
                </div>
                <input
                  type="range"
                  min="-180"
                  max="180"
                  value={singleObject.rotation || 0}
                  onChange={(e) => setRotation(singleObject.id, Number(e.target.value))}
                  className="w-full accent-accent"
                />
              </div>

              {/* Opacity */}
              <div className="pt-2">
                <div className="flex items-center justify-between text-[11px] mb-1">
                  <span className="text-fg-muted">Opacity</span>
                  <span className="font-mono">{Math.round((singleObject.opacity ?? 1) * 100)}%</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  value={singleObject.opacity ?? 1}
                  onChange={(e) => setOpacity([singleObject.id], Number(e.target.value))}
                  className="w-full accent-accent"
                />
              </div>
            </div>

            {/* Image Cropping & AI Background Removal */}
            {isImage(singleObject) && (
              <div className="space-y-3 border-t border-[var(--border)] pt-3">
                {/* Cropping suite */}
                <div>
                  <label className="text-[11px] font-semibold text-fg-muted uppercase tracking-wider block mb-1.5">
                    Cropping Suite
                  </label>
                  <div className="grid grid-cols-3 gap-1">
                    <button
                      type="button"
                      onClick={() => setToolMode('crop_rect')}
                      className="apple-btn apple-btn-secondary flex flex-col items-center justify-center py-1.5 gap-1 text-[10px]"
                      title="Rectangle Crop"
                    >
                      <Crop size={14} className="text-accent" />
                      <span>Rect</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setToolMode('crop_freeform')}
                      className="apple-btn apple-btn-secondary flex flex-col items-center justify-center py-1.5 gap-1 text-[10px]"
                      title="Freeform Lasso Crop"
                    >
                      <Scissors size={14} className="text-amber-500" />
                      <span>Lasso</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setToolMode('crop_magnetic')}
                      className="apple-btn apple-btn-secondary flex flex-col items-center justify-center py-1.5 gap-1 text-[10px]"
                      title="Intelligent Scissors (Magnetic Edge Snapping)"
                    >
                      <Sparkles size={14} className="text-purple-500" />
                      <span>Magnetic</span>
                    </button>
                  </div>
                </div>

                {/* AI Background Removal */}
                <div className="pt-1">
                  <div className="flex items-center justify-between text-[11px] mb-1.5">
                    <span className="font-semibold text-fg-muted uppercase tracking-wider text-[10px]">
                      Background Removal
                    </span>
                    <span className="apple-badge text-[9px] px-1.5 py-0.5 rounded bg-accent/15 text-accent font-medium">
                      {bgVariant === 'neural' ? 'AI Neural' : 'Heuristic'}
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-[11px] mb-1">
                    <span className="text-fg-muted">Color Tolerance</span>
                    <span className="font-mono text-[10px]">{bgThreshold}</span>
                  </div>
                  <input
                    type="range"
                    min="5"
                    max="150"
                    value={bgThreshold}
                    onChange={(e) => setBgThreshold(Number(e.target.value))}
                    className="w-full accent-accent mb-2"
                  />

                  <button
                    type="button"
                    disabled={isRemovingBg}
                    onClick={async () => {
                      setIsRemovingBg(true);
                      try {
                        await executeBackgroundRemoval(singleObject, {
                          threshold: bgThreshold,
                        });
                      } finally {
                        setIsRemovingBg(false);
                      }
                    }}
                    className="apple-btn bg-accent hover:bg-accent/90 text-white w-full flex items-center justify-center gap-1.5 py-1.5 text-[11px] font-medium shadow-sm transition-all"
                  >
                    <Wand2 size={13} className={isRemovingBg ? 'animate-spin' : ''} />
                    <span>{isRemovingBg ? 'Removing...' : 'Remove Background'}</span>
                  </button>
                </div>
              </div>
            )}

            {/* If Line: Stroke, Arrowheads, Roughness */}
            {isLine(singleObject) && (
              <div className="space-y-3 border-t border-[var(--border)] pt-3">
                <label className="text-[11px] font-semibold text-fg-muted uppercase tracking-wider">
                  Line Style
                </label>
                <div className="flex items-center justify-between">
                  <span>Color</span>
                  <input
                    type="color"
                    value={singleObject.strokeColor || '#3b82f6'}
                    onChange={(e) =>
                      updateObject(singleObject.id, { strokeColor: e.target.value }, 'Line Color')
                    }
                    className="h-6 w-10 cursor-pointer rounded border border-[var(--border)]"
                  />
                </div>

                <div className="flex items-center justify-between">
                  <span>Width</span>
                  <div className="flex items-center gap-2">
                    <input
                      type="range"
                      min="1"
                      max="20"
                      value={singleObject.strokeWidth || 2}
                      onChange={(e) =>
                        updateObject(
                          singleObject.id,
                          { strokeWidth: Number(e.target.value) },
                          'Stroke Width'
                        )
                      }
                      className="w-20 accent-accent"
                    />
                    <span className="font-mono w-6 text-right">{singleObject.strokeWidth || 2}px</span>
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <span>Style</span>
                  <select
                    value={singleObject.strokeStyle || 'solid'}
                    onChange={(e) =>
                      updateObject(
                        singleObject.id,
                        { strokeStyle: e.target.value as StrokeStyle },
                        'Stroke Style'
                      )
                    }
                    className="apple-input text-xs py-1"
                  >
                    <option value="solid">Solid</option>
                    <option value="dashed">Dashed</option>
                    <option value="dotted">Dotted</option>
                  </select>
                </div>

                <div className="flex items-center justify-between">
                  <span>Routing</span>
                  <select
                    value={singleObject.lineType || 'straight'}
                    onChange={(e) =>
                      updateObject(
                        singleObject.id,
                        { lineType: e.target.value as LineType },
                        'Line Type'
                      )
                    }
                    className="apple-input text-xs py-1"
                  >
                    <option value="straight">Straight</option>
                    <option value="curve">Curve</option>
                    <option value="elbow">Elbow (90°)</option>
                  </select>
                </div>
              </div>
            )}

            {/* Quick Actions (Flip, Z-Order, Duplicate, Delete) */}
            <div className="space-y-2 border-t border-[var(--border)] pt-3">
              <label className="text-[11px] font-semibold text-fg-muted uppercase tracking-wider">
                Actions
              </label>
              <div className="grid grid-cols-2 gap-1.5">
                <button
                  className="apple-btn apple-btn-ghost justify-center gap-1.5 py-1 text-xs"
                  onClick={() => flipObjects([singleObject.id], true, false)}
                  title="Flip Horizontal"
                >
                  <FlipHorizontal size={14} /> Flip H
                </button>
                <button
                  className="apple-btn apple-btn-ghost justify-center gap-1.5 py-1 text-xs"
                  onClick={() => flipObjects([singleObject.id], false, true)}
                  title="Flip Vertical"
                >
                  <FlipVertical size={14} /> Flip V
                </button>
              </div>

              {/* Layer Ordering */}
              <div className="grid grid-cols-4 gap-1 pt-1">
                <button
                  className="apple-btn apple-btn-ghost justify-center p-1"
                  onClick={() => bringToFront([singleObject.id])}
                  title="Bring to Front"
                >
                  <ArrowUpToLine size={14} />
                </button>
                <button
                  className="apple-btn apple-btn-ghost justify-center p-1"
                  onClick={() => bringForward([singleObject.id])}
                  title="Bring Forward"
                >
                  <ChevronUp size={14} />
                </button>
                <button
                  className="apple-btn apple-btn-ghost justify-center p-1"
                  onClick={() => sendBackward([singleObject.id])}
                  title="Send Backward"
                >
                  <ChevronDown size={14} />
                </button>
                <button
                  className="apple-btn apple-btn-ghost justify-center p-1"
                  onClick={() => sendToBack([singleObject.id])}
                  title="Send to Back"
                >
                  <ArrowDownToLine size={14} />
                </button>
              </div>

              {/* Duplicate & Delete */}
              <div className="grid grid-cols-2 gap-1.5 pt-1">
                <button
                  className="apple-btn apple-btn-ghost justify-center gap-1.5 py-1 text-xs"
                  onClick={() => duplicateObjects([singleObject.id])}
                >
                  <Copy size={13} /> Duplicate
                </button>
                <button
                  className="apple-btn apple-btn-ghost justify-center gap-1.5 py-1 text-xs text-rose-500 hover:text-rose-600"
                  onClick={() => removeObjects([singleObject.id])}
                >
                  <Trash2 size={13} /> Delete
                </button>
              </div>
            </div>
          </>
        )}

        {/* CASE 2: Multiple Objects Selected */}
        {selectedObjects.length > 1 && (
          <div className="space-y-4">
            <div className="rounded-lg bg-[var(--surface)] p-2.5 text-center">
              <span className="font-semibold text-accent">{selectedObjects.length}</span> elements
              selected
            </div>

            <div className="space-y-2">
              <label className="text-[11px] font-semibold text-fg-muted uppercase tracking-wider">
                Group &amp; Arrange
              </label>
              <div className="grid grid-cols-2 gap-1.5">
                <button
                  className="apple-btn justify-center gap-1.5 py-1 text-xs"
                  onClick={groupSelected}
                  title="Group Selection (Ctrl+G)"
                >
                  <Group size={14} /> Group
                </button>
                <button
                  className="apple-btn apple-btn-ghost justify-center gap-1.5 py-1 text-xs"
                  onClick={ungroupSelected}
                  title="Ungroup Selection (Ctrl+Shift+G)"
                >
                  <Ungroup size={14} /> Ungroup
                </button>
              </div>

              <div className="grid grid-cols-2 gap-1.5 pt-1">
                <button
                  className="apple-btn apple-btn-ghost justify-center gap-1.5 py-1 text-xs"
                  onClick={() => flipObjects(selectedIds, true, false)}
                >
                  <FlipHorizontal size={14} /> Flip H
                </button>
                <button
                  className="apple-btn apple-btn-ghost justify-center gap-1.5 py-1 text-xs"
                  onClick={() => flipObjects(selectedIds, false, true)}
                >
                  <FlipVertical size={14} /> Flip V
                </button>
              </div>

              <div className="grid grid-cols-2 gap-1.5 pt-1">
                <button
                  className="apple-btn apple-btn-ghost justify-center gap-1.5 py-1 text-xs"
                  onClick={() => duplicateObjects(selectedIds)}
                >
                  <Copy size={13} /> Duplicate
                </button>
                <button
                  className="apple-btn apple-btn-ghost justify-center gap-1.5 py-1 text-xs text-rose-500 hover:text-rose-600"
                  onClick={() => removeObjects(selectedIds)}
                >
                  <Trash2 size={13} /> Delete
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </aside>
  );
}
