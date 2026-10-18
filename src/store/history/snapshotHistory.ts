import type { CanvasObject } from '../../types/scene';
import type { HistoryEngine } from './types';

export interface SceneSnapshot {
  objects: CanvasObject[];
  groupCounter: number;
  selection: string[];
}

export class SnapshotHistoryEngine implements HistoryEngine {
  private past: Array<{ snapshot: SceneSnapshot; label: string }> = [];
  private future: Array<{ snapshot: SceneSnapshot; label: string }> = [];
  private currentPending: { snapshot: SceneSnapshot; label: string } | null = null;
  private readonly maxDepth = 50;

  constructor(
    private getSnapshot: () => SceneSnapshot,
    private applySnapshot: (snapshot: SceneSnapshot) => void,
    private onStateChange?: () => void
  ) {}

  isTransactionActive(): boolean {
    return this.currentPending !== null;
  }

  begin(label: string): void {
    if (this.currentPending) return; // Already in transaction
    this.currentPending = {
      snapshot: structuredClone(this.getSnapshot()),
      label,
    };
  }

  commit(): void {
    if (!this.currentPending) return;
    const initial = this.currentPending;
    this.currentPending = null;

    // Check if objects actually changed
    const current = this.getSnapshot();
    if (JSON.stringify(initial.snapshot.objects) === JSON.stringify(current.objects)) {
      return; // No real change
    }

    this.past.push(initial);
    if (this.past.length > this.maxDepth) {
      this.past.shift();
    }
    this.future = [];
    this.onStateChange?.();
  }

  cancel(): void {
    if (!this.currentPending) return;
    const initial = this.currentPending;
    this.currentPending = null;
    this.applySnapshot(initial.snapshot);
    this.onStateChange?.();
  }

  undo(): void {
    if (!this.canUndo) return;
    const previous = this.past.pop()!;
    const currentSnapshot = structuredClone(this.getSnapshot());
    this.future.push({
      snapshot: currentSnapshot,
      label: previous.label,
    });
    this.applySnapshot(previous.snapshot);
    this.onStateChange?.();
  }

  redo(): void {
    if (!this.canRedo) return;
    const next = this.future.pop()!;
    const currentSnapshot = structuredClone(this.getSnapshot());
    this.past.push({
      snapshot: currentSnapshot,
      label: next.label,
    });
    this.applySnapshot(next.snapshot);
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
