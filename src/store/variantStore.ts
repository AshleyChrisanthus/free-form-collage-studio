import { create } from 'zustand';
import {
  VARIANTS,
  DEFAULT_VARIANTS,
  type ActiveVariants,
  type VariantKey,
  type VariantValue,
} from '../engine/variants';
import { getKv, setKv } from '../db/db';

const KV_KEY = 'engineVariants';

interface VariantStoreState {
  variants: ActiveVariants;
  availability: Partial<Record<string, boolean>>;
  hydrated: boolean;
  setVariant: <K extends VariantKey>(key: K, value: VariantValue<K>) => Promise<void>;
  checkAvailability: () => Promise<void>;
  hydrate: () => Promise<void>;
}

export const useVariantStore = create<VariantStoreState>((set, get) => ({
  variants: { ...DEFAULT_VARIANTS },
  availability: {},
  hydrated: false,

  setVariant: async <K extends VariantKey>(key: K, value: VariantValue<K>) => {
    const next = { ...get().variants, [key]: value };
    set({ variants: next });
    await setKv(KV_KEY, next);
  },

  checkAvailability: async () => {
    const checks: Record<string, boolean> = {};
    for (const [vKey, def] of Object.entries(VARIANTS)) {
      for (const [optId, opt] of Object.entries(def.optionDetails)) {
        try {
          checks[`${vKey}:${optId}`] = await opt.isAvailable();
        } catch {
          checks[`${vKey}:${optId}`] = false;
        }
      }
    }
    set({ availability: checks });
  },

  hydrate: async () => {
    try {
      const saved = await getKv<Partial<ActiveVariants>>(KV_KEY, {});
      const merged: ActiveVariants = { ...DEFAULT_VARIANTS, ...saved };
      set({ variants: merged, hydrated: true });
      void get().checkAvailability();
    } catch {
      set({ hydrated: true });
    }
  },
}));
