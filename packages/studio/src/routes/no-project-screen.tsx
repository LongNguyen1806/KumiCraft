import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { ProjectDialog } from '../features/project/project-dialog.tsx';
import { RecentProjects } from '../features/project/recent-projects.tsx';
import { TopBar } from '../features/shell/top-bar.tsx';

type NoProjectScreenProps = {
  readonly version: string;
  /** Folder given to the CLI (R-PJ-18). */
  readonly suggestedPath?: string;
  readonly onProjectOpened?: () => void;
};

/** The two ways in, as in an IDE start window: a new project or one already on disk. */
function HomeActions({
  onNew,
  onOpen,
}: {
  readonly onNew: () => void;
  readonly onOpen: () => void;
}) {
  const { t } = useTranslation();
  return (
    <div className="flex flex-wrap gap-2">
      <button
        type="button"
        onClick={onNew}
        className="rounded-full bg-primary px-6 py-2.5 font-medium text-white hover:bg-primary-hover shadow-sm"
        data-testid="no-project-new-btn"
      >
        {t('noProject.newProject')}
      </button>
      <button
        type="button"
        onClick={onOpen}
        className="rounded-full bg-card px-6 py-2.5 font-medium text-ink shadow-soft hover:bg-field"
        data-testid="no-project-open-btn"
      >
        {t('noProject.openProject')}
      </button>
    </div>
  );
}

/**
 * State `none`: no project is open. Home offers a new project or opening one (R-PJ-11, R-PJ-20).
 */
export function NoProjectScreen({ version, suggestedPath, onProjectOpened }: NoProjectScreenProps) {
  const { t } = useTranslation();
  // Which dialog is up: a new project or opening one (R-PJ-20).
  const [dialog, setDialog] = useState<'new' | 'open'>();

  return (
    <div className="flex h-full flex-col gap-2.5 overflow-auto px-3.5 py-3">
      <TopBar
        version={version}
        onOpenProject={() => {
          setDialog('open');
        }}
      />
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
        <HomeActions
          onNew={() => {
            setDialog('new');
          }}
          onOpen={() => {
            setDialog('open');
          }}
        />
        <RecentProjects onOpened={() => onProjectOpened?.()} />
      </main>

      <ProjectDialog
        key={dialog ?? 'closed'}
        open={dialog !== undefined}
        mode={dialog}
        initialPath={suggestedPath}
        onClose={() => {
          setDialog(undefined);
        }}
        onProjectOpened={() => {
          setDialog(undefined);
          onProjectOpened?.();
        }}
      />
    </div>
  );
}
