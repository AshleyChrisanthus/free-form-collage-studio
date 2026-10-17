import { describe, it, expect, beforeEach } from 'vitest';
import { VARIANTS } from '../src/engine/variants';
import { useVariantStore } from '../src/store/variantStore';
import { getKv } from '../src/db/db';

describe('Engine Variant Registry', () => {
  beforeEach(async () => {
    await useVariantStore.getState().hydrate();
  });

  it('defines all required variants from ADR-004', () => {
    expect(VARIANTS).toHaveProperty('bgRemoval');
    expect(VARIANTS).toHaveProperty('history');
    expect(VARIANTS).toHaveProperty('scissors');
    expect(VARIANTS).toHaveProperty('pathSmooth');
    expect(VARIANTS).toHaveProperty('roughness');
    expect(VARIANTS).toHaveProperty('jxl');
  });

  it('updates variant and persists to Dexie kv', async () => {
    await useVariantStore.getState().setVariant('history', 'snapshot');
    expect(useVariantStore.getState().variants.history).toBe('snapshot');

    const saved = await getKv<Record<string, string>>('engineVariants', {});
    expect(saved.history).toBe('snapshot');

    // Switch back
    await useVariantStore.getState().setVariant('history', 'patches');
    expect(useVariantStore.getState().variants.history).toBe('patches');
  });
});
