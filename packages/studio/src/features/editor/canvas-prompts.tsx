// Prompt and error views for Canvas (SPEC-04 M-RN, ADR-BE-28).
import type { RunnerStatus } from '@kumicraft/shared';
import { useTranslation } from 'react-i18next';

export function UntrustedPrompt({ onTrust }: { readonly onTrust?: (() => void) | undefined }) {
  const { t } = useTranslation();
  return (
    <div
      className="flex max-w-md flex-col items-center gap-3 text-center"
      data-testid="canvas-untrusted"
    >
      <h3 className="text-base font-semibold text-ink">{t('editor.untrustedTitle')}</h3>
      <p className="text-sm text-ink-soft">{t('editor.untrustedBody')}</p>
      {onTrust && (
        <button
          type="button"
          onClick={onTrust}
          className="mt-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white shadow-soft"
          data-testid="canvas-trust-btn"
        >
          {t('editor.trustButton')}
        </button>
      )}
    </div>
  );
}

export function NeedsInstallPrompt({
  onInstall,
}: {
  readonly onInstall?: (() => void) | undefined;
}) {
  const { t } = useTranslation();
  return (
    <div
      className="flex max-w-md flex-col items-center gap-3 text-center"
      data-testid="canvas-needs-install"
    >
      <h3 className="text-base font-semibold text-ink">{t('editor.needsInstallTitle')}</h3>
      <p className="text-sm text-ink-soft">{t('editor.needsInstallBody')}</p>
      {onInstall && (
        <button
          type="button"
          onClick={onInstall}
          className="mt-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white shadow-soft"
          data-testid="canvas-install-btn"
        >
          {t('editor.installButton')}
        </button>
      )}
    </div>
  );
}

export function StartingView() {
  const { t } = useTranslation();
  return (
    <div className="flex flex-col items-center gap-3" data-testid="canvas-loading">
      <div className="size-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      <p className="text-sm text-ink-soft">{t('editor.startingDevServer')}</p>
    </div>
  );
}

export function StoppedView({ onStart }: { readonly onStart: () => void }) {
  const { t } = useTranslation();
  return (
    <div className="flex flex-col items-center gap-3" data-testid="canvas-stopped">
      <button
        type="button"
        onClick={onStart}
        className="rounded-lg bg-primary px-5 py-2.5 text-sm font-medium text-white shadow-soft transition-transform hover:-translate-y-px"
        data-testid="canvas-run-btn"
      >
        {t('editor.runDevServer')}
      </button>
    </div>
  );
}

export type ErrorViewProps = {
  readonly status: RunnerStatus;
  readonly logTail: readonly string[];
  readonly onRestart: () => void;
};

export function ErrorView({ status, logTail, onRestart }: ErrorViewProps) {
  const { t } = useTranslation();
  const msg =
    typeof status.error?.params?.['message'] === 'string'
      ? status.error.params['message']
      : (status.error?.code ?? 'E025');

  return (
    <div
      className="flex max-w-2xl flex-col gap-3 rounded-lg border border-red-500/20 bg-card/90 p-5 shadow-soft backdrop-blur-md"
      data-testid="canvas-error"
    >
      <div className="flex items-center justify-between gap-4">
        <h3 className="text-sm font-semibold text-danger">{t('editor.devServerError')}</h3>
        <button
          type="button"
          onClick={onRestart}
          className="rounded border border-border bg-field px-3 py-1 text-xs font-medium text-ink hover:bg-field-hover"
          data-testid="canvas-restart-btn"
        >
          {t('editor.restartDevServer')}
        </button>
      </div>
      <p className="font-mono text-xs text-ink">{msg}</p>
      {logTail.length > 0 && (
        <pre className="max-h-48 overflow-auto rounded bg-charcoal/5 p-3 font-mono text-[11px] text-ink-soft">
          {logTail.join('\n')}
        </pre>
      )}
    </div>
  );
}
