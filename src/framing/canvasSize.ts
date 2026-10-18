import type { CanvasObject, CanvasPreset, ViewportState, GlobalSettings } from '../types/scene';
import { unionBounds } from '../lib/geometry';

export interface StageBounds {
  x: number;
  y: number;
  width: number;
  height: number;
  aspectRatio: number;
}

export const ASPECT_RATIOS: Record<string, number> = {
  '1:1': 1.0,
  '16:9': 16 / 9,
  '9:16': 9 / 16,
  '4:3': 4 / 3,
  '3:4': 3 / 4,
};

export const CUSTOM_RATIO_REGEX = /^(\d+(?:\.\d+)?):(\d+(?:\.\d+)?)$/;

/**
 * Validates whether a custom ratio string is valid (e.g. '21:9', '2.35:1').
 */
export function isValidRatioString(val: string): boolean {
  const match = val.trim().match(CUSTOM_RATIO_REGEX);
  if (!match) return false;
  const num = parseFloat(match[1]);
  const den = parseFloat(match[2]);
  return num > 0 && den > 0;
}

/**
 * Parses ratio from a preset or custom ratio string.
 */
export function parseRatio(preset: CanvasPreset): number | null {
  if (ASPECT_RATIOS[preset]) {
    return ASPECT_RATIOS[preset];
  }
  const match = preset.trim().match(CUSTOM_RATIO_REGEX);
  if (match) {
    const num = parseFloat(match[1]);
    const den = parseFloat(match[2]);
    if (num > 0 && den > 0) return num / den;
  }
  return null;
}

/**
 * Computes bounded framing stage coordinates and dimensions.
 */
export function computeCanvasSize(
  objects: CanvasObject[],
  viewport: ViewportState,
  _settings?: GlobalSettings
): StageBounds {
  // 1. Locked mode takes precedence
  if (viewport.canvasLocked && viewport.lockedCanvasW && viewport.lockedCanvasH) {
    return {
      x: viewport.renderOffsetX || 0,
      y: viewport.renderOffsetY || 0,
      width: Math.round(viewport.lockedCanvasW),
      height: Math.round(viewport.lockedCanvasH),
      aspectRatio: viewport.lockedCanvasW / viewport.lockedCanvasH,
    };
  }

  // 2. Custom dimensions
  if (viewport.canvasMode === 'custom') {
    const w = viewport.customCanvasW ?? 1200;
    const h = viewport.customCanvasH ?? 800;
    return {
      x: viewport.renderOffsetX || 0,
      y: viewport.renderOffsetY || 0,
      width: Math.round(w),
      height: Math.round(h),
      aspectRatio: w / h,
    };
  }

  // 3. Compute union bounds of content
  const content = unionBounds(objects);
  const minW = 100;
  const minH = 100;

  const contentBox = content
    ? {
        x: content.x,
        y: content.y,
        width: Math.max(minW, content.width),
        height: Math.max(minH, content.height),
      }
    : {
        x: 0,
        y: 0,
        width: 1200,
        height: 800,
      };

  // 4. Auto mode: wrap exactly to content
  if (viewport.canvasMode === 'auto') {
    return {
      x: Math.round(contentBox.x),
      y: Math.round(contentBox.y),
      width: Math.round(contentBox.width),
      height: Math.round(contentBox.height),
      aspectRatio: contentBox.width / contentBox.height,
    };
  }

  // 5. Preset or custom aspect ratio
  const ratio = parseRatio(viewport.canvasMode);
  if (ratio) {
    let stageW: number;
    let stageH: number;

    const currentRatio = contentBox.width / contentBox.height;
    if (currentRatio > ratio) {
      // Content is wider than target ratio: expand height
      stageW = contentBox.width;
      stageH = contentBox.width / ratio;
    } else {
      // Content is taller than target ratio: expand width
      stageH = contentBox.height;
      stageW = contentBox.height * ratio;
    }

    const stageX = contentBox.x - (stageW - contentBox.width) / 2;
    const stageY = contentBox.y - (stageH - contentBox.height) / 2;

    return {
      x: Math.round(stageX),
      y: Math.round(stageY),
      width: Math.round(stageW),
      height: Math.round(stageH),
      aspectRatio: ratio,
    };
  }

  // Fallback
  return {
    x: Math.round(contentBox.x),
    y: Math.round(contentBox.y),
    width: Math.round(contentBox.width),
    height: Math.round(contentBox.height),
    aspectRatio: contentBox.width / contentBox.height,
  };
}
