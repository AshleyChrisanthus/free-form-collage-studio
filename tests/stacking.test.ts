import { describe, it, expect, beforeEach } from 'vitest';
import {
  computeAutoResizeDimensions,
  restackObjects,
  clusterIntoRows,
  clusterIntoColumns,
  applyProximitySpacing,
} from '../src/layout/stacking';
import type { ImageObject, LineObject } from '../src/types/scene';
import { useSceneStore } from '../src/store/sceneStore';

function makeMockImage(
  id: string,
  x: number,
  y: number,
  width: number,
  height: number,
  rotation = 0
): ImageObject {
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
    rotation,
    flipH: false,
    flipV: false,
    groupId: null,
  };
}

describe('Layout & Stacking Engine (#19)', () => {
  beforeEach(() => {
    useSceneStore.getState().resetScene();
  });

  describe('Auto-Resize Dimensions', () => {
    const existing = [
      makeMockImage('1', 0, 0, 200, 100),
      makeMockImage('2', 0, 0, 500, 250),
      makeMockImage('3', 0, 0, 100, 50),
    ];

    it('returns original dimensions when resizeMode is none', () => {
      const res = computeAutoResizeDimensions(300, 150, existing, 'none');
      expect(res).toEqual({ width: 300, height: 150 });
    });

    it('scales to match widest image preserving aspect ratio', () => {
      const res = computeAutoResizeDimensions(300, 150, existing, 'widest');
      // widest is 500, ratio is 300/150 = 2, so height should be 250
      expect(res.width).toBe(500);
      expect(res.height).toBe(250);
    });

    it('scales to match narrowest image preserving aspect ratio', () => {
      const res = computeAutoResizeDimensions(300, 150, existing, 'narrowest');
      // narrowest is 100, ratio is 2, so height should be 50
      expect(res.width).toBe(100);
      expect(res.height).toBe(50);
    });
  });

  describe('Re-Stack Commands', () => {
    it('re-stacks vertically: x=0, top-to-bottom with spacing gap', () => {
      const imgA = makeMockImage('a', 50, 300, 100, 80);
      const imgB = makeMockImage('b', 120, 10, 150, 60);
      const imgC = makeMockImage('c', 20, 150, 80, 40);

      const restacked = restackObjects([imgA, imgB, imgC], 'vertical', 20);

      // Sorted order by original y: b (y=10), c (y=150), a (y=300)
      const bRes = restacked.find((o) => o.id === 'b')!;
      const cRes = restacked.find((o) => o.id === 'c')!;
      const aRes = restacked.find((o) => o.id === 'a')!;

      expect(bRes.x).toBe(0);
      expect(bRes.y).toBe(0);

      // c should start at y_b + h_b + spacing = 0 + 60 + 20 = 80
      expect(cRes.x).toBe(0);
      expect(cRes.y).toBe(80);

      // a should start at y_c + h_c + spacing = 80 + 40 + 20 = 140
      expect(aRes.x).toBe(0);
      expect(aRes.y).toBe(140);
    });

    it('re-stacks horizontally: y=0, left-to-right with spacing gap', () => {
      const imgA = makeMockImage('a', 300, 50, 100, 80);
      const imgB = makeMockImage('b', 10, 120, 150, 60);

      const restacked = restackObjects([imgA, imgB], 'horizontal', 15);

      const bRes = restacked.find((o) => o.id === 'b')!;
      const aRes = restacked.find((o) => o.id === 'a')!;

      expect(bRes.x).toBe(0);
      expect(bRes.y).toBe(0);

      expect(aRes.x).toBe(150 + 15);
      expect(aRes.y).toBe(0);
    });

    it('preserves and updates bound line endpoints during re-stack', () => {
      const imgA = makeMockImage('a', 0, 0, 100, 100);
      const imgB = makeMockImage('b', 0, 200, 100, 100);

      const boundLine: LineObject = {
        id: 'line1',
        type: 'line',
        x: 50,
        y: 100,
        width: 1,
        height: 100,
        points: [
          { x: 50, y: 100 },
          { x: 50, y: 200 },
        ],
        strokeColor: '#3b82f6',
        strokeWidth: 2,
        strokeStyle: 'solid',
        roughness: 0,
        roughSeed: 1234,
        lineType: 'straight',
        startArrowhead: 'none',
        endArrowhead: 'arrow',
        startBinding: { elementId: 'a', edge: 'bottom' },
        endBinding: { elementId: 'b', edge: 'top' },
        opacity: 1,
        rotation: 0,
        flipH: false,
        flipV: false,
        groupId: null,
      };

      const restacked = restackObjects([imgA, imgB, boundLine], 'vertical', 30);
      const lineRes = restacked.find((o) => o.id === 'line1') as LineObject;
      const bRes = restacked.find((o) => o.id === 'b') as ImageObject;

      // b starts at 100 + 30 = 130
      expect(bRes.y).toBe(130);
      // line end point should be re-anchored to top of b: (50, 130)
      expect(lineRes.points[1].y).toBe(130);
    });
  });

  describe('Proximity Clustering (±50px threshold)', () => {
    it('clusters items into rows within 50px threshold', () => {
      const img1 = makeMockImage('1', 0, 10, 100, 50);
      const img2 = makeMockImage('2', 150, 40, 100, 50); // diff 30 <= 50 -> same row
      const img3 = makeMockImage('3', 0, 120, 100, 50); // diff 80 > 50 -> new row
      const img4 = makeMockImage('4', 200, 140, 100, 50); // diff 20 <= 50 -> same row as 3

      const rows = clusterIntoRows([img1, img2, img3, img4], 50);
      expect(rows.length).toBe(2);
      expect(rows[0].map((o) => o.id)).toEqual(['1', '2']);
      expect(rows[1].map((o) => o.id)).toEqual(['3', '4']);
    });

    it('clusters items into columns within 50px threshold', () => {
      const img1 = makeMockImage('1', 20, 0, 50, 100);
      const img2 = makeMockImage('2', 50, 150, 50, 100); // diff 30 <= 50
      const img3 = makeMockImage('3', 200, 0, 50, 100); // diff 150 > 50

      const cols = clusterIntoColumns([img1, img2, img3], 50);
      expect(cols.length).toBe(2);
      expect(cols[0].map((o) => o.id)).toEqual(['1', '2']);
      expect(cols[1].map((o) => o.id)).toEqual(['3']);
    });
  });

  describe('Proximity Spacing Sliders & Undo Transaction', () => {
    it('adjusts inter-row spacing and keeps intra-row positions', () => {
      const img1 = makeMockImage('1', 10, 0, 100, 80);
      const img2 = makeMockImage('2', 150, 0, 120, 80);
      const img3 = makeMockImage('3', 10, 150, 100, 80); // Row 2

      const adjusted = applyProximitySpacing([img1, img2, img3], 'vertical', 40);
      const r3 = adjusted.find((o) => o.id === '3')!;
      // Row 1 max height is 80, baseline is 0, newSpacing is 40 -> Row 2 should start at 0 + 80 + 40 = 120
      expect(r3.y).toBe(120);
      expect(r3.x).toBe(10); // Intra-row x kept intact
    });

    it('records exactly one undo step when dragging spacing slider with transaction', () => {
      const store = useSceneStore.getState();
      const img1 = makeMockImage('1', 0, 0, 100, 100);
      const img2 = makeMockImage('2', 0, 200, 100, 100);
      store.addObjects([img1, img2]);

      // Begin drag transaction
      store.beginTransaction('Change Vertical Spacing');
      store.setSpacing(30);
      store.setSpacing(45);
      store.setSpacing(60);
      store.commitTransaction();

      const objectsAfter = useSceneStore.getState().objects;
      const secondImg = objectsAfter.find((o) => o.id === '2')!;
      expect(secondImg.y).toBe(160); // 0 + 100 + 60

      // Undo reverts to initial state in one step
      useSceneStore.getState().undo();
      const reverted = useSceneStore.getState().objects.find((o) => o.id === '2')!;
      expect(reverted.y).toBe(200);
    });
  });
});
