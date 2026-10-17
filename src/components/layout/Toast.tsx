import { useSceneStore } from '../../store/sceneStore';
import { AlertCircle, CheckCircle2, Info, X } from 'lucide-react';

export function Toast() {
  const toast = useSceneStore((state) => state.ui.toast);
  const hideToast = useSceneStore((state) => state.hideToast);

  if (!toast) return null;

  return (
    <div className="fixed bottom-16 right-5 z-50 flex items-center gap-2.5 rounded-[var(--radius)] glass-strong px-4 py-2.5 shadow-xl text-xs text-fg animate-in fade-in slide-in-from-bottom-2 duration-200">
      {toast.type === 'success' && <CheckCircle2 size={16} className="text-emerald-500" />}
      {toast.type === 'error' && <AlertCircle size={16} className="text-rose-500" />}
      {(!toast.type || toast.type === 'info') && <Info size={16} className="text-accent" />}
      <span className="font-medium">{toast.message}</span>
      <button
        onClick={hideToast}
        className="ml-1 apple-btn apple-btn-ghost apple-btn-icon h-5 w-5 text-fg-muted"
        aria-label="Dismiss toast"
      >
        <X size={12} />
      </button>
    </div>
  );
}
