import { useTranslation } from 'react-i18next';

import type { ProjectState } from '../api/session.ts';
import { TopBar } from '../features/shell/top-bar.tsx';
import { errorText } from './error-text.ts';

type ProjectErrorScreenProps = {
  readonly version: string;
  readonly error: Extract<ProjectState, { state: 'error' }>['error'];
};

/**
 * State `error`: `.reactcraft/workspace.json` is broken or from another version (V-105).
 * ReactCraft never rewrites it, so the user fixes it and starts ReactCraft again.
 */
export function ProjectErrorScreen({ version, error }: ProjectErrorScreenProps) {
  const { t } = useTranslation();
  const { t: tError } = useTranslation('errors');
  const reason = typeof error.params?.['reason'] === 'string' ? error.params['reason'] : undefined;
  return (
    <div className="flex h-full flex-col gap-2.5 overflow-auto px-3.5 py-3">
      <TopBar version={version} />
      <main className="mx-auto grid w-full max-w-2xl flex-1 content-center gap-5 px-2 py-8">
        <h1 className="text-4xl font-light tracking-tight">{t('projectError.title')}</h1>
        <p role="alert" className="text-danger" data-testid="project-error">
          {errorText(tError, error.code, error.params)}
        </p>
        {reason === 'unsupportedVersion' && (
          <p className="text-ink-soft">{t('projectError.oldVersion')}</p>
        )}
        <p className="text-ink-soft">{t('projectError.howToFix')}</p>
        {error.details?.map((detail) => (
          <p key={detail.message} className="font-mono text-xs break-all text-ink-faint">
            {detail.message}
          </p>
        ))}
      </main>
    </div>
  );
}
