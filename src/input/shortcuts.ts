import { useSceneStore } from '../store/sceneStore';

export interface ShortcutDefinition {
  key: string;
  ctrlOrMeta?: boolean;
  shift?: boolean;
  alt?: boolean;
  description: string;
  category: 'Tools' | 'Editing' | 'History' | 'Layers' | 'Navigation';
  action: (e: KeyboardEvent) => void;
}

export const SHORTCUTS: ShortcutDefinition[] = [
  // Tools
  {
    key: 'v',
    description: 'Select tool',
    category: 'Tools',
    action: () => useSceneStore.getState().setToolMode('select'),
  },
  {
    key: 'l',
    description: 'Line tool',
    category: 'Tools',
    action: () => useSceneStore.getState().setToolMode('line'),
  },
  {
    key: 'a',
    description: 'Arrow tool',
    category: 'Tools',
    action: () => useSceneStore.getState().setToolMode('arrow'),
  },

  // History
  {
    key: 'z',
    ctrlOrMeta: true,
    description: 'Undo',
    category: 'History',
    action: () => useSceneStore.getState().undo(),
  },
  {
    key: 'z',
    ctrlOrMeta: true,
    shift: true,
    description: 'Redo',
    category: 'History',
    action: () => useSceneStore.getState().redo(),
  },
  {
    key: 'y',
    ctrlOrMeta: true,
    description: 'Redo',
    category: 'History',
    action: () => useSceneStore.getState().redo(),
  },

  // Navigation & Mode
  {
    key: 'm',
    description: 'Toggle Creation ⇄ Framing mode',
    category: 'Navigation',
    action: () => {
      const mode = useSceneStore.getState().viewport.workMode;
      useSceneStore.getState().setWorkMode(mode === 'unlimited' ? 'standard' : 'unlimited');
    },
  },
  {
    key: 'l',
    ctrlOrMeta: true,
    description: 'Toggle canvas lock',
    category: 'Navigation',
    action: (e) => {
      e.preventDefault();
      const locked = useSceneStore.getState().viewport.canvasLocked;
      useSceneStore.getState().setCanvasLock(!locked);
    },
  },
  {
    key: '!',
    shift: true,
    description: 'Fit to content (Shift+1)',
    category: 'Navigation',
    action: (e) => {
      e.preventDefault();
      window.dispatchEvent(new CustomEvent('canvas:fit-content'));
    },
  },
  {
    key: ')',
    shift: true,
    description: 'Reset view (Shift+0)',
    category: 'Navigation',
    action: (e) => {
      e.preventDefault();
      window.dispatchEvent(new CustomEvent('canvas:reset-view'));
    },
  },

  // Editing
  {
    key: 'a',
    ctrlOrMeta: true,
    description: 'Select all objects',
    category: 'Editing',
    action: (e) => {
      e.preventDefault();
      useSceneStore.getState().selectAll();
    },
  },
  {
    key: 'd',
    ctrlOrMeta: true,
    description: 'Duplicate selection',
    category: 'Editing',
    action: (e) => {
      e.preventDefault();
      const sel = useSceneStore.getState().selection;
      useSceneStore.getState().duplicateObjects(sel);
    },
  },
  {
    key: 'Delete',
    description: 'Delete selection',
    category: 'Editing',
    action: () => {
      const sel = useSceneStore.getState().selection;
      useSceneStore.getState().removeObjects(sel);
    },
  },
  {
    key: 'Backspace',
    description: 'Delete selection',
    category: 'Editing',
    action: () => {
      const sel = useSceneStore.getState().selection;
      useSceneStore.getState().removeObjects(sel);
    },
  },
  {
    key: 'Escape',
    description: 'Deselect / Cancel active operation',
    category: 'Editing',
    action: () => {
      const state = useSceneStore.getState();
      state.cancelTransaction();
      state.clearSelection();
      state.setToolMode('select');
    },
  },

  // Grouping
  {
    key: 'g',
    ctrlOrMeta: true,
    description: 'Group selected objects',
    category: 'Layers',
    action: (e) => {
      e.preventDefault();
      useSceneStore.getState().groupSelected();
    },
  },
  {
    key: 'g',
    ctrlOrMeta: true,
    shift: true,
    description: 'Ungroup selected objects',
    category: 'Layers',
    action: (e) => {
      e.preventDefault();
      useSceneStore.getState().ungroupSelected();
    },
  },

  // Z-Order
  {
    key: ']',
    description: 'Bring layer forward',
    category: 'Layers',
    action: () => {
      const sel = useSceneStore.getState().selection;
      useSceneStore.getState().bringForward(sel);
    },
  },
  {
    key: '[',
    description: 'Send layer backward',
    category: 'Layers',
    action: () => {
      const sel = useSceneStore.getState().selection;
      useSceneStore.getState().sendBackward(sel);
    },
  },

  // Nudge
  {
    key: 'ArrowLeft',
    description: 'Nudge 1px left (Shift: 10px)',
    category: 'Editing',
    action: (e) => {
      e.preventDefault();
      const delta = e.shiftKey ? 10 : 1;
      const sel = useSceneStore.getState().selection;
      useSceneStore.getState().moveObjects(sel, -delta, 0);
    },
  },
  {
    key: 'ArrowRight',
    description: 'Nudge 1px right (Shift: 10px)',
    category: 'Editing',
    action: (e) => {
      e.preventDefault();
      const delta = e.shiftKey ? 10 : 1;
      const sel = useSceneStore.getState().selection;
      useSceneStore.getState().moveObjects(sel, delta, 0);
    },
  },
  {
    key: 'ArrowUp',
    description: 'Nudge 1px up (Shift: 10px)',
    category: 'Editing',
    action: (e) => {
      e.preventDefault();
      const delta = e.shiftKey ? 10 : 1;
      const sel = useSceneStore.getState().selection;
      useSceneStore.getState().moveObjects(sel, 0, -delta);
    },
  },
  {
    key: 'ArrowDown',
    description: 'Nudge 1px down (Shift: 10px)',
    category: 'Editing',
    action: (e) => {
      e.preventDefault();
      const delta = e.shiftKey ? 10 : 1;
      const sel = useSceneStore.getState().selection;
      useSceneStore.getState().moveObjects(sel, 0, delta);
    },
  },
];

