import { useTranslation } from 'react-i18next';

import { TopBar } from '../features/shell/top-bar.tsx';
import { errorText } from './error-text.ts';

type WorkspaceErrorScreenProps = {
  readonly version: string;
  readonly code: string;
  readonly onRetry: () => void;
};

/** State `error` (R-WS-01). The list of broken files and backup restore come with B3. */
export function WorkspaceErrorScreen({ version, code, onRetry }: WorkspaceErrorScreenProps) {
  const { t } = useTranslation();
  const { t: tError } = useTranslation('errors');
  return (
    <div className="flex h-full flex-col gap-2.5 px-3.5 py-3">
      <TopBar version={version} />
      <main className="grid flex-1 place-items-center px-4">
        <div className="grid max-w-lg gap-4 rounded-panel bg-card p-8 shadow-soft">
          <h1 className="text-3xl font-light tracking-tight">{t('workspaceError.title')}</h1>
          <p role="alert" className="text-danger">
            {errorText(tError, code)}
          </p>
          <button
            type="button"
            onClick={onRetry}
            className="h-10 justify-self-start rounded-full bg-charcoal px-5 text-on-charcoal"
          >
            {t('workspaceError.retry')}
          </button>
        </div>
      </main>
    </div>
  );
}
