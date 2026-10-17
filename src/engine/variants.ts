export interface VariantOptionDef<V extends string = string> {
  id: V;
  name: string;
  badge?: string;
  badgeType?: 'default' | 'success' | 'warning' | 'info';
  description: string;
  isAvailable: () => Promise<boolean> | boolean;
}

export interface VariantDef<V extends string = string> {
  key: string;
  label: string;
  description: string;
  default: V;
  options: readonly V[];
  optionDetails: Record<V, VariantOptionDef<V>>;
}

export const VARIANTS = {
  bgRemoval: {
    key: 'bgRemoval',
    label: 'Background removal',
    description: 'Algorithm used to separate foreground objects from the background in images.',
    default: 'neural',
    options: ['heuristic', 'neural'] as const,
    optionDetails: {
      heuristic: {
        id: 'heuristic',
        name: 'Heuristic (Legacy)',
        badge: 'Instant / Offline',
        badgeType: 'default',
        description: 'Corner-sample Manhattan color distance. Lightweight, 100% offline, best for flat studio backdrops.',
        isAvailable: () => true,
      },
      neural: {
        id: 'neural',
        name: 'Neural Model (Improved)',
        badge: 'AI Mask',
        badgeType: 'success',
        description: 'In-browser neural segmentation model via WebAssembly / ONNX. Cached in IndexedDB for offline use.',
        isAvailable: async () => {
          // Check for WebAssembly support
          return typeof WebAssembly !== 'undefined';
        },
      },
    },
  },
  history: {
    key: 'history',
    label: 'Undo / redo engine',
    description: 'Transaction tracking model for undoing and replaying scene changes.',
    default: 'patches',
    options: ['snapshot', 'patches'] as const,
    optionDetails: {
      snapshot: {
        id: 'snapshot',
        name: 'Full Snapshot (Legacy)',
        badge: 'Simple',
        badgeType: 'default',
        description: 'Clones scene state on each transaction. Familiar and robust, higher memory usage for long sessions.',
        isAvailable: () => true,
      },
      patches: {
        id: 'patches',
        name: 'Immer Patches (Improved)',
        badge: 'Fast / Efficient',
        badgeType: 'success',
        description: 'Records exact JSON patch deltas and inverse patches. Minimal memory footprint with continuous coalescing.',
        isAvailable: () => true,
      },
    },
  },
  scissors: {
    key: 'scissors',
    label: 'Magnetic lasso',
    description: 'Intelligent scissors edge-following pathfinding engine.',
    default: 'astar-worker',
    options: ['dijkstra-main', 'astar-worker'] as const,
    optionDetails: {
      'dijkstra-main': {
        id: 'dijkstra-main',
        name: 'Dijkstra (Legacy)',
        badge: 'Main Thread',
        badgeType: 'default',
        description: 'Calculates path on main UI thread using standard Dijkstra. Can cause UI stutter on high-res images.',
        isAvailable: () => true,
      },
      'astar-worker': {
        id: 'astar-worker',
        name: 'A* in Web Worker (Improved)',
        badge: 'Smooth 60fps',
        badgeType: 'success',
        description: 'Sobel cost map with heuristic A* pathfinding executed in background worker, keeping the UI at 60fps.',
        isAvailable: () => typeof Worker !== 'undefined',
      },
    },
  },
  pathSmooth: {
    key: 'pathSmooth',
    label: 'Lasso smoothing',
    description: 'Post-processing curve optimization applied to lasso selections.',
    default: 'dp-chaikin',
    options: ['dp', 'dp-chaikin'] as const,
    optionDetails: {
      dp: {
        id: 'dp',
        name: 'Douglas-Peucker (Legacy)',
        badge: 'Angular',
        badgeType: 'default',
        description: 'Linear polygon simplification. Keeps sharp anchor vertices.',
        isAvailable: () => true,
      },
      'dp-chaikin': {
        id: 'dp-chaikin',
        name: 'DP + Chaikin (Improved)',
        badge: 'Organic',
        badgeType: 'success',
        description: 'Douglas-Peucker simplification followed by 2 iterations of Chaikin corner-cutting subdivision.',
        isAvailable: () => true,
      },
    },
  },
  roughness: {
    key: 'roughness',
    label: 'Hand-drawn lines',
    description: 'Styling engine for sketching vector lines and arrows.',
    default: 'variable-width',
    options: ['legacy-jitter', 'variable-width'] as const,
    optionDetails: {
      'legacy-jitter': {
        id: 'legacy-jitter',
        name: 'Seeded Jitter (Legacy)',
        badge: 'Excalidraw v1',
        badgeType: 'default',
        description: 'Multi-pass randomized offset segments with constant stroke width.',
        isAvailable: () => true,
      },
      'variable-width': {
        id: 'variable-width',
        name: 'Variable Width (Improved)',
        badge: 'Natural Ink',
        badgeType: 'success',
        description: 'Seeded jitter combined with pressure-like tapering and organic stroke variation.',
        isAvailable: () => true,
      },
    },
  },
  jxl: {
    key: 'jxl',
    label: 'JPEG XL codec',
    description: 'Next-gen image codec decoder and encoder backend.',
    default: 'wasm',
    options: ['native', 'wasm'] as const,
    optionDetails: {
      native: {
        id: 'native',
        name: 'Native Browser',
        badge: 'Hardware',
        badgeType: 'default',
        description: 'Uses native browser image decoding for JPEG XL (supported in Safari 17+ and Chromium flags).',
        isAvailable: async () => {
          if (typeof Image === 'undefined') return false;
          const img = new Image();
          return new Promise<boolean>((resolve) => {
            img.onload = () => resolve(true);
            img.onerror = () => resolve(false);
            // 1x1 test JXL data URL
            img.src = 'data:image/jxl;base64,/wr/B/8=';
          });
        },
      },
      wasm: {
        id: 'wasm',
        name: 'WASM Fallback (Improved)',
        badge: 'Universal',
        badgeType: 'success',
        description: 'WebAssembly client-side libjxl encoder/decoder ensuring 100% cross-browser compatibility.',
        isAvailable: () => typeof WebAssembly !== 'undefined',
      },
    },
  },
} as const;

export type VariantMap = typeof VARIANTS;
export type VariantKey = keyof VariantMap;
export type VariantValue<K extends VariantKey> = VariantMap[K]['options'][number];

export type ActiveVariants = {
  [K in VariantKey]: VariantValue<K>;
};

export const DEFAULT_VARIANTS: ActiveVariants = {
  bgRemoval: 'neural',
  history: 'patches',
  scissors: 'astar-worker',
  pathSmooth: 'dp-chaikin',
  roughness: 'variable-width',
  jxl: 'wasm',
};
