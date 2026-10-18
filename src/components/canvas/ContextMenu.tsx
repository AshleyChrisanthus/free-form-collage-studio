import { useEffect, useRef } from 'react';
import {
  ArrowUpToLine,
  ArrowDownToLine,
  ChevronUp,
  ChevronDown,
  Group,
  Ungroup,
  Copy,
  Trash2,
  FlipHorizontal,
  FlipVertical,
  Maximize2,
  Lock,
  Unlock,
  Eye,
  EyeOff,
  Crop,
  Wand2,
} from 'lucide-react';
import { useSceneStore } from '../../store/sceneStore';
import { useSelectedObjects } from '../../store/selectors';
import { isImage } from '../../types/guards';
import { executeBackgroundRemoval } from '../../ai/bgRemoval';

interface ContextMenuProps {
  x: number;
  y: number;
  isOpen: boolean;
  onClose: () => void;
}

export function ContextMenu({ x, y, isOpen, onClose }: ContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);
  const selectedObjects = useSelectedObjects();
  const selection = useSceneStore((state) => state.selection);

  const bringToFront = useSceneStore((state) => state.bringToFront);
  const bringForward = useSceneStore((state) => state.bringForward);
  const sendBackward = useSceneStore((state) => state.sendBackward);
  const sendToBack = useSceneStore((state) => state.sendToBack);
  const groupSelected = useSceneStore((state) => state.groupSelected);
  const ungroupSelected = useSceneStore((state) => state.ungroupSelected);
  const duplicateObjects = useSceneStore((state) => state.duplicateObjects);
  const removeObjects = useSceneStore((state) => state.removeObjects);
  const flipObjects = useSceneStore((state) => state.flipObjects);
  const setObjectLock = useSceneStore((state) => state.setObjectLock);
  const setObjectVisibility = useSceneStore((state) => state.setObjectVisibility);
  const setActiveDialog = useSceneStore((state) => state.setActiveDialog);

  useEffect(() => {
    if (!isOpen) return;

    const handleOutsideClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };

    window.addEventListener('mousedown', handleOutsideClick);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('mousedown', handleOutsideClick);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const hasSelection = selection.length > 0;
  const canGroup = selection.length >= 2;
  const isAnyGrouped = selectedObjects.some((o) => o.groupId !== null);
  const isAllLocked = selectedObjects.length > 0 && selectedObjects.every((o) => o.locked);
  const isAllHidden = selectedObjects.length > 0 && selectedObjects.every((o) => o.hidden);

  const runAndClose = (fn: () => void) => {
    fn();
    onClose();
  };

  return (
    <div
      ref={menuRef}
      style={{ left: Math.min(x, window.innerWidth - 220), top: Math.min(y, window.innerHeight - 360) }}
      className="glass fixed z-50 w-52 rounded-[var(--radius)] border border-[var(--border)] shadow-2xl py-1 text-xs select-none animate-in fade-in zoom-in-95 duration-100"
      role="menu"
      aria-label="Context Menu"
    >
      {/* Z-Index Controls */}
      <button
        disabled={!hasSelection}
        onClick={() => runAndClose(() => bringToFront(selection))}
        className="w-full flex items-center justify-between px-3 py-1.5 hover:bg-accent/15 hover:text-accent disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-inherit text-left"
        role="menuitem"
      >
        <span className="flex items-center gap-2">
          <ArrowUpToLine size={13} />
          <span>Bring to Front</span>
        </span>
        <span className="text-[10px] text-fg-muted font-mono">]</span>
      </button>

      <button
        disabled={!hasSelection}
        onClick={() => runAndClose(() => bringForward(selection))}
        className="w-full flex items-center justify-between px-3 py-1.5 hover:bg-accent/15 hover:text-accent disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-inherit text-left"
        role="menuitem"
      >
        <span className="flex items-center gap-2">
          <ChevronUp size={13} />
          <span>Bring Forward</span>
        </span>
      </button>

      <button
        disabled={!hasSelection}
        onClick={() => runAndClose(() => sendBackward(selection))}
        className="w-full flex items-center justify-between px-3 py-1.5 hover:bg-accent/15 hover:text-accent disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-inherit text-left"
        role="menuitem"
      >
        <span className="flex items-center gap-2">
          <ChevronDown size={13} />
          <span>Send Backward</span>
        </span>
      </button>

      <button
        disabled={!hasSelection}
        onClick={() => runAndClose(() => sendToBack(selection))}
        className="w-full flex items-center justify-between px-3 py-1.5 hover:bg-accent/15 hover:text-accent disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-inherit text-left"
        role="menuitem"
      >
        <span className="flex items-center gap-2">
          <ArrowDownToLine size={13} />
          <span>Send to Back</span>
        </span>
        <span className="text-[10px] text-fg-muted font-mono">[</span>
      </button>

      <div className="my-1 border-t border-[var(--border)]" />

      {/* Grouping */}
      {isAnyGrouped ? (
        <button
          onClick={() => runAndClose(() => ungroupSelected())}
          className="w-full flex items-center justify-between px-3 py-1.5 hover:bg-accent/15 hover:text-accent text-left"
          role="menuitem"
        >
          <span className="flex items-center gap-2">
            <Ungroup size={13} />
            <span>Ungroup</span>
          </span>
          <span className="text-[10px] text-fg-muted font-mono">Ctrl+Shift+G</span>
        </button>
      ) : (
        <button
          disabled={!canGroup}
          onClick={() => runAndClose(() => groupSelected())}
          className="w-full flex items-center justify-between px-3 py-1.5 hover:bg-accent/15 hover:text-accent disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-inherit text-left"
          role="menuitem"
        >
          <span className="flex items-center gap-2">
            <Group size={13} />
            <span>Group</span>
          </span>
          <span className="text-[10px] text-fg-muted font-mono">Ctrl+G</span>
        </button>
      )}

      <div className="my-1 border-t border-[var(--border)]" />

      {/* Duplicate & Delete */}
      <button
        disabled={!hasSelection}
        onClick={() => runAndClose(() => duplicateObjects(selection))}
        className="w-full flex items-center justify-between px-3 py-1.5 hover:bg-accent/15 hover:text-accent disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-inherit text-left"
        role="menuitem"
      >
        <span className="flex items-center gap-2">
          <Copy size={13} />
          <span>Duplicate</span>
        </span>
        <span className="text-[10px] text-fg-muted font-mono">Ctrl+D</span>
      </button>

      <button
        disabled={!hasSelection}
        onClick={() => runAndClose(() => removeObjects(selection))}
        className="w-full flex items-center justify-between px-3 py-1.5 hover:bg-red-500/15 hover:text-red-400 disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-inherit text-left"
        role="menuitem"
      >
        <span className="flex items-center gap-2 text-red-400">
          <Trash2 size={13} />
          <span>Delete</span>
        </span>
        <span className="text-[10px] text-fg-muted font-mono">Del</span>
      </button>

      <div className="my-1 border-t border-[var(--border)]" />

      {/* Flips */}
      <button
        disabled={!hasSelection}
        onClick={() => runAndClose(() => flipObjects(selection, true, false))}
        className="w-full flex items-center justify-between px-3 py-1.5 hover:bg-accent/15 hover:text-accent disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-inherit text-left"
        role="menuitem"
      >
        <span className="flex items-center gap-2">
          <FlipHorizontal size={13} />
          <span>Flip Horizontal</span>
        </span>
      </button>

      <button
        disabled={!hasSelection}
        onClick={() => runAndClose(() => flipObjects(selection, false, true))}
        className="w-full flex items-center justify-between px-3 py-1.5 hover:bg-accent/15 hover:text-accent disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-inherit text-left"
        role="menuitem"
      >
        <span className="flex items-center gap-2">
          <FlipVertical size={13} />
          <span>Flip Vertical</span>
        </span>
      </button>

      {/* Precision Sizing */}
      <button
        disabled={!hasSelection}
        onClick={() => runAndClose(() => setActiveDialog('precision-object-sizing'))}
        className="w-full flex items-center justify-between px-3 py-1.5 hover:bg-accent/15 hover:text-accent disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-inherit text-left"
        role="menuitem"
      >
        <span className="flex items-center gap-2">
          <Maximize2 size={13} />
          <span>Precision Sizing...</span>
        </span>
      </button>

      {/* Image Crop & Background Removal */}
      {selectedObjects.length === 1 && isImage(selectedObjects[0]) && (
        <>
          <div className="my-1 border-t border-[var(--border)]" />
          <button
            onClick={() =>
              runAndClose(() => useSceneStore.getState().setToolMode('crop_rect'))
            }
            className="w-full flex items-center justify-between px-3 py-1.5 hover:bg-accent/15 hover:text-accent text-left"
            role="menuitem"
          >
            <span className="flex items-center gap-2">
              <Crop size={13} className="text-accent" />
              <span>Crop Image</span>
            </span>
          </button>
          <button
            onClick={() =>
              runAndClose(() =>
                void executeBackgroundRemoval(selectedObjects[0] as unknown as any)
              )
            }
            className="w-full flex items-center justify-between px-3 py-1.5 hover:bg-accent/15 hover:text-accent text-left"
            role="menuitem"
          >
            <span className="flex items-center gap-2">
              <Wand2 size={13} className="text-purple-400" />
              <span>Remove Background</span>
            </span>
          </button>
        </>
      )}

      <div className="my-1 border-t border-[var(--border)]" />

      {/* Lock / Unlock */}
      <button
        disabled={!hasSelection}
        onClick={() =>
          runAndClose(() => {
            const newLock = !isAllLocked;
            for (const id of selection) setObjectLock(id, newLock);
          })
        }
        className="w-full flex items-center justify-between px-3 py-1.5 hover:bg-accent/15 hover:text-accent disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-inherit text-left"
        role="menuitem"
      >
        <span className="flex items-center gap-2">
          {isAllLocked ? <Unlock size={13} /> : <Lock size={13} />}
          <span>{isAllLocked ? 'Unlock' : 'Lock'}</span>
        </span>
      </button>

      {/* Hide / Show */}
      <button
        disabled={!hasSelection}
        onClick={() =>
          runAndClose(() => {
            const newHidden = !isAllHidden;
            for (const id of selection) setObjectVisibility(id, newHidden);
          })
        }
        className="w-full flex items-center justify-between px-3 py-1.5 hover:bg-accent/15 hover:text-accent disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-inherit text-left"
        role="menuitem"
      >
        <span className="flex items-center gap-2">
          {isAllHidden ? <Eye size={13} /> : <EyeOff size={13} />}
          <span>{isAllHidden ? 'Show' : 'Hide'}</span>
        </span>
      </button>
    </div>
  );
}
