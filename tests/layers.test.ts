import { describe, it, expect, beforeEach } from 'vitest';
import { useSceneStore } from '../src/store/sceneStore';
import type { ImageObject, LineObject } from '../src/types/scene';

describe('Layers & Z-Index Suite (#24, #25)', () => {
  beforeEach(() => {
    const o1: ImageObject = {
      id: 'o1',
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
      id: 'o2',
      type: 'image',
      x: 10,
      y: 10,
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
    const o3: LineObject = {
      id: 'o3',
      type: 'line',
      x: 20,
      y: 20,
      width: 50,
      height: 50,
      rotation: 0,
      opacity: 1,
      points: [{ x: 20, y: 20 }, { x: 70, y: 70 }],
      strokeColor: '#000',
      strokeWidth: 2,
      strokePattern: 'solid',
      startCap: 'none',
      endCap: 'none',
      startBinding: null,
      endBinding: null,
      zIndex: 2,
      groupId: null,
    };

    useSceneStore.setState({
      objects: [o1, o2, o3],
      selection: [],
    });
  });

  it('reorders objects correctly using reorderObjects', () => {
    // Current order: ['o1', 'o2', 'o3']
    // Move o1 (index 0) to index 2
    useSceneStore.getState().reorderObjects(0, 2);
    const order = useSceneStore.getState().objects.map((o) => o.id);
    expect(order).toEqual(['o2', 'o3', 'o1']);
  });

  it('moves object to front (highest z-index / array end)', () => {
    useSceneStore.getState().bringToFront(['o1']);
    const order = useSceneStore.getState().objects.map((o) => o.id);
    expect(order).toEqual(['o2', 'o3', 'o1']);
  });

  it('sends object to back (lowest z-index / array start)', () => {
    useSceneStore.getState().sendToBack(['o3']);
    const order = useSceneStore.getState().objects.map((o) => o.id);
    expect(order).toEqual(['o3', 'o1', 'o2']);
  });

  it('brings object forward by one step', () => {
    useSceneStore.getState().bringForward(['o1']);
    const order = useSceneStore.getState().objects.map((o) => o.id);
    expect(order).toEqual(['o2', 'o1', 'o3']);
  });

  it('sends object backward by one step', () => {
    useSceneStore.getState().sendBackward(['o3']);
    const order = useSceneStore.getState().objects.map((o) => o.id);
    expect(order).toEqual(['o1', 'o3', 'o2']);
  });

  it('groups and ungroups selected objects', () => {
    useSceneStore.setState({ selection: ['o1', 'o2'] });
    useSceneStore.getState().groupSelected();

    const objs = useSceneStore.getState().objects;
    const g1 = objs.find((o) => o.id === 'o1')?.groupId;
    const g2 = objs.find((o) => o.id === 'o2')?.groupId;
    const g3 = objs.find((o) => o.id === 'o3')?.groupId;

    expect(g1).not.toBeNull();
    expect(g1).toBe(g2);
    expect(g3).toBeNull();

    // Selecting one group member expands selection to all group members
    useSceneStore.getState().setSelection(['o1']);
    expect(useSceneStore.getState().selection).toContain('o1');
    expect(useSceneStore.getState().selection).toContain('o2');

    // Ungroup
    useSceneStore.getState().ungroupSelected();
    const ungroupedObjs = useSceneStore.getState().objects;
    expect(ungroupedObjs.find((o) => o.id === 'o1')?.groupId).toBeNull();
    expect(ungroupedObjs.find((o) => o.id === 'o2')?.groupId).toBeNull();
  });

  it('sets and toggles object lock state', () => {
    useSceneStore.getState().setObjectLock('o1', true);
    let obj1 = useSceneStore.getState().objects.find((o) => o.id === 'o1');
    expect(obj1?.locked).toBe(true);

    useSceneStore.getState().setObjectLock('o1', false);
    obj1 = useSceneStore.getState().objects.find((o) => o.id === 'o1');
    expect(obj1?.locked).toBe(false);
  });

  it('sets and toggles object visibility state', () => {
    useSceneStore.getState().setObjectVisibility('o2', true);
    let obj2 = useSceneStore.getState().objects.find((o) => o.id === 'o2');
    expect(obj2?.hidden).toBe(true);

    useSceneStore.getState().setObjectVisibility('o2', false);
    obj2 = useSceneStore.getState().objects.find((o) => o.id === 'o2');
    expect(obj2?.hidden).toBe(false);
  });

  it('renames object successfully', () => {
    useSceneStore.getState().renameObject('o1', 'Hero Background');
    const obj1 = useSceneStore.getState().objects.find((o) => o.id === 'o1');
    expect(obj1?.name).toBe('Hero Background');
  });

  it('tracks undo/redo for layer operations', () => {
    useSceneStore.getState().bringToFront(['o1']);
    expect(useSceneStore.getState().objects[2].id).toBe('o1');

    useSceneStore.getState().undo();
    expect(useSceneStore.getState().objects[0].id).toBe('o1');

    useSceneStore.getState().redo();
    expect(useSceneStore.getState().objects[2].id).toBe('o1');
  });
});
