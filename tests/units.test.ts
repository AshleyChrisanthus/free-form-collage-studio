import { describe, it, expect } from 'vitest';
import {
  toPx,
  fromPx,
  PAPER_PRESETS,
  isCanvasSizeExceeded,
} from '../src/lib/units';

describe('Unit Conversion Helpers & DPI', () => {
  it('converts correctly with default 300 DPI', () => {
    // px
    expect(toPx(100, 'px')).toBe(100);
    expect(fromPx(100, 'px')).toBe(100);

    // in (300 px per inch)
    expect(toPx(2, 'in', 300)).toBe(600);
    expect(fromPx(600, 'in', 300)).toBe(2);

    // cm (300 / 2.54 px per cm)
    expect(toPx(2.54, 'cm', 300)).toBe(300);
    expect(fromPx(300, 'cm', 300)).toBe(2.54);

    // mm (300 / 25.4 px per mm)
    expect(toPx(25.4, 'mm', 300)).toBe(300);
    expect(fromPx(300, 'mm', 300)).toBe(25.4);
  });

  it('A4 @300DPI = 2480x3508 px and round-trips without drift', () => {
    // A4 is 210 x 297 mm
    const a4 = PAPER_PRESETS.find((p) => p.id === 'a4');
    expect(a4).toBeDefined();
    if (!a4) return;

    const wPx = toPx(a4.width, a4.unit, 300);
    const hPx = toPx(a4.height, a4.unit, 300);

    expect(wPx).toBe(2480);
    expect(hPx).toBe(3508);

    // Round-trip back to mm
    const wMm = fromPx(wPx, 'mm', 300);
    const hMm = fromPx(hPx, 'mm', 300);

    expect(wMm).toBe(210);
    expect(hMm).toBe(297);
  });

  it('warns when canvas dimensions exceed safe limits', () => {
    expect(isCanvasSizeExceeded(1200, 800).exceeded).toBe(false);
    expect(isCanvasSizeExceeded(20000, 1000).exceeded).toBe(true);
    expect(isCanvasSizeExceeded(18000, 18000).exceeded).toBe(true);
  });
});
