import { useTranslation } from 'react-i18next';

import { useCanvasErrorStore } from '../../core/canvas-error-store.ts';
import { useCanvasViewStore } from '../../core/canvas-view-store.ts';

type RuntimeErrorItemsProps = {
  readonly errors: readonly { readonly message: string; readonly count: number }[];
  readonly draftFile: string | undefined;
};

function RuntimeErrorItems({ errors, draftFile }: RuntimeErrorItemsProps) {
  const { t } = useTranslation();
  return (
    <div className="flex max-h-40 flex-col gap-1.5 overflow-y-auto">
      {draftFile !== undefined && (
        <div
          data-testid="draft-provider-hint"
          className="rounded bg-sun-soft px-2 py-1 text-[11px] text-warn dark:text-warn"
        >
          {t('drafts.providerHint')}
        </div>
      )}
      {errors.map((err) => (
        <div
          key={err.message}
          data-testid="canvas-runtime-error-item"
          className="flex items-center justify-between gap-2 overflow-hidden rounded bg-danger/10 px-2 py-1 text-ink"
        >
          <span className="truncate font-mono text-[11px]" title={err.message}>
            {err.message}
          </span>
          {err.count > 1 && (
            <span
              data-testid="canvas-runtime-error-count"
              className="shrink-0 font-mono text-[11px] font-bold text-danger"
            >
              ×{String(err.count)}
            </span>
          )}
        </div>
      ))}
    </div>
  );
}

export function RuntimeErrorList() {
  const { t } = useTranslation();
  const runtimeErrors = useCanvasErrorStore((s) => s.runtimeErrors);
  const dismissRuntimeErrors = useCanvasErrorStore((s) => s.dismissRuntimeErrors);
  const draftFile = useCanvasViewStore((s) => s.draftFile);

  if (runtimeErrors.length === 0) {
    return undefined;
  }

  return (
    <div
      data-testid="canvas-runtime-errors"
      className="absolute bottom-3 left-3 z-10 flex max-w-md flex-col gap-2 rounded-xl border border-danger/30 bg-card-solid/95 p-3 text-xs shadow-xl backdrop-blur-md"
    >
      <div className="flex items-center justify-between gap-3">
        <span className="font-semibold text-danger">
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
      <RuntimeErrorItems errors={runtimeErrors} draftFile={draftFile} />
    </div>
  );
}
