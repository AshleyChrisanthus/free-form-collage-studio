import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import { produceWithPatches } from 'immer';
import type {
  CanvasObject,
  GlobalSettings,
  LineStyleDefaults,
  ToolMode,
  ViewportState,
  WorkMode,
  CanvasPreset,
  BoundingBox,
} from '../types/scene';
import { clamp, lineBounds, getBindingAnchor } from '../lib/geometry';
import { generateId } from '../lib/id';
import { isLine } from '../types/guards';
import { SnapshotHistoryEngine, type SceneSnapshot } from './history/snapshotHistory';
import { PatchHistoryEngine } from './history/patchHistory';
import { useVariantStore } from './variantStore';

export const DEFAULT_VIEWPORT: ViewportState = {
  workMode: 'unlimited',
  ulPanX: 0,
  ulPanY: 0,
  ulZoom: 1.0,
  unlimitedTheme: 'dark',
  zoomLevel: 1.0,
  canvasMode: 'auto',
  canvasLocked: false,
  lockedCanvasW: null,
  lockedCanvasH: null,
  customCanvasW: null,
  customCanvasH: null,
  renderOffsetX: 0,
  renderOffsetY: 0,
};

export const DEFAULT_SETTINGS: GlobalSettings = {
  spacing: 20,
  horizontalSpacing: 20,
  bgColor: '#ffffff',
  transparentBg: false,
  exportFormat: 'png',
  exportQuality: 90,
  resizeMode: 'none',
  isSnapping: true,
  isResizeSnapping: true,
  unit: 'px',
  dpi: 300,
};

export const DEFAULT_LINE_STYLE: LineStyleDefaults = {
  strokeColor: '#3b82f6',
  strokeWidth: 3,
  strokeStyle: 'solid',
  roughness: 0,
  lineType: 'straight',
  startArrowhead: 'none',
  endArrowhead: 'none',
};

export interface SceneState {
  objects: CanvasObject[];
  selection: string[];
  groupCounter: number;
  viewport: ViewportState;
  settings: GlobalSettings;
  tool: {
    mode: ToolMode;
    locked: boolean;
    lineDefaults: LineStyleDefaults;
  };
  ui: {
    layersOpen: boolean;
    propertiesOpen: boolean;
    activeDialog: string | null;
    toast: { id: string; message: string; type?: 'info' | 'error' | 'success' } | null;
  };
  historyState: {
    canUndo: boolean;
    canRedo: boolean;
    undoLabel: string | null;
    redoLabel: string | null;
  };

  // Object Mutations
  addObject: (obj: CanvasObject, label?: string) => void;
  addObjects: (objs: CanvasObject[], label?: string) => void;
  removeObjects: (ids: string[], label?: string) => void;
  updateObject: (id: string, patch: Partial<CanvasObject>, label?: string) => void;
  moveObjects: (ids: string[], dx: number, dy: number) => void;
  resizeObject: (id: string, box: BoundingBox) => void;
  setRotation: (id: string, rotationDeg: number) => void;
  flipObjects: (ids: string[], horizontal: boolean, vertical: boolean) => void;
  setOpacity: (ids: string[], opacity: number) => void;
  duplicateObjects: (ids: string[]) => void;
  reorderObjects: (fromIndex: number, toIndex: number) => void;
  bringToFront: (ids: string[]) => void;
  sendToBack: (ids: string[]) => void;
  bringForward: (ids: string[]) => void;
  sendBackward: (ids: string[]) => void;
  groupSelected: () => void;
  ungroupSelected: () => void;

  // Selection
  setSelection: (ids: string[]) => void;
  addToSelection: (id: string) => void;
  toggleSelection: (id: string) => void;
  clearSelection: () => void;
  selectAll: () => void;

