import { useSceneStore, type SceneState } from './sceneStore';
import { useShallow } from 'zustand/react/shallow';
import type { CanvasObject } from '../types/scene';

export const useObjects = () => useSceneStore((state) => state.objects);
export const useSelection = () => useSceneStore((state) => state.selection);
export const useViewport = () => useSceneStore((state) => state.viewport);
export const useSettings = () => useSceneStore((state) => state.settings);
export const useTool = () => useSceneStore((state) => state.tool);
export const useUI = () => useSceneStore((state) => state.ui);
export const useHistoryState = () => useSceneStore((state) => state.historyState);

/**
 * Returns currently selected CanvasObjects.
 */
export const useSelectedObjects = (): CanvasObject[] => {
  return useSceneStore(
    useShallow((state: SceneState) => {
      const selSet = new Set(state.selection);
      return state.objects.filter((o) => selSet.has(o.id));
    })
  );
};

/**
 * Check whether any object is selected.
 */
export const useIsAnythingSelected = (): boolean => {
  return useSceneStore((state) => state.selection.length > 0);
};

/**
 * Returns single selected object, or null if multiple or none selected.
 */
export const useSingleSelectedObject = (): CanvasObject | null => {
  return useSceneStore(
    useShallow((state: SceneState) => {
      if (state.selection.length !== 1) return null;
      return state.objects.find((o) => o.id === state.selection[0]) ?? null;
    })
  );
};
