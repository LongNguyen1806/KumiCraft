import { useTranslation } from 'react-i18next';

import { LanguageSwitcher } from '../app/language-switcher.tsx';
import { type ErrorInfo, errorText } from './error-text.ts';

/** The Studio could not read its session: no token, a wrong token or no server (S-07). */
export function SessionErrorScreen({
  code,
  errorInfo,
}: {
  readonly code?: string;
  readonly errorInfo?: ErrorInfo;
}) {
  const { t } = useTranslation();
  const { t: tError } = useTranslation('errors');
  const info = errorInfo ?? (code !== undefined ? { code } : { code: 'network' });
  return (
    <main className="grid h-full place-items-center px-4">
      <div className="grid max-w-md gap-4 rounded-panel bg-card p-8 shadow-soft">
        <h1 className="text-3xl font-light tracking-tight">{t('app.name')}</h1>
        <p role="alert" data-testid="session-error" className="text-danger">
          {errorText(tError, info.code, info.params)}
        </p>
        <LanguageSwitcher />
      </div>
    </main>
  );
}
