import { useTranslation } from 'react-i18next';

/** Shown while the server is unreachable; the screen behind it is inert, so nothing is edited. */
export function ConnectionOverlay() {
  const { t } = useTranslation();
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-wash-cool/60 px-4 backdrop-blur-sm">
      <div
        role="status"
        aria-live="polite"
        className="grid max-w-sm gap-2 rounded-panel bg-card-solid p-7 shadow-soft"
        data-testid="connection-lost"
      >
        <div className="flex items-center gap-2.5">
          <span className="size-2.5 animate-pulse rounded-full bg-sun" />
          <h2 className="text-lg font-normal">{t('session.lost.title')}</h2>
        </div>
        <p className="text-ink-soft">{t('session.lost.body')}</p>
      </div>
    </div>
  );
}
