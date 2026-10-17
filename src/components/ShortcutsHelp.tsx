import { useEffect } from 'react';
import { SHORTCUTS } from '../input/shortcuts';
import { Keyboard, X } from 'lucide-react';

interface ShortcutsHelpProps {
  isOpen: boolean;
  onClose: () => void;
}

export function ShortcutsHelp({ isOpen, onClose }: ShortcutsHelpProps) {
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const categories = Array.from(new Set(SHORTCUTS.map((s) => s.category)));

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'var(--modal-backdrop)' }}
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
      role="dialog"
      aria-modal="true"
      aria-label="Keyboard shortcuts"
    >
      <div className="glass-strong flex max-h-[85vh] w-full max-w-xl flex-col overflow-hidden rounded-[var(--radius)]">
        <div className="flex items-center justify-between border-b border-line-soft px-5 py-4">
          <div className="flex items-center gap-2">
            <Keyboard size={18} className="text-accent" />
            <h2 className="text-base font-semibold">Keyboard Shortcuts</h2>
          </div>
          <button
            className="apple-btn apple-btn-ghost apple-btn-icon"
            onClick={onClose}
            aria-label="Close"
          >
            <X size={16} />
          </button>
        </div>

        <div className="overflow-y-auto p-5 space-y-6">
          {categories.map((cat) => {
            const list = SHORTCUTS.filter((s) => s.category === cat);
            return (
              <div key={cat}>
                <h3 className="mb-2.5 text-xs font-semibold uppercase tracking-wider text-fg-muted">
                  {cat}
                </h3>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {list.map((sc, idx) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-xs"
                    >
                      <span className="text-fg">{sc.description}</span>
                      <kbd className="ml-2 rounded border border-[var(--border)] bg-[var(--surface-raised)] px-1.5 py-0.5 font-mono text-[11px] font-semibold text-fg">
                        {sc.ctrlOrMeta ? 'Ctrl+' : ''}
                        {sc.shift ? 'Shift+' : ''}
                        {sc.key.toUpperCase()}
                      </kbd>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
