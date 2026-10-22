// Dialog confirming agent install command and following install logs (R-AG-21, S-54).
import type { AgentStatus } from '@reactcraft/shared';
import { useTranslation } from 'react-i18next';

import { Dialog } from '../../components/ui/dialog.tsx';
import { errorText } from '../../routes/error-text.ts';
import type { JobFailure } from '../jobs/use-job-follower.ts';
import type { AgentInstallPhase } from './use-agent-install.ts';

export type AgentInstallDialogProps = {
  readonly phase: AgentInstallPhase;
  readonly agent: AgentStatus | undefined;
  readonly lines: readonly string[];
  readonly failure: JobFailure | undefined;
  readonly onConfirm: () => void;
  readonly onStop: () => void;
  readonly onClose: () => void;
};

function AgentNameLabel(id: string): string {
  if (id === 'agy') return 'Antigravity CLI';
  if (id === 'claude') return 'Claude Code';
  return id;
}

function InstallCommandPreview({
  command,
  docsUrl,
}: {
  readonly command: string;
  readonly docsUrl?: string | undefined;
}) {
  const { t } = useTranslation('chat');
  return (
    <div className="flex flex-col gap-2">
      <div
        data-testid="agent-install-command"
        className="rounded-lg bg-charcoal p-3 font-mono text-xs text-on-charcoal break-all border border-border"
      >
        {command}
      </div>
      <p className="text-xs text-ink-soft">{t('installNotice')}</p>
      {docsUrl !== undefined && (
        <div>
          <a
            href={docsUrl}
            target="_blank"
            rel="noreferrer noopener"
            data-testid="agent-install-docs"
            className="text-xs text-accent hover:underline cursor-pointer"
          >
            {t('officialDocs')}
          </a>
        </div>
      )}
    </div>
  );
}

function InstallLogsView({ lines }: { readonly lines: readonly string[] }) {
  const { t } = useTranslation('chat');
  return (
    <div
      data-testid="agent-install-lines"
      className="flex max-h-48 flex-col gap-1 overflow-y-auto rounded-lg bg-charcoal p-3 font-mono text-[11px] text-on-charcoal border border-border"
    >
      {lines.length === 0 ? (
        <span>{t('installRunning')}</span>
      ) : (
        lines.map((line, idx) => (
          <span key={idx} className="break-all whitespace-pre-wrap">
            {line}
          </span>
        ))
      )}
    </div>
  );
}

function InstallFailureView({ failure }: { readonly failure: JobFailure }) {
  const { t } = useTranslation('errors');
  const details = failure.details.length > 0 ? failure.details : [];
  return (
    <div data-testid="agent-install-error" className="flex flex-col gap-2">
      <p className="text-xs text-rose-600 font-medium">
        {errorText(t, failure.code, failure.params)}
      </p>
      {details.length > 0 && (
        <pre className="max-h-32 overflow-auto rounded-lg bg-field px-3 py-2 font-mono text-[11px] whitespace-pre-wrap text-ink-soft border border-border">
          {details.join('\n')}
        </pre>
      )}
    </div>
  );
}

function InstallDialogActions({
  phase,
  onConfirm,
  onStop,
  onClose,
}: {
  readonly phase: AgentInstallPhase;
  readonly onConfirm: () => void;
  readonly onStop: () => void;
  readonly onClose: () => void;
}) {
  const { t } = useTranslation('chat');

  if (phase === 'running') {
    return (
      <div className="flex justify-end pt-2">
        <button
          type="button"
          data-testid="agent-install-stop"
          onClick={onStop}
          className="rounded-full bg-field px-4 py-1.5 text-xs text-ink hover:bg-field-hover cursor-pointer"
        >
          {t('installStop')}
        </button>
      </div>
    );
  }

  return (
    <div className="flex justify-end gap-2 pt-2">
      <button
        type="button"
        data-testid="agent-install-cancel"
        onClick={onClose}
        className="rounded-full bg-field px-4 py-1.5 text-xs text-ink hover:bg-field-hover cursor-pointer"
      >
        {phase === 'failed' ? t('close') : t('cancel')}
      </button>
      {phase === 'confirming' && (
        <button
          type="button"
          data-testid="agent-install-confirm"
          onClick={onConfirm}
          className="rounded-full bg-primary px-4 py-1.5 text-xs font-medium text-white hover:bg-primary-hover cursor-pointer"
        >
          {t('installConfirm')}
        </button>
      )}
    </div>
  );
}

export function AgentInstallDialog({
  phase,
  agent,
  lines,
  failure,
  onConfirm,
  onStop,
  onClose,
}: AgentInstallDialogProps) {
  const { t } = useTranslation('chat');
  if (phase === 'idle' || agent === undefined) return undefined;

  const agentName = AgentNameLabel(agent.id);
  const command = (agent.installCommand ?? []).join(' ');

  return (
    <Dialog
      open
      title={t('installAgentTitle', { name: agentName })}
      closeLabel={t('close')}
      onClose={onClose}
    >
      <div data-testid="agent-install-dialog" className="flex flex-col gap-3 p-1">
        {phase === 'confirming' && (
          <InstallCommandPreview command={command} docsUrl={agent.docsUrl} />
        )}
        {(phase === 'running' || (phase === 'failed' && lines.length > 0)) && (
          <InstallLogsView lines={lines} />
        )}
        {phase === 'failed' && failure !== undefined && <InstallFailureView failure={failure} />}
        <InstallDialogActions
          phase={phase}
          onConfirm={onConfirm}
          onStop={onStop}
          onClose={onClose}
        />
      </div>
    </Dialog>
  );
}
