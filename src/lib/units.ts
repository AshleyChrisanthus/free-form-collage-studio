import type { Unit } from '../types/scene';

const DEFAULT_DPI = 300;

/**
 * Convert value from specified unit to pixels based on DPI.
 */
export function toPx(value: number, unit: Unit, dpi: number = DEFAULT_DPI): number {
  switch (unit) {
    case 'px':
      return value;
    case 'in':
      return value * dpi;
    case 'cm':
      return (value * dpi) / 2.54;
    case 'mm':
      return (value * dpi) / 25.4;
    default:
      return value;
  }
}

/**
 * Convert value from pixels to specified unit based on DPI.
 */
export function fromPx(px: number, unit: Unit, dpi: number = DEFAULT_DPI): number {
  if (dpi <= 0) dpi = DEFAULT_DPI;
  switch (unit) {
    case 'px':
      return px;
    case 'in':
      return px / dpi;
    case 'cm':
      return (px * 2.54) / dpi;
    case 'mm':
      return (px * 25.4) / dpi;
    default:
      return px;
  }
}
