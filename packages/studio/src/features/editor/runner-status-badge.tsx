// Dev server runner status badge displayed in editor toolbar (SPEC-04 M-RN, R-PJ-24).
import type { RunnerStatus } from '@kumicraft/shared';
import { useTranslation } from 'react-i18next';

import { useRunnerStatus } from './use-runner-status.ts';

function dotColor(state: RunnerStatus['state']): string {
  switch (state) {
    case 'ready':
      return 'bg-leaf';
    case 'starting':
      return 'bg-sun';
    case 'error':
    case 'crashed':
      return 'bg-danger';
    case 'stopped':
    default:
      return 'bg-ink-faint';
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
