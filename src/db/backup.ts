import { db, type AssetRecord } from './db';
import { THEME_STORAGE_KEYS } from '../styles/theme';

/**
 * Full-app JSON backup / restore.
 * Bundles every Dexie table (asset blobs encoded as data URLs) plus localStorage preferences
 * into one portable `.json` file. (The per-workspace `.collage` format is a separate feature.)
 */
export const BACKUP_FORMAT = 'free-form-collage-studio/backup';
export const BACKUP_VERSION = 1;

interface SerializedAsset extends Omit<AssetRecord, 'blob'> {
  dataUrl: string;
}

export interface BackupFile {
  format: typeof BACKUP_FORMAT;
  version: number;
  exportedAt: string;
  localStorage: Record<string, string>;
  tables: {
    workspaces: unknown[];
    assets: SerializedAsset[];
    kv: unknown[];
  };
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result as string);
    r.onerror = () => reject(r.error);
    r.readAsDataURL(blob);
  });
}

async function dataUrlToBlob(dataUrl: string): Promise<Blob> {
  return (await fetch(dataUrl)).blob(); // data: URLs are fetchable on file:// too
}

export async function createBackup(): Promise<BackupFile> {
  const [workspaces, assets, kv] = await Promise.all([db.workspaces.toArray(), db.assets.toArray(), db.kv.toArray()]);
  const serializedAssets = await Promise.all(
    assets.map(async ({ blob, ...rest }) => ({ ...rest, dataUrl: await blobToDataUrl(blob) })),
  );
  const ls: Record<string, string> = {};
  for (const key of THEME_STORAGE_KEYS) {
    const v = localStorage.getItem(key);
    if (v !== null) ls[key] = v;
  }
  return {
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    localStorage: ls,
    tables: { workspaces, assets: serializedAssets, kv },
  };
}

export async function downloadBackup(): Promise<void> {
  const backup = await createBackup();
  const blob = new Blob([JSON.stringify(backup)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `collage-studio-backup-${backup.exportedAt.slice(0, 10)}.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function isBackupFile(x: unknown): x is BackupFile {
  const b = x as BackupFile;
  return !!b && b.format === BACKUP_FORMAT && typeof b.version === 'number' && !!b.tables;
}

/** Replaces all local data with the contents of a backup file. */
export async function restoreBackup(file: File): Promise<void> {
  const parsed: unknown = JSON.parse(await file.text());
  if (!isBackupFile(parsed)) throw new Error('Not a Free-Form Collage Studio backup file.');
  if (parsed.version > BACKUP_VERSION) throw new Error('Backup was made by a newer version of the app.');

  const assets = await Promise.all(
    parsed.tables.assets.map(async ({ dataUrl, ...rest }) => ({ ...rest, blob: await dataUrlToBlob(dataUrl) })),
  );

  await db.transaction('rw', db.workspaces, db.assets, db.kv, async () => {
    await Promise.all([db.workspaces.clear(), db.assets.clear(), db.kv.clear()]);
    await db.workspaces.bulkPut(parsed.tables.workspaces as never[]);
    await db.assets.bulkPut(assets);
    await db.kv.bulkPut(parsed.tables.kv as never[]);
  });

  for (const key of THEME_STORAGE_KEYS) localStorage.removeItem(key);
  for (const [k, v] of Object.entries(parsed.localStorage ?? {})) localStorage.setItem(k, v);
}
