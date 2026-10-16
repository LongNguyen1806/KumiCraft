import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { installProject } from '../../api/project-client.ts';
import { Dialog } from '../../components/ui/dialog.tsx';

function useInstallExecution(
  installCommand: readonly string[],
  onClose: () => void,
  onInstalled: () => void,
) {
  const { t } = useTranslation();
  const [running, setRunning] = useState(false);
  const [logs, setLogs] = useState<readonly string[]>([]);
  const [errorText, setErrorText] = useState<string>();

  const handleInstall = async () => {
    setRunning(true);
    setErrorText(undefined);
    setLogs(['Spawning install process…']);
    try {
      await installProject(installCommand);
      setLogs((prev) => [...prev, 'Installation completed successfully!']);
      onInstalled();
      setTimeout(onClose, 800);
    } catch (err) {
      setErrorText(err instanceof Error ? err.message : t('project.install.failed'));
      setLogs((prev) => [...prev, 'Error during installation.']);
    } finally {
      setRunning(false);
    }
  };

  return { running, logs, errorText, handleInstall };
}

function InstallLogsViewer({
  running,
  logs,
}: {
  readonly running: boolean;
  readonly logs: readonly string[];
}) {
  if (!running && logs.length === 0) return undefined;
  return (
    <div
      className="flex max-h-40 flex-col gap-1 overflow-y-auto rounded-lg bg-charcoal p-3 font-mono text-[11px] text-on-charcoal border border-border"
      data-testid="install-logs"
    >
      {logs.slice(-20).map((line, i) => (
        <span key={i} className="break-all whitespace-pre-wrap">
          {line}
        </span>
      ))}
    </div>
  );
}

function InstallActionButtons({
  running,
  onClose,
  onInstall,
}: {
  readonly running: boolean;
  readonly onClose: () => void;
  readonly onInstall: () => void;
}) {
  const { t } = useTranslation();
  return (
    <div className="flex items-center justify-end gap-2 pt-2">
      {running ? (
        <button
          type="button"
          onClick={onClose}
          className="rounded-full bg-field px-4 py-2 text-ink hover:bg-field-hover"
          data-testid="cancel-install-btn"
        >
          {t('project.install.cancel')}
        </button>
      ) : (
        <button
          type="button"
          onClick={onInstall}
          className="rounded-full bg-primary px-5 py-2 font-medium text-white shadow-sm hover:bg-primary-hover"
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
  const { running, logs, errorText, handleInstall } = useInstallExecution(
    installCommand,
    onClose,
    onInstalled,
  );

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

        <InstallLogsViewer running={running} logs={logs} />

        {errorText && (
          <p className="text-xs text-rose-600 font-medium" data-testid="install-error">
            {errorText}
          </p>
        )}

        <InstallActionButtons
          running={running}
          onClose={onClose}
          onInstall={() => {
            void handleInstall();
          }}
        />
      </div>
    </Dialog>
  );
}
