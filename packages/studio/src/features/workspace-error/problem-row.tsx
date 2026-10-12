import { useTranslation } from 'react-i18next';

import type { WorkspaceProblem } from '../../api/session.ts';
import type { BackupSummary } from '../../api/workspace-client.ts';
import { errorText } from '../../routes/error-text.ts';
import { formatBackupTime } from './format-backup-time.ts';

type ProblemRowProps = {
  readonly problem: WorkspaceProblem;
  readonly backup: BackupSummary | undefined;
  readonly isBusy: boolean;
  readonly onRestore: (backup: BackupSummary) => void;
};

/** One broken file: its path, what is wrong and the restore button (R-WS-02). */
export function ProblemRow({ problem, backup, isBusy, onRestore }: ProblemRowProps) {
  const { t, i18n } = useTranslation();
  const { t: tError } = useTranslation('errors');
  return (
    <li className="grid gap-2 rounded-2xl border border-line bg-card-solid p-4">
      <p className="font-mono text-xs break-all" data-testid="problem-file">
        {problem.file}
      </p>
      <p className="text-danger">{errorText(tError, problem.code)}</p>
      {backup === undefined ? (
        <p className="text-xs text-ink-faint">{t('workspaceError.noBackup')}</p>
      ) : (
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            disabled={isBusy}
            onClick={() => {
              onRestore(backup);
            }}
            className="h-9 rounded-full bg-sun px-4 font-medium text-ink disabled:opacity-60"
          >
            {t('workspaceError.restore')}
          </button>
          <span className="text-xs text-ink-faint">
            {t('workspaceError.backupFrom', {
              time: formatBackupTime(backup.createdAt, i18n.resolvedLanguage ?? 'en'),
            })}
          </span>
        </div>
      )}
    </li>
  );
}
