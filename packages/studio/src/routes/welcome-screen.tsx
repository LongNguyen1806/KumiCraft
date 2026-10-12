import { useTranslation } from 'react-i18next';

import { TopBar } from '../features/shell/top-bar.tsx';
import { CreateWorkspaceForm } from '../features/welcome/create-workspace-form.tsx';

type WelcomeScreenProps = {
  readonly version: string;
  /** Folder the CLI was started in, where the workspace will be created. */
  readonly directory?: string;
  readonly onCreated: () => void;
};

/** State `none`: the folder has no workspace yet (SPEC-04.1 sections 2.4, 6.1). */
export function WelcomeScreen({ version, directory, onCreated }: WelcomeScreenProps) {
  const { t } = useTranslation();
  return (
    <div className="flex h-full flex-col gap-2.5 overflow-auto px-3.5 py-3">
      <TopBar version={version} />
      <main className="mx-auto grid w-full max-w-6xl flex-1 content-center gap-10 px-6 py-8 lg:grid-cols-[1fr_minmax(0,540px)]">
        <section className="grid content-start gap-4 lg:pt-10">
          <h1 className="text-5xl font-light tracking-tight text-balance">{t('welcome.title')}</h1>
          <p className="max-w-lg text-base text-ink-soft">{t('welcome.subtitle')}</p>
          {directory !== undefined && (
            <p className="grid justify-self-start rounded-2xl bg-card px-4 py-2.5 shadow-soft">
              <span className="text-xs text-ink-faint">{t('welcome.directory')}</span>
              <span className="font-mono text-xs break-all" data-testid="workspace-directory">
                {directory}
              </span>
            </p>
          )}
          <p className="max-w-lg text-ink-faint">{t('welcome.storage')}</p>
        </section>
        <CreateWorkspaceForm onCreated={onCreated} />
      </main>
    </div>
  );
}
