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
  ArrowDownUp,
  ArrowLeftRight,
  Rows3,
  Columns3,
  Maximize2,
} from 'lucide-react';
import { useSceneStore } from '../../store/sceneStore';
import { useSingleSelectedObject, useSelectedObjects } from '../../store/selectors';
import { isImage, isLine } from '../../types/guards';
import type { StrokeStyle, LineType } from '../../types/scene';
import { PrecisionSizingPanel } from '../framing/PrecisionSizingPanel';

export function Inspector() {
  const isOpen = useSceneStore((state) => state.ui.propertiesOpen);
  const toggleOpen = useSceneStore((state) => state.toggleProperties);

  const selectedObjects = useSelectedObjects();
  const singleObject = useSingleSelectedObject();

  const viewport = useSceneStore((state) => state.viewport);
  const settings = useSceneStore((state) => state.settings);
  const updateSettings = useSceneStore((state) => state.updateSettings);
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
  const restackVertically = useSceneStore((state) => state.restackVertically);
  const restackHorizontally = useSceneStore((state) => state.restackHorizontally);
  const setSpacing = useSceneStore((state) => state.setSpacing);
  const setHorizontalSpacing = useSceneStore((state) => state.setHorizontalSpacing);
  const setActiveDialog = useSceneStore((state) => state.setActiveDialog);
  const beginTransaction = useSceneStore((state) => state.beginTransaction);
  const commitTransaction = useSceneStore((state) => state.commitTransaction);

  if (!isOpen) {
    return (
      <button
        onClick={() => toggleOpen(true)}
        className="glass absolute left-3 top-3 z-20 apple-btn apple-btn-icon shadow-md"
        title="Open Canvas & Layout / Properties"
        aria-label="Open Properties Inspector"
      >
        <ChevronRight size={16} />
      </button>
    );
  }

  const selectedIds = selectedObjects.map((o) => o.id);

  return (
    <aside
      className="glass absolute left-3 top-3 z-20 flex w-72 flex-col max-h-[calc(100vh-2.5rem)] overflow-hidden rounded-[var(--radius)] shadow-xl text-xs"
      aria-label="Properties Inspector"
    >
      {/* Panel header */}
      <div className="flex items-center justify-between border-b border-[var(--border)] px-4 py-2.5 flex-shrink-0">
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
          <ChevronLeft size={14} />
        </button>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-4 overscroll-contain pb-12">
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
              <PrecisionSizingPanel />
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

              {/* Layout & Auto-Resize */}
              <div className="space-y-3 border-t border-[var(--border)] pt-3">
                <label className="text-[11px] font-semibold text-fg-muted uppercase tracking-wider">
                  Layout &amp; Auto-Resize
                </label>

                <div>
                  <span className="text-[10px] text-fg-muted block mb-1">Import Auto-Resize</span>
                  <select
                    value={settings.resizeMode}
                    onChange={(e) =>
                      updateSettings({
                        resizeMode: e.target.value as 'none' | 'widest' | 'narrowest',
                      })
                    }
                    className="apple-input w-full text-xs py-1"
                  >
                    <option value="none">Original Size (No Resize)</option>
                    <option value="widest">Match Widest Image</option>
                    <option value="narrowest">Match Narrowest Image</option>
                  </select>
                </div>

                {/* Vertical Proximity Spacing Slider */}
                <div>
                  <div className="flex items-center justify-between text-[11px] mb-1">
                    <span className="text-fg-muted flex items-center gap-1">
                      <Rows3 size={12} /> Vertical Spacing
                    </span>
                    <div className="flex items-center gap-1">
                      <input
                        type="number"
                        min="0"
                        max="200"
                        value={settings.spacing}
                        onChange={(e) => {
                          const val = Math.max(0, Math.min(200, Number(e.target.value)));
                          beginTransaction('Change Vertical Spacing');
                          setSpacing(val);
                          commitTransaction();
                        }}
                        className="apple-input w-12 text-[11px] py-0.5 px-1 text-right font-mono"
                      />
                      <span className="text-fg-muted text-[10px]">px</span>
                    </div>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="200"
                    value={settings.spacing}
                    onPointerDown={() => beginTransaction('Change Vertical Spacing')}
                    onChange={(e) => setSpacing(Number(e.target.value))}
                    onPointerUp={() => commitTransaction()}
                    className="w-full accent-accent"
                  />
                </div>

                {/* Horizontal Proximity Spacing Slider */}
                <div>
                  <div className="flex items-center justify-between text-[11px] mb-1">
                    <span className="text-fg-muted flex items-center gap-1">
                      <Columns3 size={12} /> Horizontal Spacing
                    </span>
                    <div className="flex items-center gap-1">
                      <input
                        type="number"
                        min="0"
                        max="200"
                        value={settings.horizontalSpacing}
                        onChange={(e) => {
                          const val = Math.max(0, Math.min(200, Number(e.target.value)));
                          beginTransaction('Change Horizontal Spacing');
                          setHorizontalSpacing(val);
                          commitTransaction();
                        }}
                        className="apple-input w-12 text-[11px] py-0.5 px-1 text-right font-mono"
                      />
                      <span className="text-fg-muted text-[10px]">px</span>
                    </div>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="200"
                    value={settings.horizontalSpacing}
                    onPointerDown={() => beginTransaction('Change Horizontal Spacing')}
                    onChange={(e) => setHorizontalSpacing(Number(e.target.value))}
                    onPointerUp={() => commitTransaction()}
                    className="w-full accent-accent"
                  />
                </div>

                {/* Re-Stack Commands */}
                <div className="grid grid-cols-2 gap-1.5 pt-1">
                  <button
                    className="apple-btn apple-btn-ghost justify-center gap-1 py-1 text-[11px]"
                    onClick={restackVertically}
                    title="Re-Stack Vertically (top-to-bottom)"
                  >
                    <ArrowDownUp size={12} /> Stack Vert
                  </button>
                  <button
                    className="apple-btn apple-btn-ghost justify-center gap-1 py-1 text-[11px]"
                    onClick={restackHorizontally}
                    title="Re-Stack Horizontally (left-to-right)"
                  >
                    <ArrowLeftRight size={12} /> Stack Horiz
                  </button>
                </div>
              </div>

              {/* Snapping & Guidelines */}
              <div className="space-y-2 border-t border-[var(--border)] pt-3">
                <div className="flex items-center justify-between">
                  <span>Snapping Guides</span>
                  <input
                    type="checkbox"
                    checked={settings.isSnapping}
                    onChange={(e) => updateSettings({ isSnapping: e.target.checked })}
                    className="accent-accent"
                  />
                </div>
                <div className="flex items-center justify-between">
                  <span>Resize Snapping</span>
                  <input
                    type="checkbox"
                    checked={settings.isResizeSnapping}
                    onChange={(e) => updateSettings({ isResizeSnapping: e.target.checked })}
                    className="accent-accent"
                  />
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </aside>
  );
}
