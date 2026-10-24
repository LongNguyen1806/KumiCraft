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

/**
 * State `none`: no project is open. The Project button opens the project picker/creator (R-PJ-20).
 */
export function NoProjectScreen({ version, suggestedPath, onProjectOpened }: NoProjectScreenProps) {
  const { t } = useTranslation();
  const [dialogOpen, setDialogOpen] = useState(false);

  return (
    <div className="flex h-full flex-col gap-2.5 overflow-auto px-3.5 py-3">
      <TopBar
        version={version}
        onOpenProject={() => {
          setDialogOpen(true);
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
        <button
          type="button"
          onClick={() => {
            setDialogOpen(true);
          }}
          className="justify-self-start rounded-full bg-primary px-6 py-2.5 font-medium text-white hover:bg-primary-hover shadow-sm"
          data-testid="no-project-open-btn"
        >
          {t('project.button')}
        </button>
        <RecentProjects onOpened={() => onProjectOpened?.()} />
      </main>

      <ProjectDialog
        open={dialogOpen}
        initialPath={suggestedPath}
        onClose={() => {
          setDialogOpen(false);
        }}
        onProjectOpened={() => {
          setDialogOpen(false);
          onProjectOpened?.();
        }}
      />
    </div>
  );
}
