// What the Drafts panel shows above its list: reading, could not read, none yet, notices.
import { Loader2, Plus } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { LoadFailed } from '../../components/ui/load-failed.tsx';

function DraftsLoading() {
  const { t } = useTranslation();
  return (
    <p
      role="status"
      data-testid="drafts-loading"
      className="flex items-center justify-center gap-2 py-6 text-xs text-ink-faint"
    >
      <Loader2 className="size-3.5 animate-spin" aria-hidden />
      {t('drafts.loading')}
    </p>
  );
}

/** The button that opens the same New draft dialog as the page list of the Canvas bar. */
function NewDraftButton({
  onNew,
  wide = false,
}: {
  readonly onNew: () => void;
  readonly wide?: boolean;
}) {
  const { t } = useTranslation();
  return (
    <button
      type="button"
      data-testid="drafts-new-btn"
      onClick={onNew}
      className={`flex h-7 items-center justify-center gap-1.5 rounded-md border border-line bg-card-solid px-2.5 text-xs font-medium text-ink hover:bg-field ${wide ? 'self-center' : 'self-start'}`}
    >
      <Plus className="size-3.5" aria-hidden />
      {t('drafts.new')}
    </button>
  );
}

function DraftsEmpty({ onNew }: { readonly onNew: () => void }) {
  const { t } = useTranslation();
  return (
    <div data-testid="drafts-empty" className="flex flex-col items-center gap-3 py-6">
      <p className="text-xs text-ink-faint">{t('drafts.empty')}</p>
      <NewDraftButton onNew={onNew} wide />
    </div>
  );
}

/** Reading, no draft yet (with the button), or the button above the list. */
export function DraftsStatus({
  loaded,
  failed = false,
  count,
  onNew,
  onRetry,
}: {
  readonly loaded: boolean;
  readonly failed?: boolean | undefined;
  readonly count: number;
  readonly onNew: (() => void) | undefined;
  readonly onRetry?: (() => void) | undefined;
}) {
  const { t } = useTranslation();
  if (!loaded) return <DraftsLoading />;
  if (failed && count === 0 && onRetry !== undefined) {
    return (
      <LoadFailed testId="drafts-load-failed" message={t('drafts.loadFailed')} onRetry={onRetry} />
    );
  }
  if (onNew === undefined) return undefined;
  return count === 0 ? <DraftsEmpty onNew={onNew} /> : <NewDraftButton onNew={onNew} />;
}

/** The .gitignore warning and the last action's error, above the list. */
export function DraftsNotices({
  ignored,
  errorMsg,
}: {
  readonly ignored: boolean;
  readonly errorMsg: string | undefined;
}) {
  const { t } = useTranslation();
  return (
    <>
      {ignored && (
        <div
          data-testid="drafts-ignored-warning"
          className="rounded-md bg-sun-soft p-2 text-xs text-ink"
        >
          {t('drafts.ignoredWarning')}
        </div>
      )}
      {errorMsg !== undefined && (
        <div role="alert" className="text-xs text-danger">
          {errorMsg}
        </div>
      )}
    </>
  );
}
