// Error boundaries (spec-log #116): a panel that fails to draw shows a short notice with Try again
// instead of blanking the whole Studio; the rest of the Studio keeps working.
import { TriangleAlert } from 'lucide-react';
import { Component, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

type Scope = 'panel' | 'screen';

type BoundaryProps = {
  /** `panel`: one part of the Editor; `screen`: everything (last line of defence). */
  readonly scope: Scope;
  readonly children: ReactNode;
};

type BoundaryState = { readonly error?: Error | undefined };

function Fallback({
  scope,
  error,
  onRetry,
}: {
  readonly scope: Scope;
  readonly error: Error;
  readonly onRetry: () => void;
}) {
  const { t } = useTranslation();
  const firstLine = error.message.split('\n')[0] ?? '';
  return (
    <div
      role="alert"
      data-testid={`error-boundary-${scope}`}
      className={`grid content-start gap-2 text-xs text-ink ${scope === 'screen' ? 'mx-auto max-w-md p-10' : 'p-1'}`}
    >
      <p className="flex items-center gap-2 font-semibold">
        <TriangleAlert className="size-4 shrink-0 text-warn" aria-hidden />
        {scope === 'screen' ? t('errorBoundary.screenTitle') : t('errorBoundary.panelTitle')}
      </p>
      <p className="text-ink-soft">{t('errorBoundary.body')}</p>
      {firstLine !== '' && (
        <pre className="overflow-x-auto rounded-md bg-field p-2 font-mono text-[11px] whitespace-pre-wrap text-ink-soft">
          {firstLine}
        </pre>
      )}
      <div className="flex gap-1.5">
        <button
          type="button"
          data-testid="error-boundary-retry"
          onClick={onRetry}
          className="h-7 rounded-md bg-charcoal px-3 font-medium text-on-charcoal hover:bg-primary-hover"
        >
          {t('errorBoundary.retry')}
        </button>
        <button
          type="button"
          onClick={() => {
            window.location.reload();
          }}
          className="h-7 rounded-md border border-line bg-card-solid px-3 text-ink hover:bg-field"
        >
          {t('errorBoundary.reload')}
        </button>
      </div>
    </div>
  );
}

/** Catches an error thrown while drawing its children; React itself logs it to the console. */
export class ErrorBoundary extends Component<BoundaryProps, BoundaryState> {
  override state: BoundaryState = {};

  static getDerivedStateFromError(error: unknown): BoundaryState {
    return { error: error instanceof Error ? error : new Error(String(error)) };
  }

  override render(): ReactNode {
    const { error } = this.state;
    if (error === undefined) return this.props.children;
    return (
      <Fallback
        scope={this.props.scope}
        error={error}
        onRetry={() => {
          this.setState({ error: undefined });
        }}
      />
    );
  }
}
