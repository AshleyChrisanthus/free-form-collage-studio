# Free-Form Collage Studio

Offline-first, client-side visual composition studio with two workspaces:

- **Creation Engine** – infinite pan/zoom whiteboard for collaging, mood-boarding and diagramming.
- **Framing & Export Engine** – bounded stage with aspect presets, DPI/metric sizing and multi-format export.

Full spec: [`COLLAGE_BUILDER_REBUILD_BLUEPRINT.md`](./COLLAGE_BUILDER_REBUILD_BLUEPRINT.md) ·
Decisions: [`docs/ARCHITECTURE_DECISIONS.md`](./docs/ARCHITECTURE_DECISIONS.md)

## Architecture

| Concern | Choice |
| --- | --- |
| Build | Vite + React 19 + TypeScript (strict) + Tailwind CSS v4 |
| Bundle | `vite-plugin-singlefile` → one self-contained `dist/index.html` |
| Storage | Dexie (IndexedDB) for workspaces & image blobs; localStorage for theme prefs |
| State | Zustand + Immer |
| Rendering | Layered HTML5 Canvas 2D (background / scene / overlay) |
| Styling | Glassmorphic theme system – 7 presets, dark/light, granular token customizer |
| Backup | Settings → Data → Export / Import JSON |

The production build runs with **zero backend**: double-click `dist/index.html` or open it via `file://`.

## Scripts

```bash
npm install
npm run dev        # dev server
npm run build      # type-check + single-file build → dist/index.html
npm run preview    # preview the build
```

## Roadmap

All features are tracked as GitHub issues (label `epic` for the roadmap tracker). Engines that have a
**Legacy** and an **Improved** implementation can be switched at runtime in *Settings → Engines*
(see ADR-004).