  // Viewport
  setWorkMode: (mode: WorkMode) => void;
  setPan: (panX: number, panY: number) => void;
  setZoom: (zoom: number) => void;
  panBy: (dx: number, dy: number) => void;
  zoomBy: (factor: number, cx?: number, cy?: number) => void;
  setFramingZoom: (zoom: number) => void;
  setCanvasPreset: (preset: CanvasPreset) => void;
  setCanvasLock: (locked: boolean) => void;
  setCustomCanvasSize: (w: number, h: number) => void;
  setUnlimitedTheme: (theme: 'dark' | 'light') => void;

  // Settings
  updateSettings: (patch: Partial<GlobalSettings>) => void;

  // Tool
  setToolMode: (mode: ToolMode) => void;
  setToolLocked: (locked: boolean) => void;
  setLineDefaults: (defaults: Partial<LineStyleDefaults>) => void;

  // UI
  toggleLayers: (open?: boolean) => void;
  toggleProperties: (open?: boolean) => void;
  setActiveDialog: (dialog: string | null) => void;
  showToast: (message: string, type?: 'info' | 'error' | 'success') => void;
  hideToast: () => void;

  // History Actions
  beginTransaction: (label: string) => void;
  commitTransaction: () => void;
  cancelTransaction: () => void;
  undo: () => void;
  redo: () => void;
  clearHistory: () => void;

  // Persistence / Reset
  loadScene: (
    objects: CanvasObject[],
    settings?: Partial<GlobalSettings>,
    viewport?: Partial<ViewportState>
  ) => void;
  resetScene: () => void;
}

