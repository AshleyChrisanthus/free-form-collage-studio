import type { CanvasObject, ImageObject, LineObject, BaseCanvasObject } from './scene';

export function isImage(obj: CanvasObject | BaseCanvasObject | null | undefined): obj is ImageObject {
  return obj != null && (obj as CanvasObject).type === 'image';
}

export function isLine(obj: CanvasObject | BaseCanvasObject | null | undefined): obj is LineObject {
  return obj != null && (obj as CanvasObject).type === 'line';
}
