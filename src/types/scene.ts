export type Unit = 'px' | 'in' | 'cm' | 'mm';
export type WorkMode = 'unlimited' | 'standard';
export type CanvasPreset = 'auto' | '1:1' | '9:16' | '16:9' | '3:4' | '4:3' | 'custom' | string;
export type ExportFormat = 'jxl' | 'jpeg' | 'png' | 'webp' | 'avif' | 'pdf' | 'svg' | 'tiff';
export type ImportFormat =
  | 'image/jpeg'
  | 'image/png'
  | 'image/webp'
  | 'image/avif'
  | 'image/jxl'
  | 'image/svg+xml'
  | 'image/tiff';
export type StrokeStyle = 'solid' | 'dashed' | 'dotted';
export type LineType = 'straight' | 'curve' | 'elbow';
export type Arrowhead = 'none' | 'arrow' | 'triangle' | 'circle' | 'diamond' | 'bar';
export type BindingEdge = 'top' | 'bottom' | 'left' | 'right' | 'center';
export type ToolMode =
  | 'select'
  | 'pan'
  | 'line'
  | 'arrow'
  | 'crop_rect'
  | 'crop_freeform'
  | 'crop_magnetic';

export interface Point {
  x: number;
  y: number;
}

export interface BoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface ObjectBinding {
  elementId: string;
  edge: BindingEdge;
}

export interface BaseCanvasObject {
  id: string;
  name?: string;
  groupId: number | null;
  opacity: number; // 0.0 to 1.0
  rotation: number; // degrees -180 to 180
  flipH: boolean;
  flipV: boolean;
  locked?: boolean;
  hidden?: boolean;
  x: number; // Normalized bounding box top-left
  y: number;
  width: number;
  height: number;
}

export interface ImageObject extends BaseCanvasObject {
  type: 'image';
  assetId: string; // Dexie assets table key
  origWidth: number;
  origHeight: number;
  mimeType: string;
  crop?: {
    polygon?: Point[];
    rect?: BoundingBox;
  };
}

export interface LineObject extends BaseCanvasObject {
  type: 'line';
  points: Point[]; // Multi-point spline / segment points
  strokeColor: string; // Hex color (#ffffff)
  strokeWidth: number; // Width in px (1 - 20)
  strokeStyle: StrokeStyle;
  roughness: number; // 0 = sharp, 1 = hand-drawn, 2 = rough sketch
  roughSeed: number;
  lineType: LineType;
  startArrowhead: Arrowhead;
  endArrowhead: Arrowhead;
  startBinding: ObjectBinding | null;
  endBinding: ObjectBinding | null;
}

export type CanvasObject = ImageObject | LineObject;

export interface ViewportState {
  workMode: WorkMode;
  // Creation Engine (Unlimited Canvas)
  ulPanX: number;
  ulPanY: number;
  ulZoom: number; // Clamped 0.02 to 10.0
  unlimitedTheme: 'dark' | 'light';
  // Framing Engine (Standard Canvas)
  zoomLevel: number; // Clamped 0.05 to 3.0
  canvasMode: CanvasPreset;
  canvasLocked: boolean;
  lockedCanvasW: number | null;
  lockedCanvasH: number | null;
  customCanvasW: number | null;
  customCanvasH: number | null;
  renderOffsetX: number;
  renderOffsetY: number;
}

export interface GlobalSettings {
  spacing: number; // Vertical stacking gap (0 - 200px)
  horizontalSpacing: number; // Horizontal stacking gap (0 - 200px)
  bgColor: string; // Canvas background color (#ffffff)
  transparentBg: boolean; // Transparency toggle
  exportFormat: ExportFormat;
  exportQuality: number; // 10 to 100
  resizeMode: 'none' | 'widest' | 'narrowest';
  isSnapping: boolean;
  isResizeSnapping: boolean;
  unit: Unit;
  dpi: number;
}

export interface LineStyleDefaults {
  strokeColor: string;
  strokeWidth: number;
  strokeStyle: StrokeStyle;
  roughness: number;
  lineType: LineType;
  startArrowhead: Arrowhead;
  endArrowhead: Arrowhead;
}

export interface WorkspaceFile {
  formatVersion: 2;
  savedAt: string;
  images: Array<CanvasObject & { dataUrl?: string }>;
  settings: GlobalSettings & ViewportState & { groupCounter: number };
}
