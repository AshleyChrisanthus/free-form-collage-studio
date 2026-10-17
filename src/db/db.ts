import Dexie, { type EntityTable } from 'dexie';

/**
 * Local-first storage (IndexedDB via Dexie). Zero backend.
 *
 * - `workspaces`: serialized scene documents (objects, viewport, settings) — see issues for schema.
 * - `assets`:     binary image blobs referenced by ImageObjects (kept out of the scene JSON so
 *                 autosave stays fast and localStorage quota is never hit).
 * - `kv`:         small app-level key/value records (last opened workspace, engine variants, ...).
 *
 * Tiny UI preferences (theme mode / preset / custom colors) live in localStorage so they can be
 * applied synchronously before first paint.
 */
export interface WorkspaceRecord {
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
  /** Serialized scene document (formatVersion-tagged). Typed in src/types/scene.ts once implemented. */
  doc: unknown;
  thumbnail?: string;
}

export interface AssetRecord {
  id: string;
  workspaceId: string;
  mimeType: string;
  blob: Blob;
  width: number;
  height: number;
  createdAt: number;
}

export interface KvRecord {
  key: string;
  value: unknown;
}

export const db = new Dexie('free-form-collage-studio') as Dexie & {
  workspaces: EntityTable<WorkspaceRecord, 'id'>;
  assets: EntityTable<AssetRecord, 'id'>;
  kv: EntityTable<KvRecord, 'key'>;
};

db.version(1).stores({
  workspaces: 'id, name, updatedAt',
  assets: 'id, workspaceId, createdAt',
  kv: 'key',
});

export async function getKv<T>(key: string, fallback: T): Promise<T> {
  const rec = await db.kv.get(key);
  return rec ? (rec.value as T) : fallback;
}

export async function setKv(key: string, value: unknown): Promise<void> {
  await db.kv.put({ key, value });
}

/** Ask the browser not to evict our IndexedDB data under storage pressure. */
export async function requestPersistentStorage(): Promise<boolean> {
  try {
    if (navigator.storage?.persist) return await navigator.storage.persist();
  } catch {
    /* unsupported (e.g. some file:// contexts) */
  }
  return false;
}
