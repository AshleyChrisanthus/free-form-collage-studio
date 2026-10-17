import { useState } from 'react';
import { Frame, Infinity as InfinityIcon, Layers, Moon, Palette, Sun } from 'lucide-react';
import { ThemeModal } from './components/ThemeModal';
import { useTheme } from './hooks/useTheme';

type Workspace = 'creation' | 'framing';

/**
 * App shell only. Canvas engines, tools and panels are tracked as GitHub issues
 * (see README → Roadmap) and are intentionally not implemented yet.
 */
export default function App() {
  const { mode, toggle } = useTheme();
  const [themeOpen, setThemeOpen] = useState(false);
  const [workspace, setWorkspace] = useState<Workspace>('creation');

  return (
    <div className="app-backdrop flex h-full flex-col text-fg">
      {/* Top bar */}
      <header className="glass relative z-10 m-3 flex items-center justify-between gap-3 rounded-[var(--radius)] px-4 py-2.5">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent text-white">
            <Layers size={17} />
          </div>
          <div className="leading-tight">
            <div className="text-sm font-semibold">Free-Form Collage Studio</div>
            <div className="text-[11px] text-fg-muted">Offline-first canvas · v0.1 scaffold</div>
          </div>
        </div>

        <div className="segmented" role="group" aria-label="Workspace">
          <button aria-pressed={workspace === 'creation'} onClick={() => setWorkspace('creation')}>
            <span className="inline-flex items-center gap-1.5">
              <InfinityIcon size={14} /> Creation
            </span>
          </button>
          <button aria-pressed={workspace === 'framing'} onClick={() => setWorkspace('framing')}>
            <span className="inline-flex items-center gap-1.5">
              <Frame size={14} /> Framing &amp; Export
            </span>
          </button>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            className="apple-btn apple-btn-ghost apple-btn-icon"
            onClick={toggle}
            aria-label={`Switch to ${mode === 'dark' ? 'light' : 'dark'} mode`}
            title="Toggle dark / light"
          >
            {mode === 'dark' ? <Sun size={17} /> : <Moon size={17} />}
          </button>
          <button className="apple-btn" onClick={() => setThemeOpen(true)}>
            <Palette size={15} /> Theme
          </button>
        </div>
      </header>

      {/* Stage placeholder */}
      <main className="relative flex flex-1 items-center justify-center p-6">
        <div className="apple-card max-w-lg p-6 text-center">
          <h1 className="mb-2 text-lg font-semibold">
            {workspace === 'creation' ? 'Creation Engine' : 'Framing & Export Engine'}
          </h1>
          <p className="text-sm text-fg-muted">
            The project is scaffolded (Vite · React · TypeScript · Tailwind v4 · Dexie · single-file build) with the
            glassmorphic theme system. Feature work is tracked in the GitHub issues.
          </p>
        </div>
      </main>

      <ThemeModal isOpen={themeOpen} onClose={() => setThemeOpen(false)} />
    </div>
  );
}
