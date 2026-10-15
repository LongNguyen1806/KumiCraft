// Banner displayed on top of Canvas when project fails to build (SPEC-04 M-RN, R-RN-25).
import { useTranslation } from 'react-i18next';

import { useCanvasErrorStore } from './canvas-error-store.ts';

export type BuildErrorBannerProps = {
  readonly onOpenLoc: (loc: string) => void;
};

export function BuildErrorBanner({ onOpenLoc }: BuildErrorBannerProps) {
  const { t } = useTranslation();
  const buildError = useCanvasErrorStore((s) => s.buildError);

  if (buildError === undefined) {
    return undefined;
  }

  const file = buildError.file;
  const line = buildError.line;
  const column = buildError.column;
  const hasLocation = file !== undefined && line !== undefined;
  const locationLabel =
    file !== undefined && line !== undefined
      ? `${file}:${String(line)}${column !== undefined ? `:${String(column)}` : ''}`
      : undefined;

  return (
    <div
      role="alert"
      data-testid="canvas-build-error"
      className="flex flex-col gap-1.5 border-b border-red-500/30 bg-red-500/10 px-4 py-2.5 text-ink backdrop-blur-md"
    >
      <div className="flex items-center justify-between gap-3">
        <h4 className="text-xs font-semibold text-red-500">{t('canvas.buildError.title')}</h4>
        {hasLocation && locationLabel && (
          <button
            type="button"
            onClick={() => {
              onOpenLoc(`${file}:${String(line)}:${String(column ?? 1)}`);
            }}
            data-testid="canvas-build-error-open"
            className="rounded border border-red-500/30 bg-card px-2 py-0.5 font-mono text-[11px] text-red-500 hover:bg-field-hover"
          >
            {locationLabel}
          </button>
        )}
      </div>
      <pre
        data-testid="canvas-build-error-message"
        className="max-h-32 overflow-auto font-mono text-xs whitespace-pre-wrap text-ink-soft"
      >
        {buildError.message}
      </pre>
    </div>
  );
}