export const useSceneStore = create<SceneState>()(
  immer((set, get) => {
    const syncHistoryUI = () => {
      const isSnapshot = useVariantStore.getState().variants.history === 'snapshot';
      const engine = isSnapshot ? snapshotEngine : patchEngine;
      set((draft) => {
        draft.historyState.canUndo = engine.canUndo;
        draft.historyState.canRedo = engine.canRedo;
        draft.historyState.undoLabel = engine.getUndoLabel();
        draft.historyState.redoLabel = engine.getRedoLabel();
      });
    };

    // Snapshot History Engine
    const snapshotEngine = new SnapshotHistoryEngine(
      () => ({
        objects: get().objects,
        groupCounter: get().groupCounter,
        selection: get().selection,
      }),
      (snapshot: SceneSnapshot) => {
        set((draft) => {
          draft.objects = snapshot.objects;
          draft.groupCounter = snapshot.groupCounter;
          draft.selection = snapshot.selection;
        });
      },
      syncHistoryUI
    );

    // Patch History Engine
    const patchEngine = new PatchHistoryEngine<{
      objects: CanvasObject[];
      groupCounter: number;
      selection: string[];
    }>(
      () => ({
        objects: get().objects,
        groupCounter: get().groupCounter,
        selection: get().selection,
      }),
      (applyFn) => {
        set((draft) => {
          applyFn(draft);
        });
      },
      syncHistoryUI
    );

    const getActiveEngine = () => {
      const isSnapshot = useVariantStore.getState().variants.history === 'snapshot';
      return isSnapshot ? snapshotEngine : patchEngine;
    };

    // Helper to mutate scene state with patches recorded
    const mutateWithHistory = (
      label: string,
      mutator: (draft: SceneState) => void
    ) => {
      const isSnapshot = useVariantStore.getState().variants.history === 'snapshot';
      if (isSnapshot) {
        snapshotEngine.begin(label);
        set(mutator);
        snapshotEngine.commit();
      } else {
        const [nextState, patches, inversePatches] = produceWithPatches(
          {
            objects: get().objects,
            groupCounter: get().groupCounter,
            selection: get().selection,
          },
          (draft) => {
            const fakeDraft = {
              ...get(),
              objects: draft.objects,
              groupCounter: draft.groupCounter,
              selection: draft.selection,
            } as SceneState;
            mutator(fakeDraft);
            draft.objects = fakeDraft.objects;
            draft.groupCounter = fakeDraft.groupCounter;
            draft.selection = fakeDraft.selection;
          }
        );

        set((draft) => {
          draft.objects = nextState.objects;
          draft.groupCounter = nextState.groupCounter;
          draft.selection = nextState.selection;
        });
        patchEngine.recordPatches(patches, inversePatches);
      }
    };

    return {
      objects: [],
      selection: [],
      groupCounter: 1,
      viewport: { ...DEFAULT_VIEWPORT },
      settings: { ...DEFAULT_SETTINGS },
      tool: {
        mode: 'select',
        locked: false,
        lineDefaults: { ...DEFAULT_LINE_STYLE },
      },
      ui: {
        layersOpen: true,
        propertiesOpen: true,
        activeDialog: null,
        toast: null,
      },
      historyState: {
        canUndo: false,
        canRedo: false,
        undoLabel: null,
        redoLabel: null,
      },

      addObject: (obj: CanvasObject, label = 'Add Object') => {
        mutateWithHistory(label, (draft) => {
          draft.objects.push(obj);
          draft.selection = [obj.id];
        });
      },

      addObjects: (objs: CanvasObject[], label = 'Add Objects') => {
        if (objs.length === 0) return;
        mutateWithHistory(label, (draft) => {
          draft.objects.push(...objs);
          draft.selection = objs.map((o) => o.id);
        });
      },

      removeObjects: (ids: string[], label = 'Delete') => {
        if (ids.length === 0) return;
        const setIds = new Set(ids);
        mutateWithHistory(label, (draft) => {
          draft.objects = draft.objects.filter((o) => !setIds.has(o.id));
          draft.selection = draft.selection.filter((id) => !setIds.has(id));
        });
      },

      updateObject: (id: string, patch: Partial<CanvasObject>, label = 'Update Object') => {
        mutateWithHistory(label, (draft) => {
          const index = draft.objects.findIndex((o) => o.id === id);
          if (index !== -1) {
            draft.objects[index] = { ...draft.objects[index], ...patch } as CanvasObject;
          }
        });
      },

      moveObjects: (ids: string[], dx: number, dy: number) => {
        if (ids.length === 0 || (dx === 0 && dy === 0)) return;
        const idSet = new Set(ids);
        set((draft) => {
          // Also update bound line endpoints
          const movedObjects = new Map<string, CanvasObject>();

          for (const obj of draft.objects) {
            if (idSet.has(obj.id)) {
              obj.x += dx;
              obj.y += dy;
              if (isLine(obj)) {
                obj.points = obj.points.map((p) => ({ x: p.x + dx, y: p.y + dy }));
              }
              movedObjects.set(obj.id, obj);
            }
          }

          // Check if any lines have bindings to moved objects
          for (const obj of draft.objects) {
            if (isLine(obj)) {
              let updated = false;
              if (obj.startBinding && movedObjects.has(obj.startBinding.elementId)) {
                const target = movedObjects.get(obj.startBinding.elementId)!;
                obj.points[0] = getBindingAnchor(target, obj.startBinding.edge);
                updated = true;
              }
              if (obj.endBinding && movedObjects.has(obj.endBinding.elementId)) {
                const target = movedObjects.get(obj.endBinding.elementId)!;
                obj.points[obj.points.length - 1] = getBindingAnchor(
                  target,
                  obj.endBinding.edge
                );
                updated = true;
              }
              if (updated) {
                const bounds = lineBounds(obj.points, obj.strokeWidth);
                obj.x = bounds.x;
                obj.y = bounds.y;
                obj.width = bounds.width;
                obj.height = bounds.height;
              }
            }
          }
        });
      },

      resizeObject: (id: string, box: BoundingBox) => {
        set((draft) => {
          const obj = draft.objects.find((o) => o.id === id);
          if (obj) {
            obj.x = box.x;
            obj.y = box.y;
            obj.width = Math.max(20, box.width);
            obj.height = Math.max(20, box.height);
          }
        });
      },

      setRotation: (id: string, rotationDeg: number) => {
        // Clamped between -180 and 180
        let norm = rotationDeg % 360;
        if (norm > 180) norm -= 360;
        if (norm < -180) norm += 360;
        set((draft) => {
          const obj = draft.objects.find((o) => o.id === id);
          if (obj) {
            obj.rotation = Math.round(norm * 10) / 10;
          }
        });
      },

      flipObjects: (ids: string[], horizontal: boolean, vertical: boolean) => {
        if (ids.length === 0) return;
        const idSet = new Set(ids);
        mutateWithHistory('Flip', (draft) => {
          for (const obj of draft.objects) {
            if (idSet.has(obj.id)) {
              if (horizontal) obj.flipH = !obj.flipH;
              if (vertical) obj.flipV = !obj.flipV;
            }
          }
        });
      },

      setOpacity: (ids: string[], opacity: number) => {
        const clamped = clamp(opacity, 0, 1);
        set((draft) => {
          const idSet = new Set(ids);
          for (const obj of draft.objects) {
            if (idSet.has(obj.id)) {
              obj.opacity = clamped;
            }
          }
        });
      },

      duplicateObjects: (ids: string[]) => {
        if (ids.length === 0) return;
        const idSet = new Set(ids);
        const clones: CanvasObject[] = [];

        mutateWithHistory('Duplicate', (draft) => {
          for (const obj of draft.objects) {
            if (idSet.has(obj.id)) {
              const clone = structuredClone(obj);
              clone.id = generateId();
              clone.x += 20;
              clone.y += 20;
              if (isLine(clone)) {
                clone.points = clone.points.map((p) => ({ x: p.x + 20, y: p.y + 20 }));
                clone.startBinding = null;
                clone.endBinding = null;
              }
              clones.push(clone);
            }
          }
          draft.objects.push(...clones);
          draft.selection = clones.map((c) => c.id);
        });
      },

      reorderObjects: (fromIndex: number, toIndex: number) => {
        mutateWithHistory('Reorder Layer', (draft) => {
          if (
            fromIndex < 0 ||
            fromIndex >= draft.objects.length ||
            toIndex < 0 ||
            toIndex >= draft.objects.length
          ) {
            return;
          }
          const [moved] = draft.objects.splice(fromIndex, 1);
          draft.objects.splice(toIndex, 0, moved);
        });
      },

      bringToFront: (ids: string[]) => {
        const idSet = new Set(ids);
        mutateWithHistory('Bring to Front', (draft) => {
          const selected = draft.objects.filter((o) => idSet.has(o.id));
          const rest = draft.objects.filter((o) => !idSet.has(o.id));
          draft.objects = [...rest, ...selected];
        });
      },

      sendToBack: (ids: string[]) => {
        const idSet = new Set(ids);
        mutateWithHistory('Send to Back', (draft) => {
          const selected = draft.objects.filter((o) => idSet.has(o.id));
          const rest = draft.objects.filter((o) => !idSet.has(o.id));
          draft.objects = [...selected, ...rest];
        });
      },

      bringForward: (ids: string[]) => {
        if (ids.length === 0) return;
        mutateWithHistory('Bring Forward', (draft) => {
          for (let i = draft.objects.length - 2; i >= 0; i--) {
            if (ids.includes(draft.objects[i].id) && !ids.includes(draft.objects[i + 1].id)) {
              const temp = draft.objects[i];
              draft.objects[i] = draft.objects[i + 1];
              draft.objects[i + 1] = temp;
            }
          }
        });
      },

      sendBackward: (ids: string[]) => {
        if (ids.length === 0) return;
        mutateWithHistory('Send Backward', (draft) => {
          for (let i = 1; i < draft.objects.length; i++) {
            if (ids.includes(draft.objects[i].id) && !ids.includes(draft.objects[i - 1].id)) {
              const temp = draft.objects[i];
              draft.objects[i] = draft.objects[i - 1];
              draft.objects[i - 1] = temp;
            }
          }
        });
      },

      groupSelected: () => {
        const sel = get().selection;
        if (sel.length < 2) return;
        const newGroupId = get().groupCounter + 1;
        mutateWithHistory('Group', (draft) => {
          draft.groupCounter = newGroupId;
          for (const obj of draft.objects) {
            if (sel.includes(obj.id)) {
              obj.groupId = newGroupId;
            }
          }
        });
      },

      ungroupSelected: () => {
        const sel = get().selection;
        if (sel.length === 0) return;
        mutateWithHistory('Ungroup', (draft) => {
          for (const obj of draft.objects) {
            if (sel.includes(obj.id)) {
              obj.groupId = null;
            }
          }
        });
      },

      // Selection Actions
      setSelection: (ids: string[]) => {
        set((draft) => {
          // If any selected object has a groupId, also select all members of that group
          const groupIds = new Set<number>();
          for (const obj of draft.objects) {
            if (ids.includes(obj.id) && obj.groupId !== null) {
              groupIds.add(obj.groupId);
            }
          }

          if (groupIds.size > 0) {
            const fullIds = new Set(ids);
            for (const obj of draft.objects) {
              if (obj.groupId !== null && groupIds.has(obj.groupId)) {
                fullIds.add(obj.id);
              }
            }
            draft.selection = Array.from(fullIds);
          } else {
            draft.selection = ids;
          }
        });
      },

      addToSelection: (id: string) => {
        const current = get().selection;
        if (!current.includes(id)) {
          get().setSelection([...current, id]);
        }
      },

      toggleSelection: (id: string) => {
        const current = get().selection;
        if (current.includes(id)) {
          set((draft) => {
            const target = draft.objects.find((o) => o.id === id);
            if (target && target.groupId !== null) {
              draft.selection = draft.selection.filter(
                (sid) => draft.objects.find((o) => o.id === sid)?.groupId !== target.groupId
              );
            } else {
              draft.selection = draft.selection.filter((sid) => sid !== id);
            }
          });
        } else {
          get().setSelection([...current, id]);
        }
      },

      clearSelection: () => {
        set((draft) => {
          draft.selection = [];
        });
      },

      selectAll: () => {
        set((draft) => {
          draft.selection = draft.objects.map((o) => o.id);
        });
      },

      // Viewport Actions
      setWorkMode: (workMode: WorkMode) => {
        set((draft) => {
          draft.viewport.workMode = workMode;
        });
      },

      setPan: (panX: number, panY: number) => {
        set((draft) => {
          draft.viewport.ulPanX = panX;
          draft.viewport.ulPanY = panY;
        });
      },

      setZoom: (zoom: number) => {
        set((draft) => {
          draft.viewport.ulZoom = clamp(zoom, 0.02, 10.0);
        });
      },

      panBy: (dx: number, dy: number) => {
        set((draft) => {
          draft.viewport.ulPanX += dx;
          draft.viewport.ulPanY += dy;
        });
      },

      zoomBy: (factor: number, cx = window.innerWidth / 2, cy = window.innerHeight / 2) => {
        set((draft) => {
          const oldZoom = draft.viewport.ulZoom;
          const newZoom = clamp(oldZoom * factor, 0.02, 10.0);
          if (oldZoom === newZoom) return;

          // Cursor anchored zoom formula:
          // worldX = (cx - panX) / oldZoom
          // panX = cx - worldX * newZoom
          const panX = cx - ((cx - draft.viewport.ulPanX) / oldZoom) * newZoom;
          const panY = cy - ((cy - draft.viewport.ulPanY) / oldZoom) * newZoom;

          draft.viewport.ulZoom = newZoom;
          draft.viewport.ulPanX = panX;
          draft.viewport.ulPanY = panY;
        });
      },

      setFramingZoom: (zoom: number) => {
        set((draft) => {
          draft.viewport.zoomLevel = clamp(zoom, 0.05, 3.0);
        });
      },

      setCanvasPreset: (preset: CanvasPreset) => {
        set((draft) => {
          draft.viewport.canvasMode = preset;
        });
      },

      setCanvasLock: (locked: boolean) => {
        set((draft) => {
          draft.viewport.canvasLocked = locked;
        });
      },

      setCustomCanvasSize: (w: number, h: number) => {
        set((draft) => {
          draft.viewport.customCanvasW = w;
          draft.viewport.customCanvasH = h;
        });
      },

      setUnlimitedTheme: (theme: 'dark' | 'light') => {
        set((draft) => {
          draft.viewport.unlimitedTheme = theme;
        });
      },

      // Settings
      updateSettings: (patch: Partial<GlobalSettings>) => {
        set((draft) => {
          draft.settings = { ...draft.settings, ...patch };
        });
      },

      // Tool Actions
      setToolMode: (mode: ToolMode) => {
        set((draft) => {
          draft.tool.mode = mode;
        });
      },

      setToolLocked: (locked: boolean) => {
        set((draft) => {
          draft.tool.locked = locked;
        });
      },

      setLineDefaults: (defaults: Partial<LineStyleDefaults>) => {
        set((draft) => {
          draft.tool.lineDefaults = { ...draft.tool.lineDefaults, ...defaults };
        });
      },

      // UI Actions
      toggleLayers: (open?: boolean) => {
        set((draft) => {
          draft.ui.layersOpen = open !== undefined ? open : !draft.ui.layersOpen;
        });
      },

      toggleProperties: (open?: boolean) => {
        set((draft) => {
          draft.ui.propertiesOpen =
            open !== undefined ? open : !draft.ui.propertiesOpen;
        });
      },

      setActiveDialog: (dialog: string | null) => {
        set((draft) => {
          draft.ui.activeDialog = dialog;
        });
      },

      showToast: (message: string, type: 'info' | 'error' | 'success' = 'info') => {
        const id = generateId();
        set((draft) => {
          draft.ui.toast = { id, message, type };
        });
        setTimeout(() => {
          if (get().ui.toast?.id === id) {
            get().hideToast();
          }
        }, 3500);
      },

      hideToast: () => {
        set((draft) => {
          draft.ui.toast = null;
        });
      },

      // History
      beginTransaction: (label: string) => {
        getActiveEngine().begin(label);
        syncHistoryUI();
      },

      commitTransaction: () => {
        getActiveEngine().commit();
        syncHistoryUI();
      },

      cancelTransaction: () => {
        getActiveEngine().cancel();
        syncHistoryUI();
      },

      undo: () => {
        getActiveEngine().undo();
        syncHistoryUI();
      },

      redo: () => {
        getActiveEngine().redo();
        syncHistoryUI();
      },

      clearHistory: () => {
        snapshotEngine.clear();
        patchEngine.clear();
        syncHistoryUI();
      },

      // Load & Reset
      loadScene: (
        objects: CanvasObject[],
        settings?: Partial<GlobalSettings>,
        viewport?: Partial<ViewportState>
      ) => {
        set((draft) => {
          draft.objects = objects;
          draft.selection = [];
          if (settings) draft.settings = { ...draft.settings, ...settings };
          if (viewport) draft.viewport = { ...draft.viewport, ...viewport };
        });
        get().clearHistory();
      },

      resetScene: () => {
        set((draft) => {
          draft.objects = [];
          draft.selection = [];
          draft.groupCounter = 1;
          draft.viewport = { ...DEFAULT_VIEWPORT };
          draft.settings = { ...DEFAULT_SETTINGS };
        });
        get().clearHistory();
      },
    };
  })
);
