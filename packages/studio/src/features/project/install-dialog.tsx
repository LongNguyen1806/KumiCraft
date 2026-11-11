// Install dialog (R-PJ-22): the exact command, the newest 20 output lines while it runs, Cancel,
// and the translated error with the output of the package manager (E028).
import { useTranslation } from 'react-i18next';

import { Dialog } from '../../components/ui/dialog.tsx';
import { errorText } from '../../routes/error-text.ts';
import { type InstallFailure, type InstallPhase, useInstallJob } from './use-install-job.ts';

function InstallLogsViewer({
  phase,
  lines,
}: {
  readonly phase: InstallPhase;
  readonly lines: readonly string[];
}) {
  const { t } = useTranslation('jobs');
  const running = phase === 'starting' || phase === 'running';
  if (!running && lines.length === 0) return undefined;
  return (
    <div
      className="flex max-h-40 flex-col gap-1 overflow-y-auto rounded-lg bg-charcoal p-3 font-mono text-[11px] text-on-charcoal border border-border"
      data-testid="install-logs"
    >
      {lines.length === 0 ? (
        <span>{t('install.running')}</span>
      ) : (
        lines.map((line, i) => (
          <span key={i} className="break-all whitespace-pre-wrap">
            {line}
          </span>
        ))
      )}
    </div>
  );
}

function InstallError({ failure }: { readonly failure: InstallFailure }) {
  const { t: tError } = useTranslation('errors');
  return (
    <div className="flex flex-col gap-1" data-testid="install-error">
      <p className="text-xs text-danger font-medium">
        {errorText(tError, failure.code, failure.params)}
      </p>
      {failure.details.length > 0 && (
        <pre className="max-h-32 overflow-auto rounded-lg bg-field px-3 py-2 font-mono text-[11px] whitespace-pre-wrap text-ink-soft">
          {failure.details.join('\n')}
        </pre>
      )}
    </div>
  );
}

function InstallActionButtons({
  phase,
  onCancel,
  onInstall,
}: {
  readonly phase: InstallPhase;
  readonly onCancel: () => void;
  readonly onInstall: () => void;
}) {
  const { t } = useTranslation();
  const running = phase === 'starting' || phase === 'running';
  return (
    <div className="flex items-center justify-end gap-2 pt-2">
      {running ? (
        <button
          type="button"
          onClick={onCancel}
          disabled={phase === 'starting'}
          className="rounded-md bg-field px-4 h-8 text-ink hover:bg-field-hover disabled:opacity-50"
          data-testid="cancel-install-btn"
        >
          {t('project.install.cancel')}
        </button>
      ) : (
        <button
          type="button"
          onClick={onInstall}
          className="rounded-md bg-charcoal px-4 h-8 font-medium text-on-charcoal hover:bg-primary-hover"
          data-testid="install-btn"
        >
          {t('project.install.btn')}
        </button>
      )}
    </div>
  );
}

type InstallDialogProps = {
  readonly open: boolean;
  readonly installCommand?: readonly string[] | undefined;
  readonly onClose: () => void;
  readonly onInstalled: () => void;
};

export function InstallDialog({
  open,
  installCommand = ['pnpm', 'install'],
  onClose,
  onInstalled,
}: InstallDialogProps) {
  const { t } = useTranslation();
  const { t: tJobs } = useTranslation('jobs');
  const install = useInstallJob(installCommand, onInstalled);

  return (
    <Dialog open={open} title={t('project.install.title')} closeLabel="✕" onClose={onClose}>
      <div className="flex flex-col gap-4 text-xs text-ink" data-testid="install-dialog">
        <p className="text-ink-soft">{t('project.install.description')}</p>
        <div className="flex flex-col gap-1">
          <span className="text-[11px] text-ink-faint font-medium">
            {t('project.install.command')}:
          </span>
          <div
            className="rounded-lg bg-field px-3 py-2 font-mono text-xs text-ink border border-border"
            data-testid="install-command"
          >
            {installCommand.join(' ')}
          </div>
        </div>
        <InstallLogsViewer phase={install.phase} lines={install.lines} />
        {install.failure !== undefined && <InstallError failure={install.failure} />}
        {install.phase === 'cancelled' && (
          <p className="text-xs text-ink-soft" data-testid="install-cancelled">
            {tJobs('install.cancelled')}
          </p>
        )}
        <InstallActionButtons
          phase={install.phase}
          onCancel={install.cancel}
          onInstall={() => {
            void install.start();
          }}
        />
      </div>
    </Dialog>
  );
}
