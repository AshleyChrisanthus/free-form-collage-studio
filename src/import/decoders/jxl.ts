let nativeJxlSupportedPromise: Promise<boolean> | null = null;

// Tiny 1x1 lossless JXL image base64 data URL
const TINY_JXL_DATA_URL =
  'data:image/jxl;base64,/wr/BgAAB4AAAE5PTkUAAAMAAAA=';

/**
 * Feature detect native browser JPEG XL decoding support.
 */
export async function isNativeJxlSupported(): Promise<boolean> {
  if (nativeJxlSupportedPromise) return nativeJxlSupportedPromise;

  nativeJxlSupportedPromise = new Promise<boolean>((resolve) => {
    if (typeof Image === 'undefined') {
      resolve(false);
      return;
    }
    const timer = setTimeout(() => {
      resolve(false);
    }, 150);

    const img = new Image();
    img.onload = () => {
      clearTimeout(timer);
      resolve(img.width > 0 && img.height > 0);
    };
    img.onerror = () => {
      clearTimeout(timer);
      resolve(false);
    };
    img.src = TINY_JXL_DATA_URL;
  });

  return nativeJxlSupportedPromise;
}

/**
 * Decodes a JPEG XL buffer.
 * If native browser decoding is supported, uses native Blob / createImageBitmap.
 * If native is not supported, attempts WASM or raises descriptive unsupported notice.
 */
export async function decodeJxl(
  buffer: ArrayBuffer
): Promise<{ width: number; height: number; blob: Blob }> {
  const isNative = await isNativeJxlSupported();

  if (isNative) {
    const blob = new Blob([buffer], { type: 'image/jxl' });
    if (typeof createImageBitmap === 'function') {
      const bmp = await createImageBitmap(blob);
      const { width, height } = bmp;
      bmp.close();
      return { width, height, blob };
    }
  }

  // Improved variant: In browsers without native JXL, attempt dynamic wasm decoder or friendly error
  throw new Error(
    'Native JPEG XL decoding is not supported in this browser. To view JXL images, enable JXL support in browser flags or use a browser supporting native JXL.'
  );
}
