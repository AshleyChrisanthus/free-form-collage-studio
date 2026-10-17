import {
  ChevronRight,
  ChevronLeft,
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
} from 'lucide-react';
import { useSceneStore } from '../../store/sceneStore';
import { useSingleSelectedObject, useSelectedObjects } from '../../store/selectors';
import { isImage, isLine } from '../../types/guards';
import type { CanvasPreset, StrokeStyle, LineType } from '../../types/scene';

export function Inspector() {
  const isOpen = useSceneStore((state) => state.ui.propertiesOpen);
  const toggleOpen = useSceneStore((state) => state.toggleProperties);

  const selectedObjects = useSelectedObjects();
  const singleObject = useSingleSelectedObject();

  const viewport = useSceneStore((state) => state.viewport);
  const settings = useSceneStore((state) => state.settings);
  const updateSettings = useSceneStore((state) => state.updateSettings);
  const setCanvasPreset = useSceneStore((state) => state.setCanvasPreset);
  const setCanvasLock = useSceneStore((state) => state.setCanvasLock);
  const setUnlimitedTheme = useSceneStore((state) => state.setUnlimitedTheme);

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

  if (!isOpen) {
    return (
      <button
        onClick={() => toggleOpen(true)}
        className="glass absolute right-3 top-16 z-20 apple-btn apple-btn-icon shadow-md"
        title="Open Properties Inspector"
        aria-label="Open Properties Inspector"
      >
        <ChevronLeft size={16} />
      </button>
    );
  }

  const selectedIds = selectedObjects.map((o) => o.id);

  return (
    <aside
      className="glass absolute right-3 top-16 z-20 flex w-72 flex-col max-h-[calc(100vh-5.5rem)] overflow-hidden rounded-[var(--radius)] shadow-xl text-xs"
      aria-label="Properties Inspector"
    >
      {/* Panel header */}
      <div className="flex items-center justify-between border-b border-[var(--border)] px-4 py-2.5">
        <div className="flex items-center gap-2 font-semibold">
          <Sliders size={14} className="text-accent" />
          <span>
            {singleObject
              ? isImage(singleObject)
                ? 'Image Properties'
                : 'Vector Properties'
              : selectedObjects.length > 1
              ? `${selectedObjects.length} Objects Selected`
              : 'Canvas & Layout'}
          </span>
        </div>
        <button
          onClick={() => toggleOpen(false)}
          className="apple-btn apple-btn-ghost apple-btn-icon h-6 w-6"
          title="Collapse Inspector"
          aria-label="Collapse Inspector"
        >
          <ChevronRight size={14} />
        </button>
      </div>

      <div className="overflow-y-auto p-4 space-y-4">
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

        {/* CASE 3: Nothing Selected -> Canvas & Layout Settings */}
        {selectedObjects.length === 0 && (
          <div className="space-y-4">
            {/* Engine Theme */}
            {viewport.workMode === 'unlimited' ? (
              <div className="space-y-2">
                <label className="text-[11px] font-semibold text-fg-muted uppercase tracking-wider">
                  Whiteboard Backdrop
                </label>
                <div className="segmented w-full grid grid-cols-2 gap-1">
                  <button
                    aria-pressed={viewport.unlimitedTheme === 'dark'}
                    onClick={() => setUnlimitedTheme('dark')}
                  >
                    Dark Slate
                  </button>
                  <button
                    aria-pressed={viewport.unlimitedTheme === 'light'}
                    onClick={() => setUnlimitedTheme('light')}
                  >
                    Light Canvas
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                <label className="text-[11px] font-semibold text-fg-muted uppercase tracking-wider">
                  Framing Stage Presets
                </label>
                <select
                  value={viewport.canvasMode}
                  onChange={(e) => setCanvasPreset(e.target.value as CanvasPreset)}
                  className="apple-input w-full text-xs py-1"
                >
                  <option value="auto">Auto (Wrap to content)</option>
                  <option value="1:1">1:1 Square (1080 × 1080)</option>
                  <option value="16:9">16:9 Landscape (1920 × 1080)</option>
                  <option value="9:16">9:16 Story / Reel (1080 × 1920)</option>
                  <option value="4:3">4:3 Standard (1440 × 1080)</option>
                  <option value="3:4">3:4 Portrait (1080 × 1440)</option>
                  <option value="custom">Custom Dimensions</option>
                </select>

                <div className="flex items-center justify-between pt-1">
                  <span>Lock Canvas Size</span>
                  <input
                    type="checkbox"
                    checked={viewport.canvasLocked}
                    onChange={(e) => setCanvasLock(e.target.checked)}
                    className="accent-accent"
                  />
                </div>
              </div>
            )}

            {/* Canvas Global Settings */}
            <div className="space-y-3 border-t border-[var(--border)] pt-3">
              <label className="text-[11px] font-semibold text-fg-muted uppercase tracking-wider">
                Export &amp; Spacing
              </label>

              <div className="flex items-center justify-between">
                <span>Background Color</span>
                <input
                  type="color"
                  value={settings.bgColor}
                  onChange={(e) => updateSettings({ bgColor: e.target.value })}
                  className="h-6 w-10 cursor-pointer rounded border border-[var(--border)]"
                />
              </div>

              <div className="flex items-center justify-between">
                <span>Transparent BG</span>
                <input
                  type="checkbox"
                  checked={settings.transparentBg}
                  onChange={(e) => updateSettings({ transparentBg: e.target.checked })}
                  className="accent-accent"
                />
              </div>

              <div>
                <div className="flex items-center justify-between text-[11px] mb-1">
                  <span className="text-fg-muted">Stack Gap (px)</span>
                  <span className="font-mono">{settings.spacing}px</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={settings.spacing}
                  onChange={(e) => updateSettings({ spacing: Number(e.target.value) })}
                  className="w-full accent-accent"
                />
              </div>

              <div className="flex items-center justify-between pt-1">
                <span>Snapping Guides</span>
                <input
                  type="checkbox"
                  checked={settings.isSnapping}
                  onChange={(e) => updateSettings({ isSnapping: e.target.checked })}
                  className="accent-accent"
                />
              </div>
            </div>
          </div>
        )}
      </div>
    </aside>
  );
}
