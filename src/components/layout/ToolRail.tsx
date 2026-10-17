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
} from 'lucide-react';
import { useSceneStore } from '../../store/sceneStore';
import type { ToolMode } from '../../types/scene';
import { generateId } from '../../lib/id';
import { db } from '../../db/db';
import { assetCache } from '../../canvas/assetCache';

export function ToolRail() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const tool = useSceneStore((state) => state.tool);
  const setToolMode = useSceneStore((state) => state.setToolMode);
  const setToolLocked = useSceneStore((state) => state.setToolLocked);
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

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      try {
        const assetId = generateId();
        const bitmap = await createImageBitmap(file);

        // Store asset in Dexie
        await db.assets.put({
          id: assetId,
          workspaceId: 'default',
          mimeType: file.type || 'image/png',
          blob: file,
          width: bitmap.width,
          height: bitmap.height,
          createdAt: Date.now(),
        });

        // Cache decoded bitmap
        assetCache.setBitmap(assetId, bitmap);

        // Position on canvas
        const viewport = useSceneStore.getState().viewport;
        const cx =
          viewport.workMode === 'unlimited'
            ? -viewport.ulPanX / viewport.ulZoom + 200 + i * 30
            : 100 + i * 30;
        const cy =
          viewport.workMode === 'unlimited'
            ? -viewport.ulPanY / viewport.ulZoom + 150 + i * 30
            : 100 + i * 30;

        // Scale to reasonable default width (max 500px)
        const maxWidth = 500;
        const scale = bitmap.width > maxWidth ? maxWidth / bitmap.width : 1;
        const width = Math.round(bitmap.width * scale);
        const height = Math.round(bitmap.height * scale);

        addObject(
          {
            id: generateId(),
            type: 'image',
            assetId,
            x: cx,
            y: cy,
            width,
            height,
            origWidth: bitmap.width,
            origHeight: bitmap.height,
            mimeType: file.type || 'image/png',
            groupId: null,
            opacity: 1,
            rotation: 0,
            flipH: false,
            flipV: false,
          },
          'Import Image'
        );

        showToast(`Imported ${file.name}`, 'success');
      } catch (err) {
        console.error('Failed to import image:', err);
        showToast(`Failed to import ${file.name}`, 'error');
      }
    }

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

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*,.jxl,.tiff"
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
