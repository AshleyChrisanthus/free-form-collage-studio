import { useState, useRef, useEffect } from 'react';
import {
  Eye,
  EyeOff,
  Lock,
  Unlock,
  PenTool,
  Image as ImageIcon,
  GripVertical,
} from 'lucide-react';
import type { CanvasObject } from '../../types/scene';
import { isImage, isLine } from '../../types/guards';
import { assetCache } from '../../canvas/assetCache';

interface LayerRowProps {
  object: CanvasObject;
  index: number;
  arrayIndex: number;
  isSelected: boolean;
  onSelect: (id: string, isShift: boolean) => void;
  onToggleVisibility: (id: string, hidden: boolean) => void;
  onToggleLock: (id: string, locked: boolean) => void;
  onRename: (id: string, newName: string) => void;
  onDragStart: (e: React.DragEvent, index: number) => void;
  onDragOver: (e: React.DragEvent, index: number) => void;
  onDrop: (e: React.DragEvent, index: number) => void;
  isDragOverTop: boolean;
  isDragOverBottom: boolean;
}

export function LayerRow({
  object,
  index,
  arrayIndex,
  isSelected,
  onSelect,
  onToggleVisibility,
  onToggleLock,
  onRename,
  onDragStart,
  onDragOver,
  onDrop,
  isDragOverTop,
  isDragOverBottom,
}: LayerRowProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [nameVal, setNameVal] = useState(object.name || '');
  const inputRef = useRef<HTMLInputElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    setNameVal(object.name || '');
  }, [object.name]);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  // Thumbnail rendering
  useEffect(() => {
    if (!canvasRef.current || !isImage(object)) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const bitmap = assetCache.get(object.assetId);
    if (bitmap) {
      ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    }
  }, [object]);

  const defaultName = isImage(object)
    ? `Image ${arrayIndex + 1}`
    : isLine(object)
    ? `Line ${arrayIndex + 1}`
    : `Layer ${arrayIndex + 1}`;

  const displayName = object.name || defaultName;

  const handleFinishEditing = () => {
    setIsEditing(false);
    if (nameVal.trim() && nameVal.trim() !== object.name) {
      onRename(object.id, nameVal.trim());
    }
  };

  return (
    <div
      draggable
      onDragStart={(e) => onDragStart(e, arrayIndex)}
      onDragOver={(e) => onDragOver(e, arrayIndex)}
      onDrop={(e) => onDrop(e, arrayIndex)}
      onClick={(e) => onSelect(object.id, e.shiftKey || e.ctrlKey || e.metaKey)}
      className={`group relative flex items-center gap-2 px-2.5 py-1.5 rounded select-none cursor-pointer text-xs transition-colors border ${
        isSelected
          ? 'bg-accent/15 border-accent text-fg font-medium'
          : 'border-transparent hover:bg-surface-raised text-fg-muted hover:text-fg'
      } ${isDragOverTop ? 'border-t-2 border-t-accent' : ''} ${
        isDragOverBottom ? 'border-b-2 border-b-accent' : ''
      }`}
    >
      {/* Drag handle */}
      <span className="opacity-0 group-hover:opacity-60 cursor-grab text-fg-muted">
        <GripVertical size={13} />
      </span>

      {/* Thumbnail */}
      {isImage(object) ? (
        <canvas
          ref={canvasRef}
          width={24}
          height={24}
          className="w-6 h-6 rounded bg-surface border border-[var(--border)] object-cover flex-shrink-0"
        />
      ) : (
        <div className="w-6 h-6 rounded bg-surface border border-[var(--border)] flex items-center justify-center flex-shrink-0 text-accent">
          <PenTool size={12} />
        </div>
      )}

      {/* Layer Name / Edit Field */}
      <div className="flex-1 min-w-0 pr-1">
        {isEditing ? (
          <input
            ref={inputRef}
            type="text"
            value={nameVal}
            onChange={(e) => setNameVal(e.target.value)}
            onBlur={handleFinishEditing}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleFinishEditing();
              if (e.key === 'Escape') setIsEditing(false);
            }}
            className="apple-input w-full py-0.5 px-1.5 text-xs font-normal"
          />
        ) : (
          <div className="flex items-center gap-1.5 truncate">
            <span
              onDoubleClick={(e) => {
                e.stopPropagation();
                setIsEditing(true);
              }}
              className="truncate"
              title="Double-click to rename"
            >
              {displayName}
            </span>
            {object.groupId !== null && (
              <span className="text-[9px] px-1 py-0.2 bg-surface-raised border border-[var(--border)] rounded text-accent font-mono flex-shrink-0">
                G{object.groupId}
              </span>
            )}
          </div>
        )}
      </div>

      {/* Visibility Toggle */}
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onToggleVisibility(object.id, !object.hidden);
        }}
        className={`apple-btn apple-btn-ghost apple-btn-icon h-5 w-5 ${
          object.hidden ? 'text-fg-muted/40' : 'text-fg-muted hover:text-fg'
        }`}
        title={object.hidden ? 'Show layer' : 'Hide layer'}
        aria-label={object.hidden ? 'Show layer' : 'Hide layer'}
      >
        {object.hidden ? <EyeOff size={13} /> : <Eye size={13} />}
      </button>

      {/* Lock Toggle */}
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onToggleLock(object.id, !object.locked);
        }}
        className={`apple-btn apple-btn-ghost apple-btn-icon h-5 w-5 ${
          object.locked ? 'text-amber-500' : 'text-fg-muted/40 hover:text-fg'
        }`}
        title={object.locked ? 'Unlock layer' : 'Lock layer'}
        aria-label={object.locked ? 'Unlock layer' : 'Lock layer'}
      >
        {object.locked ? <Lock size={13} /> : <Unlock size={13} />}
      </button>
    </div>
  );
}
