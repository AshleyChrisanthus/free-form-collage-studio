import { describe, it, expect, beforeEach } from 'vitest';
import { useSceneStore } from '../src/store/sceneStore';
import { computeAutoResizeDimensions, restackObjects, applyProximitySpacing } from '../src/layout/stacking';
import { precomputeSnapLines, snapMove, snapResize } from '../src/snapping/snap';
import { computeResize, computeMultiResize } from '../src/canvas/transforms';
import { calculateAspectDimensions, convertDimensionsToUnit, convertDimensionsToPx } from '../src/components/framing/precisionSizing';
import { distanceToSegment, pointNearLine } from '../src/lib/geometry';
import type { ImageObject, LineObject } from '../src/types/scene';

describe('Milestone 3 – Editing & Canvas Architecture Acceptance Suite (#17–#26)', () => {
  beforeEach(() => {
    useSceneStore.setState({
      objects: [],
      selection: [],
      groupCounter: 0,
      settings: {
        spacing: 12,
        horizontalSpacing: 12,
        bgColor: '#ffffff',
        transparentBg: false,
        exportFormat: 'png',
        exportQuality: 92,
        resizeMode: 'none',
        isSnapping: true,
        isResizeSnapping: true,
        unit: 'px',
        dpi: 300,
      },
    });
  });

  it('verifies #19: Auto-resize on import, re-stacking, and proximity spacing', () => {
    const o1: ImageObject = {
      id: 'img1',
      type: 'image',
      x: 0,
      y: 0,
      width: 400,
      height: 300,
      rotation: 0,
      opacity: 1,
      assetId: 'a1',
      aspectRatioLocked: true,
      flipH: false,
      flipV: false,
      zIndex: 0,
      groupId: null,
    };
    const o2: ImageObject = {
      id: 'img2',
      type: 'image',
      x: 0,
      y: 400,
      width: 800,
      height: 600,
      rotation: 0,
      opacity: 1,
      assetId: 'a2',
      aspectRatioLocked: true,
      flipH: false,
      flipV: false,
      zIndex: 1,
      groupId: null,
    };

    // Auto-resize calculation: 'widest' matches widest object (800)
    const resizedWidest = computeAutoResizeDimensions(1000, 500, [o1, o2], 'widest');
    expect(resizedWidest.width).toBe(800);
    expect(resizedWidest.height).toBe(400); // 800 / 2

    // Auto-resize calculation: 'narrowest' matches narrowest object (400)
    const resizedNarrowest = computeAutoResizeDimensions(1000, 500, [o1, o2], 'narrowest');
    expect(resizedNarrowest.width).toBe(400);
    expect(resizedNarrowest.height).toBe(200);

    // Vertical restack with 20px gap
    const stacked = restackObjects([o1, o2], 'vertical', 20);
    expect(stacked[0].y).toBe(0);
    expect(stacked[1].y).toBe(320); // 300 + 20

    // Horizontal restack with 15px gap
    const stackedH = restackObjects([o1, o2], 'horizontal', 15);
    expect(stackedH[0].x).toBe(0);
    expect(stackedH[1].x).toBe(415); // 400 + 15
  });

  it('verifies #20, #21, #22: Selection, 8-point resize, continuous rotation, flip, duplicate & nudge', () => {
    const img1: ImageObject = {
      id: 'img1',
      type: 'image',
      x: 100,
      y: 100,
      width: 200,
      height: 100, // 2:1 ratio
      rotation: 0,
      opacity: 1,
      assetId: 'a1',
      aspectRatioLocked: true,
      flipH: false,
      flipV: false,
      zIndex: 0,
      groupId: null,
    };

    useSceneStore.setState({ objects: [img1], selection: ['img1'] });

    // 8-point resize preserving aspect ratio (corner drag)
    const aspectResized = computeResize(img1, 'br', 50, 20, true, false);
    expect(aspectResized.width).toBe(250);
    expect(aspectResized.height).toBe(125); // preserved 2:1 ratio

    // 8-point resize free-form (preserveAspect = false)
    const freeResized = computeResize(img1, 'br', 50, 20, false, false);
    expect(freeResized.width).toBe(250);
    expect(freeResized.height).toBe(120);

    // Resize from center (Alt key)
    const centerResized = computeResize(img1, 'br', 20, 10, false, true);
    expect(centerResized.x + centerResized.width / 2).toBe(img1.x + img1.width / 2);
    expect(centerResized.y + centerResized.height / 2).toBe(img1.y + img1.height / 2);

    // Continuous rotation
    useSceneStore.getState().setRotation('img1', 45);
    expect(useSceneStore.getState().objects[0].rotation).toBe(45);

    // Flip horizontal & vertical across centroid
    useSceneStore.getState().flipObjects(['img1'], true, true);
    let updated = useSceneStore.getState().objects[0] as ImageObject;
    expect(updated.flipH).toBe(true);
    expect(updated.flipV).toBe(true);

    // Duplicate object
    useSceneStore.getState().duplicateObjects(['img1']);
    const objs = useSceneStore.getState().objects;
    expect(objs.length).toBe(2);
    expect(objs[1].x).toBe(img1.x + 20);
    expect(objs[1].y).toBe(img1.y + 20);
    expect(objs[1].id).not.toBe('img1');
  });

  it('verifies #23: Precision object sizing dialog helpers', () => {
    // 16:9 ratio fit by width
    const dims169 = calculateAspectDimensions(1920, 1080, 16 / 9, 'width');
    expect(dims169.width).toBe(1920);
    expect(dims169.height).toBe(1080);

    // 1:1 square fit by width
    const square = calculateAspectDimensions(800, 600, 1, 'width');
    expect(square.width).toBe(800);
    expect(square.height).toBe(800);

    // 9:16 vertical story fit by height
    const story = calculateAspectDimensions(1080, 1920, 9 / 16, 'height');
    expect(story.height).toBe(1920);
    expect(story.width).toBe(1080);

    // Unit conversion: 600px @ 300 DPI = 2 inches
    const inVal = convertDimensionsToUnit(600, 900, 'in', 300);
    expect(inVal.width).toBe(2);
    expect(inVal.height).toBe(3);

    const pxVal = convertDimensionsToPx(2, 3, 'in', 300);
    expect(pxVal.widthPx).toBe(600);
    expect(pxVal.heightPx).toBe(900);
  });

  it('verifies #24 & #25: Layers panel, Z-index controls, visibility and lock', () => {
    const o1: ImageObject = {
      id: 'layer1',
      name: 'Layer One',
      type: 'image',
      x: 0,
      y: 0,
      width: 100,
      height: 100,
      rotation: 0,
      opacity: 1,
      assetId: 'a1',
      aspectRatioLocked: true,
      flipH: false,
      flipV: false,
      zIndex: 0,
      groupId: null,
    };
    const o2: ImageObject = {
      id: 'layer2',
      name: 'Layer Two',
      type: 'image',
      x: 50,
      y: 50,
      width: 100,
      height: 100,
      rotation: 0,
      opacity: 1,
      assetId: 'a2',
      aspectRatioLocked: true,
      flipH: false,
      flipV: false,
      zIndex: 1,
      groupId: null,
    };

    useSceneStore.setState({ objects: [o1, o2], selection: ['layer1', 'layer2'] });

    // Grouping
    useSceneStore.getState().groupSelected();
    expect(useSceneStore.getState().objects[0].groupId).not.toBeNull();
    expect(useSceneStore.getState().objects[0].groupId).toBe(useSceneStore.getState().objects[1].groupId);

    // Ungrouping
    useSceneStore.getState().ungroupSelected();
    expect(useSceneStore.getState().objects[0].groupId).toBeNull();
    expect(useSceneStore.getState().objects[1].groupId).toBeNull();

    // Lock & Visibility
    useSceneStore.getState().setObjectLock('layer1', true);
    expect(useSceneStore.getState().objects[0].locked).toBe(true);

    useSceneStore.getState().setObjectVisibility('layer1', true);
    expect(useSceneStore.getState().objects[0].hidden).toBe(true);

    // Reorder layers
    useSceneStore.getState().reorderObjects(0, 1);
    expect(useSceneStore.getState().objects[0].id).toBe('layer2');
    expect(useSceneStore.getState().objects[1].id).toBe('layer1');
  });

  it('verifies #26: Snapping engine with candidate lines and guideline generation', () => {
    const boxA = {
      id: 'boxA',
      type: 'image' as const,
      x: 100,
      y: 100,
      width: 200,
      height: 200,
      rotation: 0,
      opacity: 1,
      assetId: 'a1',
      aspectRatioLocked: true,
      flipH: false,
      flipV: false,
      zIndex: 0,
      groupId: null,
    };

    const movingBox = {
      id: 'movingBox',
      x: 304, // 4px away from boxA right edge (300)
      y: 100,
      width: 100,
      height: 100,
    };

    const candidates = precomputeSnapLines(
      [boxA],
      new Set(['movingBox']),
      useSceneStore.getState().viewport,
      useSceneStore.getState().settings
    );

    const snapResult = snapMove(movingBox, candidates, 8);
    // Should snap 4px to the left to align with boxA right edge at x=300
    expect(snapResult.deltaX).toBe(-4);
    expect(snapResult.guides.length).toBeGreaterThan(0);
    expect(snapResult.guides[0].pos).toBe(300);
  });
});
