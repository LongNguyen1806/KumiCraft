import { useTranslation } from 'react-i18next';

import { LanguageSwitcher } from '../app/language-switcher.tsx';
import { errorText } from './error-text.ts';

/** The Studio could not read its session: no token, a wrong token or no server (S-07). */
export function SessionErrorScreen({ code }: { readonly code: string }) {
  const { t } = useTranslation();
  const { t: tError } = useTranslation('errors');
  return (
    <main className="grid h-full place-items-center px-4">
      <div className="grid max-w-md gap-4 rounded-panel bg-card p-8 shadow-soft">
        <h1 className="text-3xl font-light tracking-tight">{t('app.name')}</h1>
        <p role="alert" data-testid="session-error" className="text-danger">
          {errorText(tError, code)}
        </p>
        <LanguageSwitcher />
      </div>
    </main>
  );
}
