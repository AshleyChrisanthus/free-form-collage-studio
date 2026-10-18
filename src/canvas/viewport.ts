import type { Point } from '../types/scene';
import { clamp } from '../lib/geometry';

export const MIN_UNLIMITED_ZOOM = 0.02;
export const MAX_UNLIMITED_ZOOM = 10.0;
export const MIN_FRAMING_ZOOM = 0.05;
export const MAX_FRAMING_ZOOM = 3.0;

export function clampUnlimitedZoom(zoom: number): number {
  return clamp(zoom, MIN_UNLIMITED_ZOOM, MAX_UNLIMITED_ZOOM);
}

export function clampFramingZoom(zoom: number): number {
  return clamp(zoom, MIN_FRAMING_ZOOM, MAX_FRAMING_ZOOM);
}

export function screenToWorld(
  pt: Point,
  pan: { x: number; y: number },
  zoom: number
): Point {
  return {
    x: (pt.x - pan.x) / zoom,
    y: (pt.y - pan.y) / zoom,
  };
}

export function worldToScreen(
  pt: Point,
  pan: { x: number; y: number },
  zoom: number
): Point {
  return {
    x: pt.x * zoom + pan.x,
    y: pt.y * zoom + pan.y,
  };
}

export interface ZoomAtCursorResult {
  zoom: number;
  panX: number;
  panY: number;
}

/**
 * Computes cursor-anchored zoom with exponential scaling.
 * Keeps the point under cursor invariant in world space.
 */
export function computeCursorZoom(
  currentZoom: number,
  pan: { x: number; y: number },
  cursor: Point,
  deltaY: number,
  isPinch: boolean = false
): ZoomAtCursorResult {
  // Sensitivity: trackpad pinch (ctrlKey) has higher sensitivity per tick
  const sensitivity = isPinch ? 0.005 : 0.0015;
  const nextZoom = clampUnlimitedZoom(currentZoom * Math.exp(-deltaY * sensitivity));

  if (nextZoom === currentZoom) {
    return { zoom: currentZoom, panX: pan.x, panY: pan.y };
  }

  const worldX = (cursor.x - pan.x) / currentZoom;
  const worldY = (cursor.y - pan.y) / currentZoom;

  const nextPanX = cursor.x - worldX * nextZoom;
  const nextPanY = cursor.y - worldY * nextZoom;

  return {
    zoom: nextZoom,
    panX: nextPanX,
    panY: nextPanY,
  };
}

export interface CameraAnimationTarget {
  panX: number;
  panY: number;
  zoom: number;
}

export type AnimationCancelFn = () => void;

/**
 * Animates viewport pan & zoom smoothly using easeOutCubic and log-space zoom interpolation.
 */
export function animateViewport(
  start: CameraAnimationTarget,
  target: CameraAnimationTarget,
  durationMs: number = 350,
  onUpdate: (state: CameraAnimationTarget) => void,
  onComplete?: () => void
): AnimationCancelFn {
  let animId: number | null = null;
  const startTime = performance.now();

  const startLogZoom = Math.log(Math.max(MIN_UNLIMITED_ZOOM, start.zoom));
  const targetLogZoom = Math.log(Math.max(MIN_UNLIMITED_ZOOM, target.zoom));

  const step = (now: number) => {
    const elapsed = now - startTime;
    const progress = Math.min(1, elapsed / Math.max(1, durationMs));
    // easeOutCubic
    const t = 1 - Math.pow(1 - progress, 3);

    const currentPanX = start.panX + (target.panX - start.panX) * t;
    const currentPanY = start.panY + (target.panY - start.panY) * t;
    const currentZoom = Math.exp(startLogZoom + (targetLogZoom - startLogZoom) * t);

    onUpdate({
      panX: currentPanX,
      panY: currentPanY,
      zoom: currentZoom,
    });

    if (progress < 1) {
      animId = requestAnimationFrame(step);
    } else {
      animId = null;
      onComplete?.();
    }
  };

  animId = requestAnimationFrame(step);

  return () => {
    if (animId !== null) {
      cancelAnimationFrame(animId);
      animId = null;
    }
  };
}
