export interface HistoryTransaction {
  label: string;
  timestamp: number;
}

export interface HistoryEngine {
  begin(label: string): void;
  commit(): void;
  cancel(): void;
  undo(): void;
  redo(): void;
  canUndo: boolean;
  canRedo: boolean;
  clear(): void;
  getUndoLabel(): string | null;
  getRedoLabel(): string | null;
}
