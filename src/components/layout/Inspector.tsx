import {
  ChevronRight,
  ChevronLeft,
  Sliders,
  ArrowDownUp,
  ArrowLeftRight,
  Rows3,
  Columns3,
} from 'lucide-react';
import { useSceneStore } from '../../store/sceneStore';
import { PrecisionSizingPanel } from '../framing/PrecisionSizingPanel';

export function Inspector() {
  const isOpen = useSceneStore((state) => state.ui.canvasOpen);
  const toggleOpen = useSceneStore((state) => state.toggleCanvas);

  const viewport = useSceneStore((state) => state.viewport);
  const settings = useSceneStore((state) => state.settings);
  const updateSettings = useSceneStore((state) => state.updateSettings);
  const setUnlimitedTheme = useSceneStore((state) => state.setUnlimitedTheme);

  // Store action hooks
  const restackVertically = useSceneStore((state) => state.restackVertically);
  const restackHorizontally = useSceneStore((state) => state.restackHorizontally);
  const setSpacing = useSceneStore((state) => state.setSpacing);
  const setHorizontalSpacing = useSceneStore((state) => state.setHorizontalSpacing);
  const beginTransaction = useSceneStore((state) => state.beginTransaction);
  const commitTransaction = useSceneStore((state) => state.commitTransaction);

  if (!isOpen) {
    return (
      <button
        onClick={() => toggleOpen(true)}
        className="glass absolute left-3 top-3 z-20 apple-btn flex items-center gap-1.5 px-3 py-1.5 text-xs shadow-md"
        title="Open Canvas & Layout"
        aria-label="Open Canvas & Layout"
      >
        <Sliders size={14} className="text-accent" />
        <span>Canvas &amp; Layout</span>
        <ChevronRight size={14} />
      </button>
    );
  }

  return (
    <aside
      className="glass absolute left-3 top-3 z-20 flex w-72 flex-col max-h-[calc(100vh-4.5rem)] overflow-hidden rounded-[var(--radius)] shadow-xl text-xs"
      aria-label="Canvas & Layout"
    >
      {/* Panel header */}
      <div className="flex items-center justify-between border-b border-[var(--border)] px-4 py-2.5 flex-shrink-0">
        <div className="flex items-center gap-2 font-semibold">
          <Sliders size={14} className="text-accent" />
          <span>Canvas &amp; Layout</span>
        </div>
        <button
          onClick={() => toggleOpen(false)}
          className="apple-btn apple-btn-ghost apple-btn-icon h-6 w-6"
          title="Collapse Canvas & Layout"
          aria-label="Collapse Canvas & Layout"
        >
          <ChevronLeft size={14} />
        </button>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-4 overscroll-contain pb-12">
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
      </div>
    </aside>
  );
}
