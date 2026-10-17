import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { viteSingleFile } from 'vite-plugin-singlefile';

// Single-file, serverless build:
// `npm run build` emits ONE self-contained dist/index.html (all JS, CSS, fonts and
// assets inlined) that runs by double-clicking it / opening via file://.
export default defineConfig({
  base: './',
  plugins: [react(), tailwindcss(), viteSingleFile({ removeViteModuleLoader: true })],
  build: {
    target: 'es2022',
    assetsInlineLimit: 100_000_000, // inline every asset (fonts, images, wasm-as-base64)
    cssCodeSplit: false,
    chunkSizeWarningLimit: 100_000,
    reportCompressedSize: false,
  },
  worker: {
    // Workers must be imported with `?worker&inline` so they are embedded in the single file.
    format: 'es',
  },
});
