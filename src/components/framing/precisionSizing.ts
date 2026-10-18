import type { Unit } from '../../types/scene';
import { toPx, fromPx } from '../../lib/units';

export interface RatioPreset {
  id: string;
  label: string;
  ratio: number;
}

export const OBJECT_RATIO_PRESETS: RatioPreset[] = [
  { id: '1:1', label: '1:1 (Square)', ratio: 1 },
  { id: '4:3', label: '4:3', ratio: 4 / 3 },
  { id: '3:4', label: '3:4', ratio: 3 / 4 },
  { id: '16:9', label: '16:9', ratio: 16 / 9 },
  { id: '9:16', label: '9:16', ratio: 9 / 16 },
  { id: '3:2', label: '3:2', ratio: 3 / 2 },
  { id: '2:3', label: '2:3', ratio: 2 / 3 },
];

export type FitStrategy = 'width' | 'height';

/**
 * Calculates new width and height based on target ratio and fit strategy.
 */
export function calculateAspectDimensions(
  currentW: number,
  currentH: number,
  targetRatio: number,
  strategy: FitStrategy = 'width'
): { width: number; height: number } {
  if (targetRatio <= 0) return { width: currentW, height: currentH };

  if (strategy === 'width') {
    const width = Math.max(20, Math.round(currentW));
    const height = Math.max(20, Math.round(width / targetRatio));
    return { width, height };
  } else {
    const height = Math.max(20, Math.round(currentH));
    const width = Math.max(20, Math.round(height * targetRatio));
    return { width, height };
  }
}

/**
 * Convert pixel dimensions to given unit values.
 */
export function convertDimensionsToUnit(
  wPx: number,
  hPx: number,
  unit: Unit,
  dpi = 300
): { width: number; height: number } {
  return {
    width: fromPx(wPx, unit, dpi),
    height: fromPx(hPx, unit, dpi),
  };
}

/**
 * Convert unit values back to pixel dimensions.
 */
export function convertDimensionsToPx(
  wVal: number,
  hVal: number,
  unit: Unit,
  dpi = 300
): { widthPx: number; heightPx: number } {
  return {
    widthPx: Math.max(20, toPx(wVal, unit, dpi)),
    heightPx: Math.max(20, toPx(hVal, unit, dpi)),
  };
}
