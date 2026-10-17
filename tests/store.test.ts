import { describe, it, expect, beforeEach } from 'vitest';
import { useSceneStore } from '../src/store/sceneStore';
import type { ImageObject, LineObject } from '../src/types/scene';

describe('Scene Store', () => {
  beforeEach(() => {
    useSceneStore.getState().resetScene();
  });

  it('adds and removes objects', () => {
    const img: ImageObject = {
      id: 'img-1',
      type: 'image',
      assetId: 'a1',
      x: 10,
      y: 20,
      width: 100,
      height: 80,
      origWidth: 100,
      origHeight: 80,
      mimeType: 'image/png',
      groupId: null,
      opacity: 1,
      rotation: 0,
      flipH: false,
      flipV: false,
    };

    useSceneStore.getState().addObject(img);
    expect(useSceneStore.getState().objects.length).toBe(1);
    expect(useSceneStore.getState().selection).toEqual(['img-1']);

    useSceneStore.getState().removeObjects(['img-1']);
    expect(useSceneStore.getState().objects.length).toBe(0);
    expect(useSceneStore.getState().selection).toEqual([]);
  });

  it('moves objects by delta', () => {
    const img: ImageObject = {
      id: 'img-1',
      type: 'image',
      assetId: 'a1',
      x: 10,
      y: 20,
      width: 100,
      height: 80,
      origWidth: 100,
      origHeight: 80,
      mimeType: 'image/png',
      groupId: null,
      opacity: 1,
      rotation: 0,
      flipH: false,
      flipV: false,
    };

    useSceneStore.getState().addObject(img);
    useSceneStore.getState().moveObjects(['img-1'], 15, -5);

    const moved = useSceneStore.getState().objects[0];
    expect(moved.x).toBe(25);
    expect(moved.y).toBe(15);
  });

  it('groups and ungroups selected objects', () => {
    const o1: ImageObject = {
      id: '1',
      type: 'image',
      assetId: 'a1',
      x: 0,
      y: 0,
      width: 50,
      height: 50,
      origWidth: 50,
      origHeight: 50,
      mimeType: 'image/png',
      groupId: null,
      opacity: 1,
      rotation: 0,
      flipH: false,
      flipV: false,
    };
    const o2: ImageObject = {
      id: '2',
      type: 'image',
      assetId: 'a2',
      x: 100,
      y: 0,
      width: 50,
      height: 50,
      origWidth: 50,
      origHeight: 50,
      mimeType: 'image/png',
      groupId: null,
      opacity: 1,
      rotation: 0,
      flipH: false,
      flipV: false,
    };

    useSceneStore.getState().addObjects([o1, o2]);
    useSceneStore.getState().setSelection(['1', '2']);
    useSceneStore.getState().groupSelected();

    const objs = useSceneStore.getState().objects;
    expect(objs[0].groupId).not.toBeNull();
    expect(objs[0].groupId).toBe(objs[1].groupId);

    // Ungroup
    useSceneStore.getState().ungroupSelected();
    const ungrouped = useSceneStore.getState().objects;
    expect(ungrouped[0].groupId).toBeNull();
    expect(ungrouped[1].groupId).toBeNull();
  });

  it('rotates and clamps rotation degree between -180 and 180', () => {
    const img: ImageObject = {
      id: '1',
      type: 'image',
      assetId: 'a1',
      x: 0,
      y: 0,
      width: 50,
      height: 50,
      origWidth: 50,
      origHeight: 50,
      mimeType: 'image/png',
      groupId: null,
      opacity: 1,
      rotation: 0,
      flipH: false,
      flipV: false,
    };
    useSceneStore.getState().addObject(img);
    useSceneStore.getState().setRotation('1', 270);

    const rotated = useSceneStore.getState().objects[0];
    expect(rotated.rotation).toBe(-90);
  });
});
