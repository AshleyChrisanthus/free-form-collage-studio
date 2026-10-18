import { useRef } from 'react';
import {
  ArrowRight,
  Crop,
  Hand,
  ImagePlus,
  Lock,
  LockOpen,
  MousePointer,
  Minus,
  Layers,
} from 'lucide-react';
import { useSceneStore } from '../../store/sceneStore';
import type { ToolMode } from '../../types/scene';
import { ingestFiles } from '../../import/ingest';

export function ToolRail() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const tool = useSceneStore((state) => state.tool);
  const setToolMode = useSceneStore((state) => state.setToolMode);
  const setToolLocked = useSceneStore((state) => state.setToolLocked);
  const layersOpen = useSceneStore((state) => state.ui.layersOpen);
  const toggleLayers = useSceneStore((state) => state.toggleLayers);
  const addObject = useSceneStore((state) => state.addObject);
  const showToast = useSceneStore((state) => state.showToast);

  const tools: Array<{
    id: ToolMode;
    label: string;
    shortcut: string;
    icon: React.ReactNode;
  }> = [
    {
      id: 'select',
      label: 'Select & Transform',
      shortcut: 'V',
      icon: <MousePointer size={18} />,
    },
    {
      id: 'pan',
      label: 'Pan Canvas',
      shortcut: 'Space / H',
      icon: <Hand size={18} />,
    },
    {
      id: 'line',
      label: 'Vector Line',
      shortcut: 'L',
      icon: <Minus size={18} className="rotate-45" />,
    },
    {
      id: 'arrow',
      label: 'Vector Arrow',
      shortcut: 'A',
      icon: <ArrowRight size={18} className="-rotate-45" />,
    },
    {
      id: 'crop_rect',
      label: 'Crop Tool',
      shortcut: 'C',
      icon: <Crop size={18} />,
    },
  ];

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    await ingestFiles(Array.from(files));
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <aside
      className="glass absolute left-3 top-16 z-20 flex flex-col items-center gap-1.5 rounded-[var(--radius)] p-2"
      role="toolbar"
      aria-label="Tool Rail"
    >
      {tools.map((t) => {
        const isSelected = tool.mode === t.id;
        return (
          <button
            key={t.id}
            type="button"
            className={`apple-btn apple-btn-icon relative transition-all ${
              isSelected ? 'bg-accent text-white shadow-sm' : 'apple-btn-ghost text-fg'
            }`}
            onClick={() => setToolMode(t.id)}
            title={`${t.label} (${t.shortcut})`}
            aria-label={t.label}
            aria-pressed={isSelected}
          >
            {t.icon}
          </button>
        );
      })}

      <div className="my-1 h-px w-6 bg-[var(--border)]" />

      {/* Import File Button */}
      <button
        type="button"
        className="apple-btn apple-btn-ghost apple-btn-icon text-fg"
        onClick={() => fileInputRef.current?.click()}
        title="Import Image (File, Drag & Drop, or Paste)"
        aria-label="Import Image"
      >
        <ImagePlus size={18} />
      </button>

      {/* Layers Panel Toggle Button */}
      <button
        type="button"
        className={`apple-btn apple-btn-icon transition-all ${
          layersOpen ? 'bg-accent/20 text-accent font-semibold' : 'apple-btn-ghost text-fg'
        }`}
        onClick={() => toggleLayers()}
        title="Toggle Layers Panel"
        aria-label="Toggle Layers Panel"
      >
        <Layers size={18} />
      </button>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*,.jxl,.tif,.tiff,.avif,.svg"
        multiple
        hidden
        onChange={handleFileChange}
      />

      {/* Sticky Tool Lock Toggle */}
      <button
        type="button"
        className={`apple-btn apple-btn-icon text-xs transition-all ${
          tool.locked ? 'bg-amber-500/20 text-amber-500' : 'apple-btn-ghost text-fg-muted'
        }`}
        onClick={() => setToolLocked(!tool.locked)}
        title={
          tool.locked
            ? 'Sticky Tool Active (keeps drawing tool after completion)'
            : 'Lock Tool (auto-resets to select after drawing)'
        }
        aria-label="Toggle Sticky Tool Lock"
      >
        {tool.locked ? <Lock size={14} /> : <LockOpen size={14} />}
      </button>
    </aside>
  );
}
