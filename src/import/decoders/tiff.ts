import UTIF from 'utif2';

export interface DecodedTiffResult {
  width: number;
  height: number;
  imageData: ImageData;
  pngBlob: Blob;
}

/**
 * Decodes a TIFF binary buffer using utif2 (supporting baseline, LZW, PackBits, RGB, RGBA, etc.)
 */
export async function decodeTiff(buffer: ArrayBuffer): Promise<DecodedTiffResult> {
  const ifds = UTIF.decode(buffer);
  if (!ifds || ifds.length === 0) {
    throw new Error('Invalid TIFF: no image file directories found');
  }

  const firstIfd = ifds[0];
  UTIF.decodeImage(buffer, firstIfd);

  const rgba = UTIF.toRGBA8(firstIfd);
  const width = firstIfd.width;
  const height = firstIfd.height;

  if (!rgba || width <= 0 || height <= 0) {
    throw new Error('Failed to decode TIFF pixel data');
  }

  const clamped = new Uint8ClampedArray(rgba);
  const imageData = new ImageData(clamped, width, height);

  // Create a PNG blob for browsers that cannot natively redisplay the raw TIFF blob
  let pngBlob: Blob;
  if (typeof OffscreenCanvas !== 'undefined') {
    const offscreen = new OffscreenCanvas(width, height);
    const ctx = offscreen.getContext('2d');
    if (ctx) {
      ctx.putImageData(imageData, 0, 0);
      pngBlob = await offscreen.convertToBlob({ type: 'image/png' });
    } else {
      pngBlob = new Blob([buffer], { type: 'image/tiff' });
    }
  } else if (typeof document !== 'undefined') {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.putImageData(imageData, 0, 0);
      pngBlob = await new Promise<Blob>((resolve) =>
        canvas.toBlob((b) => resolve(b || new Blob([buffer], { type: 'image/tiff' })), 'image/png')
      );
    } else {
      pngBlob = new Blob([buffer], { type: 'image/tiff' });
    }
  } else {
    pngBlob = new Blob([buffer], { type: 'image/tiff' });
  }

  return {
    width,
    height,
    imageData,
    pngBlob,
  };
}
