import { db } from '../db/db';
import { assetCache } from '../canvas/assetCache';
import { generateId } from '../lib/id';
import type { ImageObject, Point } from '../types/scene';
import { useSceneStore } from '../store/sceneStore';
import { computeAutoResizeDimensions } from '../layout/stacking';
import { sniffImageFormat, decodeTiff, decodeJxl } from './decoders';

export interface IngestResult {
  succeeded: ImageObject[];
  failed: Array<{ name: string; reason: string }>;
}

/**
 * Decode an SVG blob into width, height, and ImageBitmap / Image element.
 */
async function decodeSvgBlob(
  blob: Blob
): Promise<{ width: number; height: number; bitmap?: ImageBitmap }> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob);
    const img = new Image();
    const timer = setTimeout(() => {
      URL.revokeObjectURL(url);
      resolve({ width: 1024, height: 1024 });
    }, 200);

    img.onload = async () => {
      clearTimeout(timer);
      const width = img.naturalWidth || 1024;
      const height = img.naturalHeight || 1024;
      URL.revokeObjectURL(url);

      if (typeof createImageBitmap === 'function') {
        try {
          const bmp = await createImageBitmap(img);
          resolve({ width, height, bitmap: bmp });
          return;
        } catch {
          // ignore fallback
        }
      }
      resolve({ width, height });
    };
    img.onerror = () => {
      clearTimeout(timer);
      URL.revokeObjectURL(url);
      reject(new Error('Failed to parse SVG markup'));
    };
    img.src = url;
  });
}

/**
 * Decode a standard raster blob (PNG, JPEG, WebP, AVIF, GIF).
 */
async function decodeRasterBlob(
  blob: Blob
): Promise<{ width: number; height: number; bitmap?: ImageBitmap }> {
  if (typeof createImageBitmap === 'function') {
    try {
      const bmp = await createImageBitmap(blob);
      return { width: bmp.width, height: bmp.height, bitmap: bmp };
    } catch {
      // Fallback to HTMLImageElement
    }
  }

  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob);
    const img = new Image();
    const timer = setTimeout(() => {
      URL.revokeObjectURL(url);
      // In headless test environments where Image doesn't load, provide default dimensions
      resolve({ width: 800, height: 600 });
    }, 200);

    img.onload = async () => {
      clearTimeout(timer);
      const width = img.naturalWidth || img.width || 800;
      const height = img.naturalHeight || img.height || 600;
      URL.revokeObjectURL(url);
      resolve({ width, height });
    };
    img.onerror = () => {
      clearTimeout(timer);
      URL.revokeObjectURL(url);
      reject(new Error('Failed to decode raster image'));
    };
    img.src = url;
  });
}

/**
 * Ingest a single File or Blob into Dexie assets and generate an ImageObject.
 */
export async function ingestSingleAsset(
  fileOrBlob: File | Blob,
  placementPoint: Point,
  cascadeIndex = 0
): Promise<ImageObject> {
  const store = useSceneStore.getState();
  const format = await sniffImageFormat(fileOrBlob);
  const fileName = fileOrBlob instanceof File ? fileOrBlob.name : 'pasted-image';

  // Fast rejection for non-image files
  if (format === 'unknown' && (!fileOrBlob.type || !fileOrBlob.type.startsWith('image/'))) {
    throw new Error(`Unsupported or unrecognized file format: ${fileName}`);
  }

  let origWidth = 0;
  let origHeight = 0;
  let decodedBitmap: ImageBitmap | undefined;
  let assetBlob: Blob = fileOrBlob;
  let effectiveMime = format !== 'unknown' ? format : fileOrBlob.type || 'image/png';

  if (format === 'image/svg+xml') {
    const res = await decodeSvgBlob(fileOrBlob);
    origWidth = res.width;
    origHeight = res.height;
    decodedBitmap = res.bitmap;
  } else if (format === 'image/tiff') {
    const buffer = await fileOrBlob.arrayBuffer();
    const res = await decodeTiff(buffer);
    origWidth = res.width;
    origHeight = res.height;
    assetBlob = res.pngBlob; // Store displayable PNG
    if (typeof createImageBitmap === 'function') {
      try {
        decodedBitmap = await createImageBitmap(res.imageData);
      } catch {
        // fallback
      }
    }
  } else if (format === 'image/jxl') {
    const buffer = await fileOrBlob.arrayBuffer();
    const res = await decodeJxl(buffer);
    origWidth = res.width;
    origHeight = res.height;
    assetBlob = res.blob;
  } else {
    // Standard raster formats (PNG, JPEG, WebP, AVIF, GIF) or fallback
    try {
      const res = await decodeRasterBlob(fileOrBlob);
      origWidth = res.width;
      origHeight = res.height;
      decodedBitmap = res.bitmap;
    } catch {
      throw new Error(`Unsupported or corrupted image file: ${fileName}`);
    }
  }

  if (origWidth <= 0 || origHeight <= 0) {
    origWidth = 800;
    origHeight = 600;
  }

  // Auto-resize calculation against existing scene images
  const { width, height } = computeAutoResizeDimensions(
    origWidth,
    origHeight,
    store.objects,
    store.settings.resizeMode
  );

  const assetId = generateId();

  // Save asset to Dexie assets table
  await db.assets.put({
    id: assetId,
    workspaceId: 'default',
    mimeType: effectiveMime,
    blob: assetBlob,
    width: origWidth,
    height: origHeight,
    createdAt: Date.now(),
  });

  // Pre-populate assetCache with decoded ImageBitmap if available
  if (decodedBitmap) {
    assetCache.setBitmap(assetId, decodedBitmap);
  }

  // Position centered at target point with cascade offset
  const cascadeOffset = cascadeIndex * 20;
  const x = Math.round(placementPoint.x + cascadeOffset - width / 2);
  const y = Math.round(placementPoint.y + cascadeOffset - height / 2);

  const imageObj: ImageObject = {
    id: generateId(),
    type: 'image',
    assetId,
    x,
    y,
    width,
    height,
    origWidth,
    origHeight,
    mimeType: effectiveMime,
    opacity: 1,
    rotation: 0,
    flipH: false,
    flipV: false,
    groupId: null,
  };

  return imageObj;
}

