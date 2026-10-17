import {
  Frame,
  Infinity as InfinityIcon,
  Layers,
  Moon,
  Palette,
  Redo2,
  Sun,
  Undo2,
  HelpCircle,
} from 'lucide-react';
import { useSceneStore } from '../../store/sceneStore';
import { useTheme } from '../../hooks/useTheme';

interface TopBarProps {
  onOpenTheme: () => void;
  onOpenShortcuts: () => void;
}

export function TopBar({ onOpenTheme, onOpenShortcuts }: TopBarProps) {
  const { mode, toggle } = useTheme();
  const workMode = useSceneStore((state) => state.viewport.workMode);
  const setWorkMode = useSceneStore((state) => state.setWorkMode);
  const { canUndo, canRedo, undoLabel, redoLabel } = useSceneStore(
    (state) => state.historyState
  );
  const undo = useSceneStore((state) => state.undo);
  const redo = useSceneStore((state) => state.redo);

  return (
    <header className="glass relative z-20 m-2 flex items-center justify-between gap-3 rounded-[var(--radius)] px-4 py-2">
      {/* Left branding */}
      <div className="flex items-center gap-3">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent text-white shadow-sm">
          <Layers size={17} />
        </div>
        <div className="leading-tight">
          <div className="text-sm font-semibold tracking-tight">Free-Form Collage Studio</div>
          <div className="text-[11px] text-fg-muted">Offline-first Visual Canvas</div>
        </div>

        {/* Undo / Redo controls */}
        <div className="ml-3 flex items-center gap-1 border-l border-[var(--border)] pl-3">
          <button
            className="apple-btn apple-btn-ghost apple-btn-icon"
            onClick={undo}
            disabled={!canUndo}
            title={undoLabel ? `Undo ${undoLabel} (Ctrl+Z)` : 'Undo (Ctrl+Z)'}
            aria-label="Undo"
          >
            <Undo2 size={16} />
          </button>
          <button
            className="apple-btn apple-btn-ghost apple-btn-icon"
            onClick={redo}
            disabled={!canRedo}
            title={redoLabel ? `Redo ${redoLabel} (Ctrl+Y)` : 'Redo (Ctrl+Y)'}
            aria-label="Redo"
          >
            <Redo2 size={16} />
          </button>
        </div>
      </div>

      {/* Center Dual-Engine Mode Switcher */}
      <div className="segmented" role="group" aria-label="Workspace Engine">
        <button
          aria-pressed={workMode === 'unlimited'}
          onClick={() => setWorkMode('unlimited')}
          title="Infinite Whiteboard for Collaging & Moodboards"
        >
          <span className="inline-flex items-center gap-1.5">
            <InfinityIcon size={14} /> Creation
          </span>
        </button>
        <button
          aria-pressed={workMode === 'standard'}
          onClick={() => setWorkMode('standard')}
          title="Bounded Stage for Precision Framing & Multi-Format Export"
        >
          <span className="inline-flex items-center gap-1.5">
            <Frame size={14} /> Framing &amp; Export
          </span>
        </button>
      </div>

      {/* Right controls */}
      <div className="flex items-center gap-1.5">
        <button
          className="apple-btn apple-btn-ghost apple-btn-icon"
          onClick={onOpenShortcuts}
          title="Keyboard Shortcuts (?)"
          aria-label="Keyboard Shortcuts"
        >
          <HelpCircle size={16} />
        </button>

        <button
          className="apple-btn apple-btn-ghost apple-btn-icon"
          onClick={toggle}
          aria-label={`Switch to ${mode === 'dark' ? 'light' : 'dark'} mode`}
          title="Toggle dark / light"
        >
          {mode === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
        </button>

        <button className="apple-btn" onClick={onOpenTheme}>
          <Palette size={14} /> Settings
        </button>
      </div>
    </header>
  );
}
