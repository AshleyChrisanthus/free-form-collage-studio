export type SniffedImageFormat =
  | 'image/png'
  | 'image/jpeg'
  | 'image/webp'
  | 'image/gif'
  | 'image/avif'
  | 'image/tiff'
  | 'image/jxl'
  | 'image/svg+xml'
  | 'unknown';

/**
 * Sniffs image format from binary magic bytes (with fallback to MIME or extension).
 */
export async function sniffImageFormat(
  blobOrBuffer: Blob | ArrayBuffer
): Promise<SniffedImageFormat> {
  let buffer: ArrayBuffer;
  if (blobOrBuffer instanceof Blob) {
    buffer = await blobOrBuffer.slice(0, 1024).arrayBuffer();
  } else {
    buffer = blobOrBuffer.slice(0, 1024);
  }

  const bytes = new Uint8Array(buffer);
  if (bytes.length < 4) return 'unknown';

  // 1. PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47 &&
    bytes[4] === 0x0d &&
    bytes[5] === 0x0a &&
    bytes[6] === 0x1a &&
    bytes[7] === 0x0a
  ) {
    return 'image/png';
  }

  // 2. JPEG: FF D8 FF
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return 'image/jpeg';
  }

  // 3. GIF: GIF87a or GIF89a
  if (
    bytes[0] === 0x47 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x38 &&
    (bytes[4] === 0x37 || bytes[4] === 0x39) &&
    bytes[5] === 0x61
  ) {
    return 'image/gif';
  }

  // 4. WebP: RIFF .... WEBP
  if (
    bytes[0] === 0x52 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x46 &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x45 &&
    bytes[10] === 0x42 &&
    bytes[11] === 0x50
  ) {
    return 'image/webp';
  }

  // 5. TIFF: 'II' (0x49 0x49 0x2A 0x00) or 'MM' (0x4D 0x4D 0x00 0x2A)
  if (
    (bytes[0] === 0x49 && bytes[1] === 0x49 && bytes[2] === 0x2a && bytes[3] === 0x00) ||
    (bytes[0] === 0x4d && bytes[1] === 0x4d && bytes[2] === 0x00 && bytes[3] === 0x2a)
  ) {
    return 'image/tiff';
  }

  // 6. JPEG XL: Bare codestream FF 0A, or container 00 00 00 0C 4A 58 4C 20
  if (bytes[0] === 0xff && bytes[1] === 0x0a) {
    return 'image/jxl';
  }
  if (
    bytes.length >= 12 &&
    bytes[0] === 0x00 &&
    bytes[1] === 0x00 &&
    bytes[2] === 0x00 &&
    bytes[3] === 0x0c &&
    bytes[4] === 0x4a &&
    bytes[5] === 0x58 &&
    bytes[6] === 0x4c &&
    bytes[7] === 0x20
  ) {
    return 'image/jxl';
  }

  // 7. AVIF: ftypavif or ftypavis
  if (bytes.length >= 12) {
    const brand = String.fromCharCode(...bytes.slice(4, 12));
    if (brand.includes('avif') || brand.includes('avis')) {
      return 'image/avif';
    }
  }

  // 8. SVG: Text check (XML declaration or <svg)
  try {
    const text = new TextDecoder('utf-8', { fatal: false }).decode(bytes).trim();
    if (
      text.startsWith('<?xml') ||
      text.startsWith('<svg') ||
      text.includes('<svg xmlns="http://www.w3.org/2000/svg"') ||
      /<svg\b/i.test(text)
    ) {
      return 'image/svg+xml';
    }
  } catch {
    // ignore
  }

  return 'unknown';
}
