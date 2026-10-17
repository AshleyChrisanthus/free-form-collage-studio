import { describe, it, expect } from 'vitest';
import { toPx, fromPx } from '../src/lib/units';

describe('Unit Conversion Helpers', () => {
  it('converts correctly with default 300 DPI', () => {
    // px
    expect(toPx(100, 'px')).toBe(100);
    expect(fromPx(100, 'px')).toBe(100);

    // in (300 px per inch)
    expect(toPx(2, 'in', 300)).toBe(600);
    expect(fromPx(600, 'in', 300)).toBe(2);

    // cm (300 / 2.54 px per cm)
    const pxInCm = 300 / 2.54;
    expect(toPx(1, 'cm', 300)).toBeCloseTo(pxInCm, 4);
    expect(fromPx(pxInCm, 'cm', 300)).toBeCloseTo(1, 4);

    // mm (300 / 25.4 px per mm)
    const pxInMm = 300 / 25.4;
    expect(toPx(10, 'mm', 300)).toBeCloseTo(pxInMm * 10, 4);
    expect(fromPx(pxInMm * 10, 'mm', 300)).toBeCloseTo(10, 4);
  });

  it('handles custom DPI (e.g. 72 screen DPI)', () => {
    expect(toPx(1, 'in', 72)).toBe(72);
    expect(fromPx(144, 'in', 72)).toBe(2);
  });
});
