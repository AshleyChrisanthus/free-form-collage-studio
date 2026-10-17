import { describe, it, expect, beforeEach } from 'vitest';
import { SnapshotHistoryEngine, type SceneSnapshot } from '../src/store/history/snapshotHistory';
import { PatchHistoryEngine } from '../src/store/history/patchHistory';
import { produce, produceWithPatches } from 'immer';

describe('History Engines', () => {
  describe('SnapshotHistoryEngine', () => {
    let state: SceneSnapshot;
    let engine: SnapshotHistoryEngine;

    beforeEach(() => {
      state = {
        objects: [],
        groupCounter: 1,
        selection: [],
      };
      engine = new SnapshotHistoryEngine(
        () => state,
        (s) => {
          state = s;
        }
      );
    });

    it('records and restores snapshot state on undo/redo', () => {
      expect(engine.canUndo).toBe(false);

      // Begin transaction
      engine.begin('Add Object');
      state = {
        ...state,
        objects: [
          {
            id: '1',
            type: 'image',
            assetId: 'a1',
            x: 10,
            y: 10,
            width: 100,
            height: 100,
            origWidth: 100,
            origHeight: 100,
            mimeType: 'image/png',
            groupId: null,
            opacity: 1,
            rotation: 0,
            flipH: false,
            flipV: false,
          },
        ],
      };
      engine.commit();

      expect(engine.canUndo).toBe(true);
      expect(engine.getUndoLabel()).toBe('Add Object');
      expect(state.objects.length).toBe(1);

      // Undo
      engine.undo();
      expect(state.objects.length).toBe(0);
      expect(engine.canRedo).toBe(true);

      // Redo
      engine.redo();
      expect(state.objects.length).toBe(1);
    });

    it('cancels pending transaction cleanly without altering history', () => {
      engine.begin('Test');
      state = {
        ...state,
        objects: [
          {
            id: '2',
            type: 'image',
            assetId: 'a2',
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
          },
        ],
      };
      engine.cancel();

      expect(state.objects.length).toBe(0);
      expect(engine.canUndo).toBe(false);
    });

    it('enforces 50-step cap', () => {
      for (let i = 0; i < 60; i++) {
        engine.begin(`Step ${i}`);
        state = {
          ...state,
          objects: [
            {
              id: `${i}`,
              type: 'image',
              assetId: `a${i}`,
              x: i,
              y: i,
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
            },
          ],
        };
        engine.commit();
      }

      let undoCount = 0;
      while (engine.canUndo) {
        engine.undo();
        undoCount++;
      }
      expect(undoCount).toBe(50);
    });
  });

  describe('PatchHistoryEngine', () => {
    let state: { count: number; name: string };
    let engine: PatchHistoryEngine<{ count: number; name: string }>;

    beforeEach(() => {
      state = { count: 0, name: 'initial' };
      engine = new PatchHistoryEngine(
        () => state,
        (applyFn) => {
          state = produce(state, applyFn);
        }
      );
    });

    it('records patches and undoes/redoes correctly', () => {
      engine.begin('Increment');
      const [, patches, inverse] = produceWithPatches(state, (draft) => {
        draft.count = 1;
      });
      state.count = 1;
      engine.recordPatches(patches, inverse);
      engine.commit();

      expect(state.count).toBe(1);
      expect(engine.canUndo).toBe(true);

      engine.undo();
      expect(state.count).toBe(0);

      engine.redo();
      expect(state.count).toBe(1);
    });
  });
});
