import { describe, it, expect, beforeEach } from 'vitest';
import { sniffImageFormat } from '../src/import/decoders/sniff';
import { decodeTiff } from '../src/import/decoders/tiff';
import { isNativeJxlSupported } from '../src/import/decoders/jxl';
import { ingestFiles } from '../src/import/ingest';
import { useSceneStore } from '../src/store/sceneStore';
import { db } from '../src/db/db';
import UTIF from 'utif2';

describe('Asset Ingestion & Multi-Format Compatibility (#17, #18)', () => {
  beforeEach(async () => {
    useSceneStore.getState().resetScene();
    await db.assets.clear();
  });

  describe('Magic Byte Sniffing', () => {
    it('identifies PNG magic bytes', async () => {
      const pngHeader = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00]);
      const format = await sniffImageFormat(pngHeader.buffer);
      expect(format).toBe('image/png');
    });

    it('identifies JPEG magic bytes', async () => {
      const jpegHeader = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]);
      const format = await sniffImageFormat(jpegHeader.buffer);
      expect(format).toBe('image/jpeg');
    });

    it('identifies GIF magic bytes (GIF87a and GIF89a)', async () => {
      const gif89 = new Uint8Array([0x47, 0x49, 0x46, 0x38, 0x39, 0x61]);
      expect(await sniffImageFormat(gif89.buffer)).toBe('image/gif');

      const gif87 = new Uint8Array([0x47, 0x49, 0x46, 0x38, 0x37, 0x61]);
      expect(await sniffImageFormat(gif87.buffer)).toBe('image/gif');
    });

    it('identifies WebP magic bytes', async () => {
      const webp = new Uint8Array([
        0x52, 0x49, 0x46, 0x46, // RIFF
        0x00, 0x00, 0x00, 0x00,
        0x57, 0x45, 0x42, 0x50, // WEBP
      ]);
      expect(await sniffImageFormat(webp.buffer)).toBe('image/webp');
    });

    it('identifies Little-Endian and Big-Endian TIFF', async () => {
      const tiffLE = new Uint8Array([0x49, 0x49, 0x2a, 0x00]);
      expect(await sniffImageFormat(tiffLE.buffer)).toBe('image/tiff');

      const tiffBE = new Uint8Array([0x4d, 0x4d, 0x00, 0x2a]);
      expect(await sniffImageFormat(tiffBE.buffer)).toBe('image/tiff');
    });

    it('identifies JPEG XL (bare codestream and container)', async () => {
      const jxlBare = new Uint8Array([0xff, 0x0a, 0x00, 0x00]);
      expect(await sniffImageFormat(jxlBare.buffer)).toBe('image/jxl');

      const jxlContainer = new Uint8Array([
        0x00, 0x00, 0x00, 0x0c, 0x4a, 0x58, 0x4c, 0x20, 0x0d, 0x0a, 0x87, 0x0a,
      ]);
      expect(await sniffImageFormat(jxlContainer.buffer)).toBe('image/jxl');
    });

    it('identifies AVIF from ftyp box', async () => {
      const avif = new Uint8Array([
        0x00, 0x00, 0x00, 0x1c, 0x66, 0x74, 0x79, 0x70, 0x61, 0x76, 0x69, 0x66,
      ]);
      expect(await sniffImageFormat(avif.buffer)).toBe('image/avif');
    });

    it('identifies SVG from XML or tag contents', async () => {
      const svgXml = new TextEncoder().encode('<?xml version="1.0"?><svg viewBox="0 0 10 10"></svg>');
      expect(await sniffImageFormat(svgXml.buffer)).toBe('image/svg+xml');

      const svgDirect = new TextEncoder().encode('<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"></svg>');
      expect(await sniffImageFormat(svgDirect.buffer)).toBe('image/svg+xml');
    });

    it('returns unknown for unsupported files', async () => {
      const random = new Uint8Array([0x01, 0x02, 0x03, 0x04]);
      expect(await sniffImageFormat(random.buffer)).toBe('unknown');
    });
  });

  describe('TIFF Decoding', () => {
    it('decodes a synthetic uncompressed RGB TIFF buffer', async () => {
      // Create a valid 2x2 red pixel TIFF using UTIF.encodeImage
      const rgba = new Uint8Array([
        255, 0, 0, 255,   255, 0, 0, 255,
        255, 0, 0, 255,   255, 0, 0, 255,
      ]);
      const tiffBuffer = UTIF.encodeImage(rgba, 2, 2);

      const decoded = await decodeTiff(tiffBuffer);
      expect(decoded.width).toBe(2);
      expect(decoded.height).toBe(2);
      expect(decoded.imageData.data.length).toBe(16);
      expect(decoded.imageData.data[0]).toBe(255); // Red channel
    });
  });

  describe('JXL Support Check', () => {
    it('checks native JXL support without crashing', async () => {
      const supported = await isNativeJxlSupported();
      expect(typeof supported).toBe('boolean');
    });
  });

  describe('Ingestion Pipeline & Cascading Placement', () => {
    it('gracefully handles invalid file formats without crashing the app', async () => {
      const badBlob = new Blob(['not an image content at all'], { type: 'text/plain' });
      const res = await ingestFiles([badBlob]);

      expect(res.succeeded.length).toBe(0);
      expect(res.failed.length).toBe(1);
      expect(useSceneStore.getState().objects.length).toBe(0);
    });

    it('cascades placement coordinates (+20px offset) for multi-file ingestion', async () => {
      // Create two synthetic TIFF images
      const rgba = new Uint8Array([255, 0, 0, 255]);
      const tiffBuf = UTIF.encodeImage(rgba, 1, 1);
      const blob1 = new Blob([tiffBuf], { type: 'image/tiff' });
      const blob2 = new Blob([tiffBuf], { type: 'image/tiff' });

      const center = { x: 500, y: 300 };
      const res = await ingestFiles([blob1, blob2], center);

      expect(res.succeeded.length).toBe(2);
      const [img1, img2] = res.succeeded;

      // First image should be centered at (center.x - w/2, center.y - h/2)
      // Second image should be offset by +20px in both axes
      expect(img2.x - img1.x).toBe(20);
      expect(img2.y - img1.y).toBe(20);

      // Verify assets were persisted in Dexie
      const storedAsset = await db.assets.get(img1.assetId);
      expect(storedAsset).toBeDefined();
    });
  });
});
