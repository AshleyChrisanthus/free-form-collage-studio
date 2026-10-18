import type { Unit } from '../types/scene';

export const DEFAULT_DPI = 300;

export interface PaperPreset {
  id: string;
  name: string;
  width: number;
  height: number;
  unit: Unit;
}

export const PAPER_PRESETS: PaperPreset[] = [
  { id: 'a4', name: 'A4 (210 × 297 mm)', width: 210, height: 297, unit: 'mm' },
  { id: 'a5', name: 'A5 (148 × 210 mm)', width: 148, height: 210, unit: 'mm' },
  { id: 'letter', name: 'Letter (8.5 × 11 in)', width: 8.5, height: 11, unit: 'in' },
  { id: '4x6', name: '4 × 6 in Photo', width: 4, height: 6, unit: 'in' },
  { id: '5x7', name: '5 × 7 in Photo', width: 5, height: 7, unit: 'in' },
  { id: '8x10', name: '8 × 10 in Print', width: 8, height: 10, unit: 'in' },
];

export const COMMON_DPI_LIST = [72, 96, 150, 200, 300, 600, 1200];

/**
 * Convert value from specified unit to pixels based on DPI.
 */
export function toPx(value: number, unit: Unit, dpi: number = DEFAULT_DPI): number {
  if (dpi <= 0) dpi = DEFAULT_DPI;
  switch (unit) {
    case 'px':
      return Math.round(value);
    case 'in':
      return Math.round(value * dpi);
    case 'cm':
      return Math.round((value * dpi) / 2.54);
    case 'mm':
      return Math.round((value * dpi) / 25.4);
    default:
      return Math.round(value);
  }
}

/**
 * Convert value from pixels to specified unit based on DPI.
 */
export function fromPx(px: number, unit: Unit, dpi: number = DEFAULT_DPI): number {
  if (dpi <= 0) dpi = DEFAULT_DPI;
  switch (unit) {
    case 'px':
      return Math.round(px);
    case 'in':
      return Number((px / dpi).toFixed(2));
    case 'cm':
      return Number(((px * 2.54) / dpi).toFixed(2));
    case 'mm':
      return Number(((px * 25.4) / dpi).toFixed(1));
    default:
      return Math.round(px);
  }
}

/**
 * Format dimension string for display with unit.
 */
export function formatDimension(px: number, unit: Unit, dpi: number = DEFAULT_DPI): string {
  const val = fromPx(px, unit, dpi);
  return `${val} ${unit}`;
}

/**
 * Check if dimensions exceed browser canvas limits (e.g. Safari 16384, Chrome 32767, area 268MP).
 */
export function isCanvasSizeExceeded(w: number, h: number): {
  exceeded: boolean;
  reason?: string;
} {
  const maxSide = 16384;
  const maxArea = 268435456; // 16384 * 16384

  if (w > maxSide || h > maxSide) {
    return {
      exceeded: true,
      reason: `Dimension (${Math.max(w, h)}px) exceeds safe browser limit of 16,384px per side.`,
    };
  }
  if (w * h > maxArea) {
    return {
      exceeded: true,
      reason: `Canvas area (${((w * h) / 1000000).toFixed(1)} MP) exceeds browser memory limits.`,
    };
  }
  return { exceeded: false };
}
