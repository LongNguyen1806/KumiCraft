import { useTranslation } from 'react-i18next';

export function LoadingScreen() {
  const { t } = useTranslation();
  return (
    <main className="grid h-full place-items-center px-4">
      <p className="flex items-center gap-2.5 text-ink-soft">
        <span className="size-2 animate-pulse rounded-full bg-sun" />
        {t('session.connecting')}
      </p>
    </main>
  );
}
