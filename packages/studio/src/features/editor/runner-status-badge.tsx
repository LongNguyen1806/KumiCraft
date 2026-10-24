// Dev server runner status badge displayed in editor toolbar (SPEC-04 M-RN, R-PJ-24).
import type { RunnerStatus } from '@kumicraft/shared';
import { useTranslation } from 'react-i18next';

import { useRunnerStatus } from './use-runner-status.ts';

function dotColor(state: RunnerStatus['state']): string {
  switch (state) {
    case 'ready':
      return 'bg-emerald-500';
    case 'starting':
      return 'bg-amber-500';
    case 'error':
    case 'crashed':
      return 'bg-rose-500';
    case 'stopped':
    default:
      return 'bg-slate-400';
  }
}

export function RunnerStatusBadge() {
  const { t } = useTranslation();
  const { status } = useRunnerStatus();

  return (
    <span
      data-testid="runner-status-badge"
      data-state={status.state}
      className="inline-flex items-center gap-1.5 text-xs text-ink-faint"
    >
      <span className={`inline-block size-2 shrink-0 rounded-full ${dotColor(status.state)}`} />
      <span>{t(`editor.runnerState.${status.state}`)}</span>
    </span>
  );
}
