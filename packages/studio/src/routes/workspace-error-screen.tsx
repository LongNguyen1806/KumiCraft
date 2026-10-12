import { useTranslation } from 'react-i18next';

import type { WorkspaceProblem } from '../api/session.ts';
import { TopBar } from '../features/shell/top-bar.tsx';
import { ProblemRow } from '../features/workspace-error/problem-row.tsx';
import { useRecovery } from '../features/workspace-error/use-recovery.ts';
import { errorText } from './error-text.ts';

type WorkspaceErrorScreenProps = {
  readonly version: string;
  readonly problems: readonly WorkspaceProblem[];
  /** Reads the session again after a restore or a retry. */
  readonly onChanged: () => void;
};

/** State `error`: the workspace is not opened in part (R-WS-01); each broken file is listed. */
export function WorkspaceErrorScreen({ version, problems, onChanged }: WorkspaceErrorScreenProps) {
  const { t } = useTranslation();
  const { t: tError } = useTranslation('errors');
  const recovery = useRecovery(onChanged);
  return (
    <div className="flex h-full flex-col gap-2.5 overflow-auto px-3.5 py-3">
      <TopBar version={version} />
      <main className="mx-auto grid w-full max-w-2xl flex-1 content-center gap-5 px-2 py-8">
        <h1 className="text-4xl font-light tracking-tight">{t('workspaceError.title')}</h1>
        <p className="text-ink-soft">{t('workspaceError.intro')}</p>
        <ul className="grid gap-3" aria-label={t('workspaceError.files')}>
          {problems.map((problem) => (
            <ProblemRow
              key={problem.file}
              problem={problem}
              backup={recovery.latestBackup(problem.file)}
              isBusy={recovery.isBusy}
              onRestore={recovery.restore}
            />
          ))}
        </ul>
        {recovery.failedCode !== undefined && (
          <p role="alert" className="text-danger">
            {errorText(tError, recovery.failedCode)}
          </p>
        )}
        <button
          type="button"
          disabled={recovery.isBusy}
          onClick={recovery.retry}
          className="h-10 justify-self-start rounded-full bg-charcoal px-5 text-on-charcoal disabled:opacity-60"
        >
          {t('workspaceError.retry')}
        </button>
      </main>
    </div>
  );
}
