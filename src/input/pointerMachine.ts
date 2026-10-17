import type { BoundingBox, Point } from '../types/scene';
import type { ResizeHandleType } from '../canvas/drawOverlay';

export type PointerMode =
  | 'idle'
  | 'panning'
  | 'marquee'
  | 'dragging'
  | 'resizing'
  | 'rotating'
  | 'drawingLine';

export interface PointerMachineState {
  mode: PointerMode;
  startScreen: Point;
  startWorld: Point;
  currentScreen: Point;
  currentWorld: Point;
  activeHandle: ResizeHandleType | null;
  dragTargetIds: string[];
  initialObjectBoxes: Map<string, BoundingBox & { rotation: number }>;
}

export function createInitialPointerState(): PointerMachineState {
  return {
    mode: 'idle',
    startScreen: { x: 0, y: 0 },
    startWorld: { x: 0, y: 0 },
    currentScreen: { x: 0, y: 0 },
    currentWorld: { x: 0, y: 0 },
    activeHandle: null,
    dragTargetIds: [],
    initialObjectBoxes: new Map(),
  };
}
