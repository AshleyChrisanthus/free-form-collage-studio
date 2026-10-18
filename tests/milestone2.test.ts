import { describe, it, expect, beforeEach } from 'vitest';
import { useSceneStore } from '../src/store/sceneStore';
import { unionBounds } from '../src/lib/geometry';
import type { CanvasObject } from '../src/types/scene';

describe('Milestone 2 Acceptance & Integration Tests', () => {
  beforeEach(() => {
    useSceneStore.getState().resetScene();
  });

  it('Dual-Engine Toggle: switching back and forth 10x preserves object coordinates bit-identical and restores cameras (#16)', () => {
    const store = useSceneStore.getState();

    // 1. Configure creation engine camera
    store.setWorkMode('unlimited');
    store.setPan(150, -80);
    store.setZoom(2.5);

    // 2. Add sample objects
    const obj1: CanvasObject = {
      id: 'img-1',
      type: 'image',
      x: 123.456,
      y: 789.012,
      width: 400,
      height: 300,
      opacity: 0.9,
      rotation: 15,
      flipH: false,
      flipV: false,
      groupId: null,
      assetId: 'asset-1',
    };
    const obj2: CanvasObject = {
      id: 'img-2',
      type: 'image',
      x: 600,
      y: 200,
      width: 250,
      height: 250,
      opacity: 1,
      rotation: 0,
      flipH: true,
      flipV: false,
      groupId: null,
      assetId: 'asset-2',
    };
    store.addObject(obj1);
    store.addObject(obj2);

    // 3. Switch to framing engine and set its camera
    store.setWorkMode('standard');
    store.setFramingZoom(0.65);

    // 4. Toggle back and forth 10 times
    for (let i = 0; i < 10; i++) {
      store.setWorkMode('unlimited');
      expect(useSceneStore.getState().viewport.workMode).toBe('unlimited');
      expect(useSceneStore.getState().viewport.ulPanX).toBe(150);
      expect(useSceneStore.getState().viewport.ulPanY).toBe(-80);
      expect(useSceneStore.getState().viewport.ulZoom).toBe(2.5);

      store.setWorkMode('standard');
      expect(useSceneStore.getState().viewport.workMode).toBe('standard');
      expect(useSceneStore.getState().viewport.zoomLevel).toBe(0.65);
    }

    // 5. Verify object coordinates are bit-identical
    const currentObjs = useSceneStore.getState().objects;
    expect(currentObjs[0].x).toBe(123.456);
    expect(currentObjs[0].y).toBe(789.012);
    expect(currentObjs[1].x).toBe(600);
    expect(currentObjs[1].y).toBe(200);
  });

  it('Canvas Size Lock: toggling lock on and off never alters on-screen object position (#14)', () => {
    const store = useSceneStore.getState();
    store.setWorkMode('standard');
    store.setCanvasPreset('1:1');

    const obj: CanvasObject = {
      id: 'test-obj',
      type: 'image',
      x: 100,
      y: 100,
      width: 300,
      height: 200,
      opacity: 1,
      rotation: 0,
      flipH: false,
      flipV: false,
      groupId: null,
      assetId: 'a1',
    };
    store.addObject(obj);

    const initialObjX = useSceneStore.getState().objects[0].x;
    const initialObjY = useSceneStore.getState().objects[0].y;

    // Turn lock ON
    store.setCanvasLock(true);
    const lockedState = useSceneStore.getState();
    expect(lockedState.viewport.canvasLocked).toBe(true);
    expect(lockedState.viewport.lockedCanvasW).toBeGreaterThan(0);
    expect(lockedState.viewport.lockedCanvasH).toBeGreaterThan(0);

    // Visual position on screen is (obj.x + renderOffsetX):
    const screenXWhenLocked = lockedState.objects[0].x + lockedState.viewport.renderOffsetX;
    const screenYWhenLocked = lockedState.objects[0].y + lockedState.viewport.renderOffsetY;
    expect(screenXWhenLocked).toBe(initialObjX);
    expect(screenYWhenLocked).toBe(initialObjY);

    // Turn lock OFF
    store.setCanvasLock(false);
    const unlockedState = useSceneStore.getState();
    expect(unlockedState.viewport.canvasLocked).toBe(false);
    expect(unlockedState.objects[0].x).toBe(initialObjX);
    expect(unlockedState.objects[0].y).toBe(initialObjY);
  });

  it('Wrap Canvas to Content: translates content to (0,0) and creates exact canvas match with undo support (#14)', () => {
    const store = useSceneStore.getState();
    store.setWorkMode('standard');

    const obj1: CanvasObject = {
      id: 'o1',
      type: 'image',
      x: 250,
      y: 350,
      width: 200,
      height: 150,
      opacity: 1,
      rotation: 0,
      flipH: false,
      flipV: false,
      groupId: null,
      assetId: 'a1',
    };
    const obj2: CanvasObject = {
      id: 'o2',
      type: 'image',
      x: 500,
      y: 600,
      width: 100,
      height: 100,
      opacity: 1,
      rotation: 0,
      flipH: false,
      flipV: false,
      groupId: null,
      assetId: 'a2',
    };
    store.addObjects([obj1, obj2]);

    // Wrap to content
    store.wrapToContent();

    const wrappedState = useSceneStore.getState();
    expect(wrappedState.viewport.canvasMode).toBe('auto');
    expect(wrappedState.viewport.canvasLocked).toBe(false);

    const bounds = unionBounds(wrappedState.objects);
    expect(bounds).toBeDefined();
    if (bounds) {
      expect(bounds.x).toBe(0);
      expect(bounds.y).toBe(0);
      // Width was 500 + 100 - 250 = 350, height was 600 + 100 - 350 = 350
      expect(bounds.width).toBe(350);
      expect(bounds.height).toBe(350);
    }

    // Undo restores original positions
    store.undo();
    const undoneState = useSceneStore.getState();
    expect(undoneState.objects[0].x).toBe(250);
    expect(undoneState.objects[0].y).toBe(350);
  });
});