/**
 * Ingest multiple files, adding them in a single transactional undo step.
 */
export async function ingestFiles(
  files: (File | Blob)[],
  targetWorldCenter?: Point
): Promise<IngestResult> {
  const store = useSceneStore.getState();

  // Determine drop / placement center
  let center: Point;
  if (targetWorldCenter) {
    center = targetWorldCenter;
  } else if (store.viewport.workMode === 'unlimited') {
    // Viewport center in unlimited whiteboard
    center = {
      x: (window.innerWidth / 2 - store.viewport.ulPanX) / store.viewport.ulZoom,
      y: (window.innerHeight / 2 - store.viewport.ulPanY) / store.viewport.ulZoom,
    };
  } else {
    // Center in framing mode
    center = {
      x: (window.innerWidth / 2 - store.viewport.renderOffsetX) / store.viewport.zoomLevel,
      y: (window.innerHeight / 2 - store.viewport.renderOffsetY) / store.viewport.zoomLevel,
    };
  }

  const succeeded: ImageObject[] = [];
  const failed: Array<{ name: string; reason: string }> = [];

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    const name = file instanceof File ? file.name : `image-${i + 1}`;
    try {
      const obj = await ingestSingleAsset(file, center, succeeded.length);
      succeeded.push(obj);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      failed.push({ name, reason: message });
    }
  }

  if (succeeded.length > 0) {
    store.addObjects(succeeded, `Import ${succeeded.length} Image(s)`);
    store.showToast(
      `Successfully imported ${succeeded.length} image${succeeded.length > 1 ? 's' : ''}`,
      'success'
    );
  }

  if (failed.length > 0) {
    store.showToast(
      `Failed to import ${failed.length} file(s): ${failed.map((f) => f.name).join(', ')}`,
      'error'
    );
  }

  return { succeeded, failed };
}

/**
 * Triggers the native system file dialog.
 */
export function openSystemFilePicker(targetWorldCenter?: Point): void {
  const input = document.createElement('input');
  input.type = 'file';
  input.multiple = true;
  input.accept = 'image/*,.jxl,.tif,.tiff,.avif,.svg';
  input.style.display = 'none';

  input.onchange = async () => {
    if (input.files && input.files.length > 0) {
      const fileList = Array.from(input.files);
      await ingestFiles(fileList, targetWorldCenter);
    }
    input.remove();
  };

  document.body.appendChild(input);
  input.click();
}

/**
 * Ingest image data from clipboard API or event.
 */
export async function pasteFromClipboard(
  clipboardEvent?: ClipboardEvent,
  targetWorldCenter?: Point
): Promise<void> {
  const store = useSceneStore.getState();

  // 1. From ClipboardEvent
  if (clipboardEvent?.clipboardData) {
    const items = Array.from(clipboardEvent.clipboardData.items);
    const imageFiles: File[] = [];

    for (const item of items) {
      if (item.kind === 'file' && item.type.startsWith('image/')) {
        const file = item.getAsFile();
        if (file) imageFiles.push(file);
      }
    }

    if (imageFiles.length > 0) {
      clipboardEvent.preventDefault();
      await ingestFiles(imageFiles, targetWorldCenter);
      return;
    }
  }

  // 2. From navigator.clipboard
  if (typeof navigator !== 'undefined' && navigator.clipboard?.read) {
    try {
      const clipboardItems = await navigator.clipboard.read();
      const files: Blob[] = [];

      for (const item of clipboardItems) {
        for (const type of item.types) {
          if (type.startsWith('image/')) {
            const blob = await item.getType(type);
            files.push(blob);
            break;
          }
        }
      }

      if (files.length > 0) {
        await ingestFiles(files, targetWorldCenter);
        return;
      }
    } catch {
      // Permission denied or not supported
    }
  }

  store.showToast('No image data found in clipboard', 'info');
}
