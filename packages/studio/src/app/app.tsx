import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { ApiError } from '../api/http.ts';
import { fetchSession } from '../api/session.ts';
import { isErrorKey } from '../i18n/error-key.ts';
import { LanguageSwitcher } from './language-switcher.tsx';

type SessionState =
  | { readonly status: 'loading' }
  | { readonly status: 'ready'; readonly version: string }
  | { readonly status: 'failed'; readonly code: string };

export function App() {
  const { t } = useTranslation();
  const { t: tError } = useTranslation('errors');
  const [session, setSession] = useState<SessionState>({ status: 'loading' });

  useEffect(() => {
    let isActive = true;
    const load = async () => {
      try {
        const info = await fetchSession();
        if (isActive) setSession({ status: 'ready', version: info.version });
      } catch (error) {
        const code = error instanceof ApiError ? (error.code ?? String(error.status)) : 'network';
        if (isActive) setSession({ status: 'failed', code });
      }
    };
    void load();
    return () => {
      isActive = false;
    };
  }, []);

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-3 bg-neutral-50 px-6 text-center text-neutral-900">
      <h1 className="text-4xl font-semibold tracking-tight">{t('app.name')}</h1>
      {session.status === 'loading' && (
        <p className="text-sm text-neutral-500">{t('session.connecting')}</p>
      )}
      {session.status === 'ready' && (
        <p className="text-sm text-neutral-500" data-testid="studio-version">
          {t('app.version', { version: session.version })}
        </p>
      )}
      {session.status === 'failed' && (
        <p className="max-w-md text-sm text-red-600" role="alert" data-testid="session-error">
          {isErrorKey(session.code)
            ? `${tError(session.code)} (${session.code})`
            : tError('unknown', { code: session.code })}
        </p>
      )}
      <div className="mt-6">
        <LanguageSwitcher />
      </div>
    </main>
  );
}
