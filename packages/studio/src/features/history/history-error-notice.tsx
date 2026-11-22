// Why the last Undo/Redo failed (R-HI-10), next to the Undo/Redo buttons.
import { useTranslation } from 'react-i18next';

import { useHistoryStore } from '../../core/history-store.ts';
import { errorText } from '../../routes/error-text.ts';

export function HistoryErrorNotice() {
  const { t } = useTranslation();
  const { t: tError } = useTranslation('errors');
  const error = useHistoryStore((s) => s.error);
  const clearError = useHistoryStore((s) => s.clearError);
  if (error === undefined) return undefined;

  const text =
    error.code === 'E017'
      ? t('history.errorFileChanged', { file: error.file ?? '' })
      : errorText(tError, error.code, error.params);

  return (
    <div
      role="alert"
      data-testid="history-error"
      className="flex max-w-[28rem] min-w-0 !shrink items-center gap-2 rounded-md bg-sun-soft py-0.5 pr-0.5 pl-3 text-xs text-ink"
    >
      <span className="min-w-0 truncate" title={text}>
        {text}
      </span>
      <button
        type="button"
        data-testid="history-error-dismiss"
        aria-label={t('history.dismissError')}
        onClick={clearError}
        className="h-6 shrink-0 rounded-md bg-field px-2 text-ink-soft hover:bg-field-hover"
      >
        ×
      </button>
    </div>
  );
}
