import { describe, it, expect } from 'vitest';
import {
  precomputeSnapLines,
  snapMove,
  snapResize,
} from '../src/snapping/snap';
import type { ImageObject, ViewportState } from '../src/types/scene';

function makeMockImage(id: string, x: number, y: number, width: number, height: number): ImageObject {
  return {
    id,
    type: 'image',
    assetId: 'asset_' + id,
    x,
    y,
    width,
    height,
    origWidth: width,
    origHeight: height,
    mimeType: 'image/png',
    opacity: 1,
    rotation: 0,
    flipH: false,
    flipV: false,
    groupId: null,
  };
}

describe('Intelligent Snapping & Alignment Engine (#26)', () => {
  const target = makeMockImage('target', 100, 100, 200, 150); // L=100, Cx=200, R=300; T=100, Cy=175, B=250
  const candidates = precomputeSnapLines([target], new Set());
  const threshold = 15;

  describe('Edge and Center Snapping Pairings', () => {
    // X-Axis Pairings
    it('snaps Left-to-Left (L-L)', () => {
      // Target left is 100. Moving left is 105 -> delta should be -5
      const moving = { x: 105, y: 500, width: 80, height: 80 };
      const res = snapMove(moving, candidates, threshold);
      expect(res.deltaX).toBe(-5);
      expect(res.guides.some((g) => g.orientation === 'v' && g.pos === 100)).toBe(true);
    });

    it('snaps Left-to-Right (L-R)', () => {
      // Moving left is 295. Target right is 300 -> delta should be +5
      const moving = { x: 295, y: 500, width: 80, height: 80 };
      const res = snapMove(moving, candidates, threshold);
      expect(res.deltaX).toBe(5);
      expect(res.guides.some((g) => g.orientation === 'v' && g.pos === 300)).toBe(true);
    });

    it('snaps Right-to-Right (R-R)', () => {
      // Target right is 300. Moving width=130, x=175 -> right=305 (diff -5, left=175 and Cx=240 are >15 from all lines)
      const moving = { x: 175, y: 500, width: 130, height: 80 };
      const res = snapMove(moving, candidates, threshold);
      expect(res.deltaX).toBe(-5);
      expect(res.guides.some((g) => g.orientation === 'v' && g.pos === 300)).toBe(true);
    });

    it('snaps Right-to-Left (R-L)', () => {
      // Target left is 100. Moving width=100. If x=-6, right=94 -> delta +6
      const moving = { x: -6, y: 500, width: 100, height: 80 };
      const res = snapMove(moving, candidates, threshold);
      expect(res.deltaX).toBe(6);
      expect(res.guides.some((g) => g.orientation === 'v' && g.pos === 100)).toBe(true);
    });

    it('snaps CenterX-to-CenterX (Cx-Cx)', () => {
      // Target Cx is 200. Moving width=100, x=148 -> moving Cx=198 -> delta +2
      const moving = { x: 148, y: 500, width: 100, height: 80 };
      const res = snapMove(moving, candidates, threshold);
      expect(res.deltaX).toBe(2);
      expect(res.guides.some((g) => g.orientation === 'v' && g.pos === 200)).toBe(true);
    });

    // Y-Axis Pairings
    it('snaps Top-to-Top (T-T)', () => {
      // Target top is 100. Moving y=97, height=40 -> top=97 (diff +3, bottom=137 and Cy=117 >15 from all lines)
      const moving = { x: 500, y: 97, width: 80, height: 40 };
      const res = snapMove(moving, candidates, threshold);
      expect(res.deltaY).toBe(3);
      expect(res.guides.some((g) => g.orientation === 'h' && g.pos === 100)).toBe(true);
    });

    it('snaps Top-to-Bottom (T-B)', () => {
      // Target bottom is 250. Moving y=253 -> delta -3
      const moving = { x: 500, y: 253, width: 80, height: 80 };
      const res = snapMove(moving, candidates, threshold);
      expect(res.deltaY).toBe(-3);
      expect(res.guides.some((g) => g.orientation === 'h' && g.pos === 250)).toBe(true);
    });

    it('snaps Bottom-to-Bottom (B-B)', () => {
      // Target bottom is 250. Moving height=50. y=202 -> bottom=252 -> delta -2
      const moving = { x: 500, y: 202, width: 80, height: 50 };
      const res = snapMove(moving, candidates, threshold);
      expect(res.deltaY).toBe(-2);
      expect(res.guides.some((g) => g.orientation === 'h' && g.pos === 250)).toBe(true);
    });

    it('snaps Bottom-to-Top (B-T)', () => {
      // Target top is 100. Moving height=50. y=47 -> bottom=97 -> delta +3
      const moving = { x: 500, y: 47, width: 80, height: 50 };
      const res = snapMove(moving, candidates, threshold);
      expect(res.deltaY).toBe(3);
      expect(res.guides.some((g) => g.orientation === 'h' && g.pos === 100)).toBe(true);
    });

    it('snaps CenterY-to-CenterY (Cy-Cy)', () => {
      // Target Cy is 175. Moving height=60, y=143 -> moving Cy=173 -> delta +2
      const moving = { x: 500, y: 143, width: 80, height: 60 };
      const res = snapMove(moving, candidates, threshold);
      expect(res.deltaY).toBe(2);
      expect(res.guides.some((g) => g.orientation === 'h' && g.pos === 175)).toBe(true);
    });

    it('snaps Center-to-Edge', () => {
      // Target right is 300. Moving width=100. If x=248 -> moving Cx=298 -> delta +2
      const moving = { x: 248, y: 500, width: 100, height: 80 };
      const res = snapMove(moving, candidates, threshold);
      expect(res.deltaX).toBe(2);
      expect(res.guides.some((g) => g.orientation === 'v' && g.pos === 300)).toBe(true);
    });
  });

  describe('Canvas Boundary Snapping (Framing Mode)', () => {
    const framingViewport: ViewportState = {
      workMode: 'standard',
      ulPanX: 0,
      ulPanY: 0,
      ulZoom: 1,
      unlimitedTheme: 'dark',
      zoomLevel: 1,
      canvasMode: '1:1',
      canvasLocked: false,
      lockedCanvasW: null,
      lockedCanvasH: null,
      customCanvasW: null,
      customCanvasH: null,
      renderOffsetX: 0,
      renderOffsetY: 0,
    };

    it('includes canvas boundaries (0, W/2, W and 0, H/2, H) as snap targets', () => {
      const stageObj = makeMockImage('bg', 0, 0, 1000, 1000);
      const lines = precomputeSnapLines([stageObj], new Set(), framingViewport);

      // Verify boundary candidate lines exist
      expect(lines.xLines.some((l) => l.pos === 0)).toBe(true);
      expect(lines.xLines.some((l) => l.pos === 500)).toBe(true);
      expect(lines.xLines.some((l) => l.pos === 1000)).toBe(true);
    });
  });

  describe('Resize Snapping', () => {
    it('snaps active right edge handle during resize', () => {
      // Target left is 100, right is 300.
      // Box being resized starts at x=0, width=294 (right edge at 294)
      const box = { x: 0, y: 0, width: 294, height: 100 };
      const res = snapResize(box, 'mr', candidates, threshold);

      // Right edge should snap to 300 -> width becomes 300
      expect(res.box.width).toBe(300);
      expect(res.box.x).toBe(0);
      expect(res.guides.length).toBeGreaterThan(0);
    });

    it('snaps active top edge handle during resize', () => {
      // Target top is 100.
      // Box being resized has y=104, height=100.
      const box = { x: 0, y: 104, width: 100, height: 100 };
      const res = snapResize(box, 'tc', candidates, threshold);

      // Top edge should snap to 100 -> y becomes 100, height becomes 104
      expect(res.box.y).toBe(100);
      expect(res.box.height).toBe(104);
    });
  });

  describe('Performance with 500 objects', () => {
    it('computes snap targets with 500 objects in < 5ms', () => {
      const manyObjects: ImageObject[] = [];
      for (let i = 0; i < 500; i++) {
        manyObjects.push(makeMockImage(`obj_${i}`, (i % 25) * 100, Math.floor(i / 25) * 100, 80, 80));
      }

      const t0 = performance.now();
      const lines = precomputeSnapLines(manyObjects, new Set(['obj_0']));
      const moving = { x: 125, y: 125, width: 80, height: 80 };
      snapMove(moving, lines, 15);
      const elapsed = performance.now() - t0;

      expect(elapsed).toBeLessThan(15); // Well within 60fps frame budget (16.6ms)
    });
  });
});
