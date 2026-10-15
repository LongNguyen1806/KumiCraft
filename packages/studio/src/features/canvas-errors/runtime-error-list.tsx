// List of runtime errors displayed in a corner of the Canvas (SPEC-04 M-RN, R-RN-25).
import { useTranslation } from 'react-i18next';

import { useCanvasErrorStore } from './canvas-error-store.ts';

export function RuntimeErrorList() {
  const { t } = useTranslation();
  const runtimeErrors = useCanvasErrorStore((s) => s.runtimeErrors);
  const dismissRuntimeErrors = useCanvasErrorStore((s) => s.dismissRuntimeErrors);

  if (runtimeErrors.length === 0) {
    return undefined;
  }

  return (
    <div
      data-testid="canvas-runtime-errors"
      className="absolute bottom-3 left-3 z-10 flex max-w-md flex-col gap-2 rounded-xl border border-red-500/25 bg-card-solid/95 p-3 text-xs shadow-xl backdrop-blur-md"
    >
      <div className="flex items-center justify-between gap-3">
        <span className="font-semibold text-red-500">
          {t('canvas.runtimeErrors.title', { count: runtimeErrors.length })}
        </span>
        <button
          type="button"
          onClick={dismissRuntimeErrors}
          data-testid="canvas-runtime-errors-dismiss"
          aria-label={t('canvas.runtimeErrors.dismiss')}
          className="text-sm leading-none text-ink-soft hover:text-ink"
        >
          ×
        </button>
      </div>
      <div className="flex max-h-40 flex-col gap-1.5 overflow-y-auto">
        {runtimeErrors.map((err) => (
          <div
            key={err.message}
            data-testid="canvas-runtime-error-item"
            className="flex items-center justify-between gap-2 overflow-hidden rounded bg-red-500/5 px-2 py-1 text-ink"
          >
            <span className="truncate font-mono text-[11px]" title={err.message}>
              {err.message}
            </span>
            {err.count > 1 && (
              <span
                data-testid="canvas-runtime-error-count"
                className="shrink-0 font-mono text-[11px] font-bold text-red-500"
              >
                ×{String(err.count)}
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