/**
 * Global keyboard event listener handler.
 */
export function handleGlobalKeyDown(
  e: KeyboardEvent,
  onOpenShortcuts?: () => void
): void {
  // Ignore inside inputs, textareas, or contenteditables
  const target = e.target as HTMLElement | null;
  if (
    target &&
    (target.tagName === 'INPUT' ||
      target.tagName === 'TEXTAREA' ||
      target.isContentEditable)
  ) {
    return;
  }

  // Open shortcut help on '?'
  if (e.key === '?' && !e.ctrlKey && !e.metaKey) {
    e.preventDefault();
    onOpenShortcuts?.();
    return;
  }

  const isMod = e.ctrlKey || e.metaKey;

  for (const sc of SHORTCUTS) {
    const keyMatch =
      sc.key.toLowerCase() === e.key.toLowerCase() ||
      (sc.key === '!' && (e.key === '!' || e.key === '1')) ||
      (sc.key === ')' && (e.key === ')' || e.key === '0')) ||
      (sc.key === 'Delete' && e.key === 'Delete') ||
      (sc.key === 'Backspace' && e.key === 'Backspace') ||
      (sc.key.startsWith('Arrow') && sc.key === e.key);

    const modMatch = sc.ctrlOrMeta ? isMod : !isMod;
    const shiftMatch = sc.shift ? e.shiftKey : !e.shiftKey;

    if (keyMatch && modMatch && shiftMatch) {
      sc.action(e);
      return;
    }
  }
}
