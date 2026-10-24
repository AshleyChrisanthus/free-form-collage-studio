import { useState } from 'react';
import {
  Layers,
  ChevronRight,
  ArrowUpToLine,
  ArrowDownToLine,
  ChevronUp,
  ChevronDown,
  Group,
  Ungroup,
  Trash2,
} from 'lucide-react';
import { useSceneStore } from '../../store/sceneStore';
import { LayerRow } from './LayerRow';

export function LayersPanel() {
  const isOpen = useSceneStore((state) => state.ui.layersOpen);
  const propertiesOpen = useSceneStore((state) => state.ui.propertiesOpen);
  const toggleLayers = useSceneStore((state) => state.toggleLayers);
  const objects = useSceneStore((state) => state.objects);
  const selection = useSceneStore((state) => state.selection);

  // Store actions
  const setSelection = useSceneStore((state) => state.setSelection);
  const toggleSelection = useSceneStore((state) => state.toggleSelection);
  const reorderObjects = useSceneStore((state) => state.reorderObjects);
  const setObjectVisibility = useSceneStore((state) => state.setObjectVisibility);
  const setObjectLock = useSceneStore((state) => state.setObjectLock);
  const renameObject = useSceneStore((state) => state.renameObject);
  const bringToFront = useSceneStore((state) => state.bringToFront);
  const sendToBack = useSceneStore((state) => state.sendToBack);
  const bringForward = useSceneStore((state) => state.bringForward);
  const sendBackward = useSceneStore((state) => state.sendBackward);
  const groupSelected = useSceneStore((state) => state.groupSelected);
  const ungroupSelected = useSceneStore((state) => state.ungroupSelected);
  const removeObjects = useSceneStore((state) => state.removeObjects);

  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dragOverTarget, setDragOverTarget] = useState<{
    index: number;
    position: 'top' | 'bottom';
  } | null>(null);

  if (!isOpen) {
    return (
      <button
        onClick={() => toggleLayers(true)}
        className="glass pointer-events-auto self-end apple-btn flex items-center gap-1.5 px-3 py-1.5 text-xs shadow-md flex-shrink-0"
        title="Open Layers Panel"
        aria-label="Open Layers Panel"
      >
        <Layers size={14} className="text-accent" />
        <span>Layers ({objects.length})</span>
      </button>
    );
  }

  // Visual order: top z-index (highest array index) appears at the top of the list
  const reversedIndices = objects.map((_, i) => i).reverse();

  const handleDragStart = (e: React.DragEvent, arrayIndex: number) => {
    setDraggedIndex(arrayIndex);
    e.dataTransfer.setData('text/plain', arrayIndex.toString());
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent, arrayIndex: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    const targetRect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const midY = targetRect.top + targetRect.height / 2;
    const pos = e.clientY < midY ? 'top' : 'bottom';
    setDragOverTarget({ index: arrayIndex, position: pos });
  };

  const handleDrop = (e: React.DragEvent, targetArrayIndex: number) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === targetArrayIndex) {
      setDraggedIndex(null);
      setDragOverTarget(null);
      return;
    }

    let toIndex = targetArrayIndex;
    if (dragOverTarget?.position === 'top' && draggedIndex < targetArrayIndex) {
      toIndex = Math.max(0, targetArrayIndex - 1);
    } else if (dragOverTarget?.position === 'bottom' && draggedIndex > targetArrayIndex) {
      toIndex = Math.min(objects.length - 1, targetArrayIndex + 1);
    }

    reorderObjects(draggedIndex, toIndex);
    setDraggedIndex(null);
    setDragOverTarget(null);
  };

  const handleSelect = (id: string, isShift: boolean) => {
    if (isShift) {
      toggleSelection(id);
    } else {
      setSelection([id]);
    }
  };

  const hasOpenProperties = selection.length > 0 && propertiesOpen;

  return (
    <aside
      className={`glass pointer-events-auto flex w-72 flex-col min-h-0 overflow-hidden rounded-[var(--radius)] shadow-xl text-xs ${
        hasOpenProperties ? 'flex-1 max-h-[45%]' : 'max-h-full'
      }`}
      aria-label="Layers Panel"
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b border-[var(--border)] px-3 py-2.5 flex-shrink-0">
        <div className="flex items-center gap-2 font-semibold">
          <Layers size={14} className="text-accent" />
          <span>Layers</span>
          <span className="text-[10px] text-fg-muted font-mono">({objects.length})</span>
        </div>
        <button
          onClick={() => toggleLayers(false)}
          className="apple-btn apple-btn-ghost apple-btn-icon h-6 w-6"
          title="Collapse Layers Panel"
          aria-label="Collapse Layers Panel"
        >
          <ChevronRight size={14} />
        </button>
      </div>

      {/* Layer quick controls toolbar */}
      <div className="flex items-center justify-between px-2 py-1.5 border-b border-[var(--border)] bg-surface-raised/40 flex-shrink-0">
        <div className="flex items-center gap-1">
          <button
            onClick={() => bringToFront(selection)}
            disabled={selection.length === 0}
            className="apple-btn apple-btn-ghost apple-btn-icon h-6 w-6"
            title="Bring to Front (])"
          >
            <ArrowUpToLine size={12} />
          </button>
          <button
            onClick={() => bringForward(selection)}
            disabled={selection.length === 0}
            className="apple-btn apple-btn-ghost apple-btn-icon h-6 w-6"
            title="Bring Forward"
          >
            <ChevronUp size={12} />
          </button>
          <button
            onClick={() => sendBackward(selection)}
            disabled={selection.length === 0}
            className="apple-btn apple-btn-ghost apple-btn-icon h-6 w-6"
            title="Send Backward"
          >
            <ChevronDown size={12} />
          </button>
          <button
            onClick={() => sendToBack(selection)}
            disabled={selection.length === 0}
            className="apple-btn apple-btn-ghost apple-btn-icon h-6 w-6"
            title="Send to Back ([)"
          >
            <ArrowDownToLine size={12} />
          </button>
        </div>

        <div className="flex items-center gap-1">
          <button
            onClick={() => groupSelected()}
            disabled={selection.length < 2}
            className="apple-btn apple-btn-ghost apple-btn-icon h-6 w-6"
            title="Group (Ctrl+G)"
          >
            <Group size={12} />
          </button>
          <button
            onClick={() => ungroupSelected()}
            disabled={selection.length === 0}
            className="apple-btn apple-btn-ghost apple-btn-icon h-6 w-6"
            title="Ungroup (Ctrl+Shift+G)"
          >
            <Ungroup size={12} />
          </button>
          <button
            onClick={() => removeObjects(selection)}
            disabled={selection.length === 0}
            className="apple-btn apple-btn-ghost apple-btn-icon h-6 w-6 text-red-400 hover:text-red-500"
            title="Delete Selected"
          >
            <Trash2 size={12} />
          </button>
        </div>
      </div>

      {/* Layer rows list */}
      <div className="overflow-y-auto p-2 space-y-0.5 flex-1 min-h-0 pb-10">
        {objects.length === 0 ? (
          <div className="py-8 text-center text-fg-muted text-[11px]">
            No objects in canvas
          </div>
        ) : (
          reversedIndices.map((arrayIdx) => {
            const obj = objects[arrayIdx];
            return (
              <LayerRow
                key={obj.id}
                object={obj}
                arrayIndex={arrayIdx}
                isSelected={selection.includes(obj.id)}
                onSelect={handleSelect}
                onToggleVisibility={setObjectVisibility}
                onToggleLock={setObjectLock}
                onRename={renameObject}
                onDragStart={handleDragStart}
                onDragOver={handleDragOver}
                onDrop={handleDrop}
                isDragOverTop={dragOverTarget?.index === arrayIdx && dragOverTarget.position === 'top'}
                isDragOverBottom={dragOverTarget?.index === arrayIdx && dragOverTarget.position === 'bottom'}
              />
            );
          })
        )}
      </div>
    </aside>
  );
}
