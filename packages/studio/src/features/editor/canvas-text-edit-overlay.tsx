// Text edit warning and loop overlay for Canvas (SPEC-04 M-TX, R-TX-04).
import { useTranslation } from 'react-i18next';

import type { TextEditWarning } from '../text-edit/use-canvas-text-edit.ts';

function TextEditWarningBanner({
  warning,
  onOpenEditor,
  onDismiss,
}: {
  readonly warning: TextEditWarning;
  readonly onOpenEditor: () => void;
  readonly onDismiss: () => void;
}) {
  const { t } = useTranslation();
  return (
    <div
      role="alert"
      data-testid="text-edit-warning-banner"
      className="absolute top-14 left-1/2 z-30 flex -translate-x-1/2 items-center gap-3 rounded-lg border border-amber-500/30 bg-card-solid/95 px-4 py-2 text-xs text-amber-500 shadow-xl backdrop-blur-md"
    >
      <span>{t(warning.messageKey)}</span>
      <button
        type="button"
        onClick={onOpenEditor}
        className="font-medium text-primary underline hover:opacity-80"
        data-testid="text-edit-open-editor-btn"
      >
        {t('textEdit.openInEditor')}
      </button>
      <button
        type="button"
        onClick={onDismiss}
        aria-label={t('settings.close')}
        className="ml-1 text-sm leading-none text-ink-soft hover:text-ink"
        data-testid="text-edit-dismiss-warning-btn"
      >
        ×
      </button>
    </div>
  );
}

export function TextEditOverlay({
  warning,
  loopCount,
  onOpenEditor,
  onDismiss,
}: {
  readonly warning: TextEditWarning | undefined;
  readonly loopCount: number | undefined;
  readonly onOpenEditor: () => void;
  readonly onDismiss: () => void;
}) {
  const { t } = useTranslation();
  return (
    <>
      {warning && (
        <TextEditWarningBanner
          warning={warning}
          onOpenEditor={onOpenEditor}
          onDismiss={onDismiss}
        />
      )}
      {loopCount !== undefined && (
        <div
          data-testid="text-edit-loop-banner"
          className="absolute top-14 left-1/2 z-30 flex -translate-x-1/2 items-center gap-2 rounded-full border border-primary/30 bg-card-solid/95 px-3 py-1 text-xs font-medium text-primary shadow-lg backdrop-blur-md"
        >
          <span>{t('textEdit.loopBanner', { count: loopCount })}</span>
        </div>
      )}
    </>
  );
}
