# Architecture Decisions (ADR-001 … ADR-004)

This file records the three decisions requested at the top of
[`COLLAGE_BUILDER_REBUILD_BLUEPRINT.md`](../COLLAGE_BUILDER_REBUILD_BLUEPRINT.md), plus the
"Legacy vs Improved" switching strategy.

---

## ADR-001 — Rendering stack: **HTML5 Canvas 2D, layered stage** ✅

**Decision:** Custom layered Canvas 2D renderer (no Konva / Pixi).

| Layer | Tech | Contents |
| --- | --- | --- |
| Background | CSS (`background-image: radial-gradient`) transformed with pan/zoom | Adaptive dot grid, framing-stage backdrop |
| Scene | `<canvas>` 2D (DPR-aware) | Images + vector lines/arrows, z-ordered |
| Overlay | `<canvas>` 2D | Selection boxes, 8 handles, marquee, snap guides, crop masks, lasso path, binding ports |

**Why**
- **Single-file build:** zero runtime dependency keeps `dist/index.html` small (Konva ≈ 150 kB, Pixi ≈ 450 kB+ minified).
- **Pixel algorithms need raw `ImageData` anyway** — Sobel/scissors, heuristic bg removal, crop "cut" holes, PDF/TIFF/JXL encoders. A scene-graph lib would just be bypassed for these.
- **Export fidelity:** the same `drawScene(ctx, objects, opts)` function renders to screen, offscreen export canvases, and selection-only exports — no WebGL readback / max-texture-size limits for huge print exports.
- **Legacy parity:** the legacy app was Canvas 2D, so legacy behaviours (rotation bounding projection, roughness jitter, etc.) port 1:1.

**Mitigations:** dirty-flag rAF loop, per-image cached `ImageBitmap`, viewport culling, overlay redrawn independently from scene. A `Renderer` interface isolates drawing so a WebGL backend could be added later without touching tools.

**Switchable?** No — two rendering stacks would double the work for no user-visible benefit. Switching is offered where the *output* differs (see ADR-004).

---

## ADR-002 — Background removal: **Both engines, user-switchable** ✅

| | Legacy: Heuristic | Improved: Neural |
| --- | --- | --- |
| Algorithm | Sample 4 corners → Manhattan distance `|ΔR|+|ΔG|+|ΔB|` < threshold (40) → alpha 0 | ONNX segmentation model in WebAssembly/WebGPU |
| Size | ~1 kB, bundled | Library + runtime + model (tens of MB) |
| Offline | Always | After first model download (cached in IndexedDB) |
| Quality | Good for flat/studio backgrounds | Studio-quality masks on photos |

**Why both:** the single-file/offline-first requirement means a 40–80 MB model can't be inlined into
`index.html`. The heuristic stays the instant, always-offline default; the neural engine is lazily
loaded at runtime on first use and its model bytes cached in Dexie so subsequent uses work offline.

> [!WARNING]
> **Licensing:** `@imgly/background-removal` is **AGPL-3.0**. Fine for a personal/open-source project; for
> closed-source distribution use the provider interface with `transformers.js` (Apache-2.0) + an
> Apache/MIT-licensed model (e.g. MODNet). BRIA RMBG-1.4/2.0 weights are **non-commercial**.

The neural engine is implemented behind a `BackgroundRemovalProvider` interface so providers are swappable.

---

## ADR-003 — Framework: **React 19 + Vite + TypeScript (strict) + Zustand + Immer + Dexie** ✅

Confirmed as recommended, with these specifics:
- **Tailwind CSS v4** (`@tailwindcss/vite`) + glassmorphic theme system (CSS-variable tokens, 7 presets, dark/light).
- **`vite-plugin-singlefile`** → one self-contained `dist/index.html` runnable from `file://`.
- **Zustand + Immer** store with discriminated unions (`ImageObject | LineObject`), `enablePatches()` for history.
- **Dexie (IndexedDB)** for workspaces + image blobs (localStorage only for tiny UI prefs read before first paint).
- **Web Workers** imported with `?worker&inline` so they're embedded in the single file.
- **Lucide** icons; Radix primitives only where accessibility is non-trivial (sliders, dialogs, context menus).

---

## ADR-004 — "Legacy vs Improved" engine variants with a runtime switch ✅

A typed **variant registry** (`src/engine/variants.ts`) persisted in Dexie `kv`, exposed in
**Settings → Engines** as segmented controls. Each variant implements the same interface, so the rest
of the app never branches on which one is active.

| Feature | Legacy | Improved (default) |
| --- | --- | --- |
| Background removal | Corner-sample heuristic | Neural segmentation (lazy, cached) |
| Undo/redo history | Full-scene snapshot stack (50) | Immer patch/inverse-patch transactions |
| Magnetic lasso pathfinding | Dijkstra on main thread | A* (+ Sobel cost map) in an inline Web Worker |
| Lasso path smoothing | Douglas-Peucker only | Douglas-Peucker + Chaikin (2 iterations) |
| Line roughness | Seeded jitter passes | Seeded jitter + pressure-like width variation |
| JPEG XL import/export | Native browser support only (hidden if unsupported) | Native → WASM `libjxl` fallback |

Defaults to Improved where available; automatically falls back to Legacy when an improved engine is
unavailable (offline before model download, no Worker support, etc.).
