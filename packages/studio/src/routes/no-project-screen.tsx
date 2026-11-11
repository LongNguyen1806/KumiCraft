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
        className="rounded-md bg-charcoal px-4 h-9 font-medium text-on-charcoal hover:bg-primary-hover"
        data-testid="no-project-new-btn"
      >
        {t('noProject.newProject')}
      </button>
      <button
        type="button"
        onClick={onOpen}
        className="rounded-md border border-line bg-card-solid px-4 h-9 font-medium text-ink hover:bg-field"
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
    <div className="flex h-full flex-col overflow-auto">
      <TopBar
        version={version}
        onOpenProject={() => {
          setDialog('open');
        }}
      />
      <main className="mx-auto grid w-full max-w-[640px] flex-1 content-center gap-4 px-6 py-10">
        <h1 className="text-[28px] font-semibold tracking-tight text-balance">
          {t('noProject.title')}
        </h1>
        <p className="max-w-lg text-sm text-ink-soft">{t('noProject.body')}</p>
        {suggestedPath !== undefined && (
          <p className="grid justify-self-start rounded-lg border border-line bg-card-solid px-3.5 py-2">
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
