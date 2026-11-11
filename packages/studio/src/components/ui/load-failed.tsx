// A list that could not be read: says so, with Try again, instead of showing it as empty.
import { useTranslation } from 'react-i18next';

export function LoadFailed({
  testId,
  message,
  onRetry,
}: {
  readonly testId: string;
  readonly message: string;
  readonly onRetry: () => void;
}) {
  const { t } = useTranslation();
  return (
    <div role="alert" data-testid={testId} className="flex flex-col items-center gap-3 py-6">
      <p className="text-center text-xs text-danger">{message}</p>
      <button
        type="button"
        onClick={onRetry}
        className="h-7 rounded-md border border-line bg-card-solid px-2.5 text-xs font-medium text-ink hover:bg-field"
      >
        {t('errorBoundary.retry')}
      </button>
    </div>
  );
}
