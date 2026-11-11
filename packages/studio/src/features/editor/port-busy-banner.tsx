// The project's own port was busy, so the Canvas runs on another one and a backend that only
// allows the project's port may refuse its requests (SPEC-04 R-RN-04, R-RN-27).
import { useTranslation } from 'react-i18next';

import { useRunnerStatus } from './use-runner-status.ts';

export function PortBusyBanner() {
  const { t } = useTranslation();
  const { status, restart } = useRunnerStatus();
  if (status.state !== 'ready' || status.busyPort === undefined) return undefined;

  return (
    <div
      role="status"
      data-testid="canvas-port-busy"
      className="flex items-center justify-between gap-3 border-b border-sun bg-sun-soft px-4 py-2 text-xs text-ink backdrop-blur-md"
    >
      <span>{t('canvas.portBusy.message', { port: status.busyPort })}</span>
      <button
        type="button"
        onClick={restart}
        data-testid="canvas-port-busy-restart"
        className="shrink-0 rounded border border-border bg-card px-2 py-0.5 hover:bg-field-hover"
      >
        {t('canvas.portBusy.restart')}
      </button>
    </div>
  );
}
