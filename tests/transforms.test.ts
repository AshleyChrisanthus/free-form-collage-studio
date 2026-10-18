import { describe, it, expect, beforeEach, vi } from 'vitest';
import { computeResize, computeMultiResize } from '../src/canvas/transforms';
import { getRotatedCursor } from '../src/canvas/drawOverlay';
import { distanceToSegment, pointNearLine } from '../src/lib/geometry';
import { useSceneStore } from '../src/store/sceneStore';
import { handleGlobalKeyDown } from '../src/input/shortcuts';
import type { ImageObject, LineObject } from '../src/types/scene';

describe('Transforms & Editing (#20, #21, #22)', () => {
  beforeEach(() => {
    useSceneStore.setState({
      objects: [],
      selection: [],
    });
  });

  describe('computeResize', () => {
    const box = { x: 100, y: 100, width: 200, height: 100 }; // 2:1 aspect ratio

    it('preserves aspect ratio by default on corner handles', () => {
      // Bottom-right drag by dx=40, dy=10
      // Dominant delta is dx=40, so width becomes 240, height becomes 240 / 2 = 120
      const resized = computeResize(box, 'br', 40, 10, true, false);
      expect(resized.width).toBe(240);
      expect(resized.height).toBe(120);
      expect(resized.x).toBe(100);
      expect(resized.y).toBe(100);
    });

    it('allows free-form scaling when preserveAspect is false (Shift key)', () => {
      const resized = computeResize(box, 'br', 40, 10, false, false);
      expect(resized.width).toBe(240);
      expect(resized.height).toBe(110);
      expect(resized.x).toBe(100);
      expect(resized.y).toBe(100);
    });

    it('resizes from center when fromCenter is true (Alt key)', () => {
      // Starting center is (200, 150)
      const resized = computeResize(box, 'br', 20, 20, false, true);
      expect(resized.width).toBe(240);
      expect(resized.height).toBe(140);
      // New center should still be (200, 150)
      const newCenterX = resized.x + resized.width / 2;
      const newCenterY = resized.y + resized.height / 2;
      expect(newCenterX).toBe(200);
      expect(newCenterY).toBe(150);
    });

    it('stretches only along axis for edge handles', () => {
      // Middle-right stretches width only
      const mr = computeResize(box, 'mr', 30, 50, false, false);
      expect(mr.width).toBe(230);
      expect(mr.height).toBe(100);
      expect(mr.x).toBe(100);
      expect(mr.y).toBe(100);

      // Bottom-center stretches height only
      const bc = computeResize(box, 'bc', 50, 30, false, false);
      expect(bc.width).toBe(200);
      expect(bc.height).toBe(130);
      expect(bc.x).toBe(100);
      expect(bc.y).toBe(100);

      // Top-center moves y and changes height
      const tc = computeResize(box, 'tc', 0, -20, false, false);
      expect(tc.width).toBe(200);
      expect(tc.height).toBe(120);
      expect(tc.y).toBe(80);
    });

    it('handles rotated bounding boxes preserving anchor in rotated space', () => {
      // 90 degree rotated object
      const rotatedBox = { x: 100, y: 100, width: 200, height: 100, rotation: 90 };
      const resized = computeResize(rotatedBox, 'mr', 0, 50, false, false);
      // For 90 deg, dragging +Y in world is +X in object local space
      expect(resized.width).toBe(250);
      expect(resized.height).toBe(100);
    });
  });

  describe('computeMultiResize', () => {
    it('scales multiple objects proportionally within collective bounding box', () => {
      const obj1 = { x: 0, y: 0, width: 100, height: 100 };
      const obj2 = { x: 200, y: 0, width: 100, height: 100 };
      const union = { x: 0, y: 0, width: 300, height: 100 };

      const initialBoxes = new Map<string, any>([
        ['__multi__', union],
        ['obj1', obj1],
        ['obj2', obj2],
      ]);

      // Scale multi-box from width 300 to 600 (scale 2x)
      const result = computeMultiResize(initialBoxes, ['obj1', 'obj2'], 'mr', 300, 0, false, false);
      const newUnion = result.get('__multi__');
      expect(newUnion?.width).toBe(600);

      const newObj1 = result.get('obj1');
      const newObj2 = result.get('obj2');

      expect(newObj1?.x).toBe(0);
      expect(newObj1?.width).toBe(200);

      expect(newObj2?.x).toBe(400); // 200 * 2
      expect(newObj2?.width).toBe(200);
    });
  });

  describe('getRotatedCursor', () => {
    it('calculates rotated cursor based on handle type and object rotation', () => {
      expect(getRotatedCursor('rot', 45)).toBe('crosshair');
      expect(getRotatedCursor('tc', 0)).toBe('ns-resize');
      expect(getRotatedCursor('tc', 90)).toBe('ew-resize');
      expect(getRotatedCursor('mr', 0)).toBe('ew-resize');
      expect(getRotatedCursor('mr', 90)).toBe('ns-resize');
      expect(getRotatedCursor('br', 0)).toBe('nwse-resize');
      expect(getRotatedCursor('br', 90)).toBe('nesw-resize');
    });
  });

  describe('Line Hit Testing (#20)', () => {
    it('computes distance to line segment correctly', () => {
      const p1 = { x: 0, y: 0 };
      const p2 = { x: 100, y: 0 };

      // Point right on line
      expect(distanceToSegment({ x: 50, y: 0 }, p1, p2)).toBe(0);
      // Point 5px above line
      expect(distanceToSegment({ x: 50, y: 5 }, p1, p2)).toBe(5);
      // Point before start
      expect(distanceToSegment({ x: -10, y: 0 }, p1, p2)).toBe(10);
      // Point after end
      expect(distanceToSegment({ x: 110, y: 0 }, p1, p2)).toBe(10);
    });

    it('detects point near line with stroke threshold', () => {
      const p1 = { x: 10, y: 10 };
      const p2 = { x: 100, y: 100 };

      expect(pointNearLine({ x: 55, y: 55 }, { points: [p1, p2], strokeWidth: 4 })).toBe(true);
      expect(pointNearLine({ x: 50, y: 80 }, { points: [p1, p2], strokeWidth: 4 })).toBe(false);
    });
  });

  describe('Flip, Duplicate, and Line Binding Remapping (#22)', () => {
    it('flips objects across selection centroid horizontally and vertically', () => {
      const obj1: ImageObject = {
        id: 'img1',
        type: 'image',
        x: 100,
        y: 100,
        width: 100,
        height: 100,
        rotation: 0,
        opacity: 1,
        assetId: 'asset1',
        crop: { x: 0, y: 0, width: 1, height: 1 },
        aspectRatioLocked: true,
        flipH: false,
        flipV: false,
        colorAdjustments: { brightness: 100, contrast: 100, saturation: 100, warmth: 0, vignette: 0 },
        zIndex: 0,
        groupId: null,
      };

      useSceneStore.setState({ objects: [obj1], selection: ['img1'] });

      // Flip horizontal
      useSceneStore.getState().flipObjects(['img1'], true, false);
      let updated = useSceneStore.getState().objects[0] as ImageObject;
      expect(updated.flipH).toBe(true);

      // Flip vertical
      useSceneStore.getState().flipObjects(['img1'], false, true);
      updated = useSceneStore.getState().objects[0] as ImageObject;
      expect(updated.flipV).toBe(true);
    });

    it('duplicates objects with +20/+20 offset and remaps line bindings', () => {
      const img1: ImageObject = {
        id: 'img1',
        type: 'image',
        x: 50,
        y: 50,
        width: 100,
        height: 100,
        rotation: 0,
        opacity: 1,
        assetId: 'a1',
        crop: { x: 0, y: 0, width: 1, height: 1 },
        aspectRatioLocked: true,
        flipH: false,
        flipV: false,
        colorAdjustments: { brightness: 100, contrast: 100, saturation: 100, warmth: 0, vignette: 0 },
        zIndex: 0,
        groupId: null,
      };

      const line1: LineObject = {
        id: 'line1',
        type: 'line',
        x: 100,
        y: 100,
        width: 50,
        height: 50,
        rotation: 0,
        opacity: 1,
        points: [{ x: 100, y: 100 }, { x: 150, y: 150 }],
        strokeColor: '#000000',
        strokeWidth: 2,
        strokePattern: 'solid',
        startCap: 'none',
        endCap: 'arrow',
        startBinding: { elementId: 'img1', edge: 'right' },
        endBinding: null,
        zIndex: 1,
        groupId: null,
      };

      useSceneStore.setState({ objects: [img1, line1], selection: ['img1', 'line1'] });

      useSceneStore.getState().duplicateObjects(['img1', 'line1']);

      const currentObjs = useSceneStore.getState().objects;
      expect(currentObjs.length).toBe(4);

      const duplicatedImg = currentObjs[2] as ImageObject;
      const duplicatedLine = currentObjs[3] as LineObject;

      expect(duplicatedImg.x).toBe(70); // 50 + 20
      expect(duplicatedImg.y).toBe(70);
      expect(duplicatedImg.id).not.toBe('img1');

      expect(duplicatedLine.startBinding?.elementId).toBe(duplicatedImg.id);
    });
  });

  describe('Debounced Arrow Nudge Coalescing (#22)', () => {
    it('coalesces rapid arrow nudges into a single undo transaction', async () => {
      vi.useFakeTimers();

      const img: ImageObject = {
        id: 'nudge-me',
        type: 'image',
        x: 100,
        y: 100,
        width: 100,
        height: 100,
        rotation: 0,
        opacity: 1,
        assetId: 'a1',
        crop: { x: 0, y: 0, width: 1, height: 1 },
        aspectRatioLocked: true,
        flipH: false,
        flipV: false,
        colorAdjustments: { brightness: 100, contrast: 100, saturation: 100, warmth: 0, vignette: 0 },
        zIndex: 0,
        groupId: null,
      };

      useSceneStore.setState({ objects: [img], selection: ['nudge-me'] });

      // Nudge right 3 times rapidly
      handleGlobalKeyDown(new KeyboardEvent('keydown', { key: 'ArrowRight' }));
      handleGlobalKeyDown(new KeyboardEvent('keydown', { key: 'ArrowRight' }));
      handleGlobalKeyDown(new KeyboardEvent('keydown', { key: 'ArrowRight' }));

      let currentObj = useSceneStore.getState().objects[0];
      expect(currentObj.x).toBe(103);

      // Fast-forward debounce timer (300ms)
      vi.advanceTimersByTime(350);

      // Single undo should revert all 3 nudges back to x=100
      useSceneStore.getState().undo();
      currentObj = useSceneStore.getState().objects[0];
      expect(currentObj.x).toBe(100);

      vi.useRealTimers();
    });
  });
});
