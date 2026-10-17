import { db } from '../db/db';

class AssetCache {
  private cache = new Map<string, ImageBitmap>();
  private loading = new Map<string, Promise<ImageBitmap | null>>();
  private listeners = new Set<() => void>();
  private approximateByteSize = 0;
  private readonly maxByteLimit = 500 * 1024 * 1024; // 500 MB LRU limit

  /**
   * Subscribe to asset load events to trigger canvas re-render.
   */
  subscribe(callback: () => void): () => void {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  private notify() {
    this.listeners.forEach((cb) => cb());
  }

  /**
   * Synchronously get ImageBitmap if already decoded in memory.
   */
  get(assetId: string): ImageBitmap | null {
    const bitmap = this.cache.get(assetId);
    if (bitmap) {
      // Refresh LRU order (delete & set)
      this.cache.delete(assetId);
      this.cache.set(assetId, bitmap);
      return bitmap;
    }

    // Trigger async load if not already in flight
    if (!this.loading.has(assetId)) {
      void this.load(assetId);
    }
    return null;
  }

  /**
   * Load asset from Dexie or Blob and decode into ImageBitmap.
   */
  async load(assetId: string): Promise<ImageBitmap | null> {
    if (this.cache.has(assetId)) {
      return this.cache.get(assetId)!;
    }

    if (this.loading.has(assetId)) {
      return this.loading.get(assetId)!;
    }

    const promise = (async () => {
      try {
        const record = await db.assets.get(assetId);
        if (!record || !record.blob) {
          return null;
        }

        let bitmap: ImageBitmap;
        if (typeof createImageBitmap === 'function') {
          bitmap = await createImageBitmap(record.blob);
        } else {
          // Fallback for environment without createImageBitmap (e.g. basic jsdom)
          return null;
        }

        const size = bitmap.width * bitmap.height * 4;
        this.cache.set(assetId, bitmap);
        this.approximateByteSize += size;
        this.evictIfNeeded();
        this.notify();
        return bitmap;
      } catch (err) {
        console.warn(`Failed to decode asset ${assetId}:`, err);
        return null;
      } finally {
        this.loading.delete(assetId);
      }
    })();

    this.loading.set(assetId, promise);
    return promise;
  }

  /**
   * Store an ImageBitmap directly (e.g. for freshly imported or generated assets).
   */
  setBitmap(assetId: string, bitmap: ImageBitmap): void {
    const size = bitmap.width * bitmap.height * 4;
    this.cache.set(assetId, bitmap);
    this.approximateByteSize += size;
    this.evictIfNeeded();
    this.notify();
  }

  private evictIfNeeded() {
    if (this.approximateByteSize <= this.maxByteLimit) return;
    for (const [key, bmp] of this.cache.entries()) {
      const size = bmp.width * bmp.height * 4;
      bmp.close?.();
      this.cache.delete(key);
      this.approximateByteSize -= size;
      if (this.approximateByteSize <= this.maxByteLimit * 0.8) break;
    }
  }

  clear(): void {
    for (const bmp of this.cache.values()) {
      bmp.close?.();
    }
    this.cache.clear();
    this.loading.clear();
    this.approximateByteSize = 0;
  }
}

export const assetCache = new AssetCache();
