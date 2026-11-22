// Error banner on Canvas when a drop operation is rejected (SPEC-04 M-DD, R-DD-14).
import { useTranslation } from 'react-i18next';

import { useDndStore } from '../../core/dnd-store.ts';
import { errorText } from '../../routes/error-text.ts';

export function DndErrorBanner() {
  const { t } = useTranslation();
  const { t: tError } = useTranslation('errors');
  const error = useDndStore((s) => s.error);
  const setError = useDndStore((s) => s.setError);

  if (!error) return <></>;

  return (
    <div
      role="alert"
      data-testid="dnd-error"
      className="flex items-center justify-between gap-3 border-b border-danger/30 bg-danger/10 px-4 py-1.5 text-xs text-danger"
    >
      <span>{errorText(tError, error.code, error.params)}</span>
      <button
        type="button"
        data-testid="dnd-error-dismiss"
        onClick={() => {
          setError(undefined);
        }}
        className="shrink-0 rounded border border-danger/30 px-2 py-0.5 font-medium hover:bg-danger/15"
      >
        {t('editor.dnd.dismiss')}
      </button>
    </div>
  );
}
