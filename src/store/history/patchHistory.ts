import { type Patch, applyPatches } from 'immer';
import type { HistoryEngine } from './types';

export interface PatchEntry {
  patches: Patch[];
  inversePatches: Patch[];
  label: string;
}

export class PatchHistoryEngine<T extends object> implements HistoryEngine {
  private past: PatchEntry[] = [];
  private future: PatchEntry[] = [];
  private currentPending: {
    patches: Patch[];
    inversePatches: Patch[];
    label: string;
  } | null = null;
  private readonly maxDepth = 50;

  constructor(
    private _getState: () => T,
    private setState: (applyFn: (draft: T) => void) => void,
    private onStateChange?: () => void
  ) {
    void this._getState;
  }

  isTransactionActive(): boolean {
    return this.currentPending !== null;
  }

  begin(label: string): void {
    if (this.currentPending) return;
    this.currentPending = {
      patches: [],
      inversePatches: [],
      label,
    };
  }

  recordPatches(patches: Patch[], inversePatches: Patch[]): void {
    if (patches.length === 0) return;
    if (this.currentPending) {
      this.currentPending.patches.push(...patches);
      // Inverse patches must be unshifted so they apply in reverse order
      this.currentPending.inversePatches.unshift(...inversePatches);
    } else {
      // Auto-commit single operation if not explicitly in begin..commit
      this.past.push({
        patches: [...patches],
        inversePatches: [...inversePatches],
        label: 'Mutation',
      });
      if (this.past.length > this.maxDepth) {
        this.past.shift();
      }
      this.future = [];
      this.onStateChange?.();
    }
  }

  commit(): void {
    if (!this.currentPending) return;
    const entry = this.currentPending;
    this.currentPending = null;

    if (entry.patches.length === 0) return;

    this.past.push(entry);
    if (this.past.length > this.maxDepth) {
      this.past.shift();
    }
    this.future = [];
    this.onStateChange?.();
  }

  cancel(): void {
    if (!this.currentPending) return;
    const entry = this.currentPending;
    this.currentPending = null;

    if (entry.inversePatches.length > 0) {
      this.setState((draft) => {
        applyPatches(draft, entry.inversePatches);
      });
    }
    this.onStateChange?.();
  }

  undo(): void {
    if (!this.canUndo) return;
    const entry = this.past.pop()!;
    this.future.push(entry);
    this.setState((draft) => {
      applyPatches(draft, entry.inversePatches);
    });
    this.onStateChange?.();
  }

  redo(): void {
    if (!this.canRedo) return;
    const entry = this.future.pop()!;
    this.past.push(entry);
    this.setState((draft) => {
      applyPatches(draft, entry.patches);
    });
    this.onStateChange?.();
  }

  get canUndo(): boolean {
    return this.past.length > 0;
  }

  get canRedo(): boolean {
    return this.future.length > 0;
  }

  clear(): void {
    this.past = [];
    this.future = [];
    this.currentPending = null;
    this.onStateChange?.();
  }

  getUndoLabel(): string | null {
    if (this.past.length === 0) return null;
    return this.past[this.past.length - 1].label;
  }

  getRedoLabel(): string | null {
    if (this.future.length === 0) return null;
    return this.future[this.future.length - 1].label;
  }
}
