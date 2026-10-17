import { useEffect, useRef, useState } from 'react';
import { Check, Download, Moon, Palette, RotateCcw, Sun, Upload, X } from 'lucide-react';
import {
  CUSTOMIZABLE_TOKENS,
  THEME_PRESETS,
  applyPresetPaletteForMode,
  getCustomColors,
  readToken,
  resetCustomColors,
  setActivePreset,
  setCustomColor,
} from '../styles/theme';
import { useTheme } from '../hooks/useTheme';
import { downloadBackup, restoreBackup } from '../db/backup';

interface ThemeModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type Tab = 'presets' | 'customize' | 'data';

function toHex(value: string): string {
  // <input type="color"> only accepts #rrggbb.
  return /^#[0-9a-f]{6}$/i.test(value) ? value : '#000000';
}

export function ThemeModal({ isOpen, onClose }: ThemeModalProps) {
  const { mode, presetId, setMode, refresh } = useTheme();
  const [tab, setTab] = useState<Tab>('presets');
  const [, force] = useState(0);
  const [status, setStatus] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const custom = getCustomColors();

  const handleImport = async (file?: File) => {
    if (!file) return;
    try {
      await restoreBackup(file);
      applyPresetPaletteForMode(mode);
      refresh();
      setStatus('Backup restored.');
    } catch (err) {
      setStatus(err instanceof Error ? err.message : 'Import failed.');
    } finally {
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'var(--modal-backdrop)' }}
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
      role="dialog"
      aria-modal="true"
      aria-label="Theme and settings"
    >
      <div className="glass-strong flex max-h-[85vh] w-full max-w-2xl flex-col overflow-hidden rounded-[var(--radius)]">
        {/* Header */}
        <div className="flex items-center justify-between gap-3 border-b border-line-soft px-5 py-4">
          <div className="flex items-center gap-2">
            <Palette size={18} className="text-accent" />
            <h2 className="text-base font-semibold">Theme &amp; Settings</h2>
          </div>
          <div className="flex items-center gap-2">
            <div className="segmented" role="group" aria-label="Color mode">
              <button aria-pressed={mode === 'dark'} onClick={() => setMode('dark')}>
                <span className="inline-flex items-center gap-1.5">
                  <Moon size={13} /> Dark
                </span>
              </button>
              <button aria-pressed={mode === 'light'} onClick={() => setMode('light')}>
                <span className="inline-flex items-center gap-1.5">
                  <Sun size={13} /> Light
                </span>
              </button>
            </div>
            <button className="apple-btn apple-btn-ghost apple-btn-icon" onClick={onClose} aria-label="Close">
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="px-5 pt-3">
          <div className="segmented" role="tablist">
            {(['presets', 'customize', 'data'] as Tab[]).map((t) => (
              <button key={t} role="tab" aria-pressed={tab === t} onClick={() => setTab(t)} className="capitalize">
                {t}
              </button>
            ))}
          </div>
        </div>

        <div className="overflow-y-auto p-5">
          {tab === 'presets' && (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {THEME_PRESETS.map((p) => {
                const active = p.id === presetId;
                return (
                  <button
                    key={p.id}
                    onClick={() => {
                      setActivePreset(p.id);
                      refresh();
                      force((n) => n + 1);
                    }}
                    className="apple-card relative p-3 text-left"
                    style={active ? { borderColor: 'var(--accent)', boxShadow: '0 0 0 1px var(--accent)' } : undefined}
                  >
                    <div className="mb-2 flex gap-1.5">
                      {p.swatches[mode].map((c, i) => (
                        <span
                          key={i}
                          className="h-6 w-6 rounded-full border border-black/10"
                          style={{ backgroundColor: c }}
                        />
                      ))}
                    </div>
                    <div className="text-sm font-semibold">{p.name}</div>
                    <div className="text-xs text-fg-muted">{p.desc}</div>
                    {active && (
                      <span className="absolute right-3 top-3 rounded-full bg-accent p-1 text-white">
                        <Check size={12} />
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          )}

          {tab === 'customize' && (
            <div className="space-y-3">
              <p className="text-xs text-fg-muted">
                Fine-tune individual tokens on top of the active preset. Overrides are stored locally and cleared when
                you pick a new preset.
              </p>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {CUSTOMIZABLE_TOKENS.map(({ key, label }) => (
                  <label key={key} className="apple-card flex items-center justify-between gap-3 px-3 py-2">
                    <span className="text-sm">
                      {label}
                      {custom[key] && <span className="ml-1.5 text-[10px] text-accent">custom</span>}
                    </span>
                    <input
                      type="color"
                      className="h-7 w-10 cursor-pointer rounded border-0 bg-transparent"
                      value={toHex(readToken(key))}
                      onChange={(e) => {
                        setCustomColor(key, e.target.value);
                        force((n) => n + 1);
                      }}
                    />
                  </label>
                ))}
              </div>
              <button
                className="apple-btn"
                onClick={() => {
                  resetCustomColors();
                  force((n) => n + 1);
                }}
              >
                <RotateCcw size={14} /> Reset overrides
              </button>
            </div>
          )}

          {tab === 'data' && (
            <div className="space-y-4">
              <p className="text-sm text-fg-muted">
                Everything is stored locally in this browser (IndexedDB + localStorage). Export a JSON backup to move
                your workspaces and preferences to another browser or machine.
              </p>
              <div className="flex flex-wrap gap-2">
                <button
                  className="apple-btn apple-btn-primary"
                  onClick={async () => {
                    await downloadBackup();
                    setStatus('Backup downloaded.');
                  }}
                >
                  <Download size={14} /> Export JSON
                </button>
                <button className="apple-btn" onClick={() => fileRef.current?.click()}>
                  <Upload size={14} /> Import JSON
                </button>
                <input
                  ref={fileRef}
                  type="file"
                  accept="application/json,.json"
                  hidden
                  onChange={(e) => handleImport(e.target.files?.[0])}
                />
              </div>
              <p className="text-xs text-warning">Importing replaces all current local data.</p>
              {status && <p className="text-sm text-fg">{status}</p>}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
