import { useTranslation } from 'react-i18next';

import { TopBar } from '../features/shell/top-bar.tsx';

type NoProjectScreenProps = {
  readonly version: string;
  /** Folder given to the CLI (R-PJ-18). */
  readonly suggestedPath?: string;
};

/**
 * State `none`: no project is open. The Project button that opens or creates one comes with M-PJ
 * (WP-1.03); until then ReactCraft opens the folder it was started in.
 */
export function NoProjectScreen({ version, suggestedPath }: NoProjectScreenProps) {
  const { t } = useTranslation();
  return (
    <div className="flex h-full flex-col gap-2.5 overflow-auto px-3.5 py-3">
      <TopBar version={version} />
      <main className="mx-auto grid w-full max-w-2xl flex-1 content-center gap-4 px-6 py-8">
        <h1 className="text-5xl font-light tracking-tight text-balance">{t('noProject.title')}</h1>
        <p className="max-w-lg text-base text-ink-soft">{t('noProject.body')}</p>
        {suggestedPath !== undefined && (
          <p className="grid justify-self-start rounded-2xl bg-card px-4 py-2.5 shadow-soft">
            <span className="text-xs text-ink-faint">{t('noProject.folder')}</span>
            <span className="font-mono text-xs break-all" data-testid="project-folder">
              {suggestedPath}
            </span>
          </p>
        )}
      </main>
    </div>
  );
}
