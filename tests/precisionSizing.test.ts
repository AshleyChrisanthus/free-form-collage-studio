import { describe, it, expect } from 'vitest';
import {
  calculateAspectDimensions,
  convertDimensionsToUnit,
  convertDimensionsToPx,
  OBJECT_RATIO_PRESETS,
} from '../src/components/framing/precisionSizing';

describe('Precision Object Sizing (#23)', () => {
  describe('calculateAspectDimensions', () => {
    it('fits by width maintaining width and recalculating height', () => {
      // 800 width, 16:9 ratio -> height should be 800 / (16/9) = 450
      const dims = calculateAspectDimensions(800, 600, 16 / 9, 'width');
      expect(dims.width).toBe(800);
      expect(dims.height).toBe(450);
    });

    it('fits by height maintaining height and recalculating width', () => {
      // 600 height, 16:9 ratio -> width should be 600 * (16/9) = 1067
      const dims = calculateAspectDimensions(800, 600, 16 / 9, 'height');
      expect(dims.height).toBe(600);
      expect(dims.width).toBe(1067);
    });

    it('handles 1:1 square ratio preset', () => {
      const byWidth = calculateAspectDimensions(500, 300, 1, 'width');
      expect(byWidth.width).toBe(500);
      expect(byWidth.height).toBe(500);

      const byHeight = calculateAspectDimensions(500, 300, 1, 'height');
      expect(byHeight.width).toBe(300);
      expect(byHeight.height).toBe(300);
    });

    it('handles 4:3 and 3:4 portrait/landscape presets', () => {
      const dims43 = calculateAspectDimensions(400, 200, 4 / 3, 'width');
      expect(dims43.width).toBe(400);
      expect(dims43.height).toBe(300);

      const dims34 = calculateAspectDimensions(300, 500, 3 / 4, 'width');
      expect(dims34.width).toBe(300);
      expect(dims34.height).toBe(400);
    });

    it('enforces minimum dimension threshold of 20px', () => {
      const dims = calculateAspectDimensions(5, 5, 1, 'width');
      expect(dims.width).toBe(20);
      expect(dims.height).toBe(20);
    });
  });

  describe('Unit Conversions with DPI', () => {
    it('converts px to/from inches accurately with 300 DPI', () => {
      const unitVal = convertDimensionsToUnit(600, 900, 'in', 300);
      expect(unitVal.width).toBe(2);
      expect(unitVal.height).toBe(3);

      const pxVal = convertDimensionsToPx(2, 3, 'in', 300);
      expect(pxVal.widthPx).toBe(600);
      expect(pxVal.heightPx).toBe(900);
    });

    it('converts px to/from centimeters with 300 DPI', () => {
      // 300 px = 2.54 cm
      const unitVal = convertDimensionsToUnit(300, 600, 'cm', 300);
      expect(unitVal.width).toBe(2.54);
      expect(unitVal.height).toBe(5.08);

      const pxVal = convertDimensionsToPx(2.54, 5.08, 'cm', 300);
      expect(pxVal.widthPx).toBe(300);
      expect(pxVal.heightPx).toBe(600);
    });

    it('converts px to/from millimeters with 300 DPI', () => {
      // 300 px = 25.4 mm
      const unitVal = convertDimensionsToUnit(300, 600, 'mm', 300);
      expect(unitVal.width).toBe(25.4);
      expect(unitVal.height).toBe(50.8);

      const pxVal = convertDimensionsToPx(25.4, 50.8, 'mm', 300);
      expect(pxVal.widthPx).toBe(300);
      expect(pxVal.heightPx).toBe(600);
    });
  });

  describe('Ratio Presets', () => {
    it('includes required industry ratio presets', () => {
      const ids = OBJECT_RATIO_PRESETS.map((p) => p.id);
      expect(ids).toContain('1:1');
      expect(ids).toContain('4:3');
      expect(ids).toContain('3:4');
      expect(ids).toContain('16:9');
      expect(ids).toContain('9:16');
    });
  });
});
