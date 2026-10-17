import { useEffect } from 'react';
import { VARIANTS, type VariantKey, type VariantValue } from '../../engine/variants';
import { useVariantStore } from '../../store/variantStore';
import { Cpu, AlertCircle } from 'lucide-react';

export function EnginesPanel() {
  const { variants, availability, setVariant, checkAvailability } = useVariantStore();

  useEffect(() => {
    void checkAvailability();
  }, [checkAvailability]);

  return (
    <div className="space-y-6 py-2">
      <div className="flex items-center gap-2 border-b border-[var(--border)] pb-3">
        <Cpu className="text-accent" size={18} />
        <div>
          <h3 className="text-sm font-semibold">Engine Architecture & Variants</h3>
          <p className="text-xs text-fg-muted">
            Switch between legacy baseline algorithms and modern web-native implementations (ADR-004).
          </p>
        </div>
      </div>

      <div className="space-y-4">
        {Object.values(VARIANTS).map((variant) => {
          const vKey = variant.key as VariantKey;
          const currentVal = variants[vKey];

          return (
            <div
              key={variant.key}
              className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-3.5 transition-all"
            >
              <div className="mb-2 flex items-center justify-between">
                <div>
                  <div className="text-sm font-medium">{variant.label}</div>
                  <div className="text-xs text-fg-muted">{variant.description}</div>
                </div>
              </div>

              {/* Segmented control for options */}
              <div className="segmented mt-2.5 w-full grid grid-cols-2 gap-1 p-1">
                {variant.options.map((optId) => {
                  const opt = (variant.optionDetails as Record<string, { name: string; badge?: string; badgeType?: string; description: string }>)[optId];
                  const isSelected = currentVal === optId;
                  const isAvail = availability[`${vKey}:${optId}`] ?? true;

                  return (
                    <button
                      key={optId}
                      type="button"
                      disabled={!isAvail}
                      aria-pressed={isSelected}
                      onClick={() => void setVariant(vKey, optId as VariantValue<typeof vKey>)}
                      className={`relative flex flex-col items-start p-2 text-left transition-all ${
                        !isAvail ? 'opacity-50 cursor-not-allowed' : ''
                      }`}
                    >
                      <div className="flex w-full items-center justify-between gap-1.5">
                        <span className="text-xs font-semibold">{opt.name}</span>
                        {opt.badge && (
                          <span
                            className={`rounded-full px-1.5 py-0.5 text-[10px] font-medium leading-none ${
                              opt.badgeType === 'success'
                                ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
                                : 'bg-fg/10 text-fg-muted'
                            }`}
                          >
                            {opt.badge}
                          </span>
                        )}
                      </div>
                      <span className="mt-1 line-clamp-2 text-[11px] text-fg-muted leading-relaxed">
                        {opt.description}
                      </span>
                      {!isAvail && (
                        <div className="mt-1 flex items-center gap-1 text-[10px] text-amber-500">
                          <AlertCircle size={10} />
                          <span>Not supported on this system</span>
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
