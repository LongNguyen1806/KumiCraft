import type { BackendInfo, PackageManager, ProjectInfo, ProjectProbe } from '@kumicraft/shared';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import {
  addProjectBackend,
  createProject,
  openProject,
  probeProject,
  removeProjectBackend,
} from '../../api/project-client.ts';
import { Dialog } from '../../components/ui/dialog.tsx';
import { errorText, toErrorInfo } from '../../routes/error-text.ts';
import { BackendsView } from './backends-view.tsx';
import { DesignDirsForm } from './design-dirs-form.tsx';
import { DevPortForm } from './dev-port-form.tsx';
import { DirectoryBrowser } from './directory-browser.tsx';
import { NewProjectForm } from './new-project-form.tsx';
import { ProjectProbeResultView } from './project-dialog-probe-view.tsx';

type ProjectTab = 'project' | 'backends' | 'settings';

const TABS: readonly {
  readonly id: ProjectTab;
  readonly labelKey: `project.tabs.${ProjectTab}`;
}[] = [
  { id: 'project', labelKey: 'project.tabs.project' },
  { id: 'backends', labelKey: 'project.tabs.backends' },
  { id: 'settings', labelKey: 'project.tabs.settings' },
];

/** With a project open: open another one, its backends, its settings (one subject per tab). */
function ProjectDialogTabs({
  currentProject,
  activeTab,
  setActiveTab,
}: {
  readonly currentProject?: ProjectInfo | undefined;
  readonly activeTab: ProjectTab;
  readonly setActiveTab: (tab: ProjectTab) => void;
}) {
  const { t } = useTranslation();
  if (currentProject === undefined) return undefined;
  return (
    <div role="tablist" className="flex border-b border-border">
      {TABS.map((tab) => (
        <button
          key={tab.id}
          type="button"
          role="tab"
          aria-selected={activeTab === tab.id}
          data-testid={`project-tab-${tab.id}`}
          onClick={() => {
            setActiveTab(tab.id);
          }}
          className={`-mb-px border-b-2 px-4 py-2 font-medium ${
            activeTab === tab.id
              ? 'border-primary text-primary'
              : 'border-transparent text-ink-faint hover:text-ink'
          }`}
        >
          {t(tab.labelKey)}
        </button>
      ))}
    </div>
  );
}

/** A failed request as the user reads it: translated message and reason (V-80). */
function errorMessage(
  tError: ReturnType<typeof useTranslation<'errors'>>['t'],
  err: unknown,
): string {
  const info = toErrorInfo(err);
  return errorText(tError, info.code, info.params);
}

function useProjectProbe(selectedPath: string) {
  const { t: tError } = useTranslation('errors');
  const [probe, setProbe] = useState<ProjectProbe>();
  const [probing, setProbing] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string>();

  useEffect(() => {
    if (!selectedPath) return;
    let active = true;
    const runProbe = async () => {
      setProbing(true);
      setErrorMsg(undefined);
      try {
        const res = await probeProject(selectedPath);
        if (active) setProbe(res);
      } catch (err) {
        if (active) {
          setProbe(undefined);
          setErrorMsg(errorMessage(tError, err));
        }
      } finally {
        if (active) setProbing(false);
      }
    };
    void runProbe();
    return () => {
      active = false;
    };
  }, [selectedPath, tError]);

  const reportError = (err: unknown) => {
    setErrorMsg(errorMessage(tError, err));
  };

  return { probe, probing, errorMsg, setErrorMsg, setProbe, reportError };
}

function useProjectBackendsState(currentProject?: ProjectInfo) {
  const [backends, setBackends] = useState<readonly BackendInfo[]>(currentProject?.backends ?? []);

  const handleAddBackend = async (path: string, label?: string) => {
    const added = await addProjectBackend(path, label);
    setBackends((prev) => [...prev, added]);
  };

  const handleRemoveBackend = async (id: string) => {
    await removeProjectBackend(id);
    setBackends((prev) => prev.filter((b) => b.id !== id));
  };

  return { backends, handleAddBackend, handleRemoveBackend };
}

function useProjectActions(
  selectedPath: string,
  probeState: ReturnType<typeof useProjectProbe>,
  onClose: () => void,
  onProjectOpened: (info: ProjectInfo) => void,
) {
  const [busy, setBusy] = useState(false);

  const runAction = async (action: () => Promise<ProjectInfo>) => {
    setBusy(true);
    probeState.setErrorMsg(undefined);
    try {
      const info = await action();
      onProjectOpened(info);
      onClose();
    } catch (err) {
      probeState.reportError(err);
    } finally {
      setBusy(false);
    }
  };

  const handleOpen = () => runAction(() => openProject(selectedPath));
  const handleCreate = (targetPath: string, createName: string, createPm: PackageManager) =>
    runAction(() => createProject(targetPath, createName, createPm));
  const handleOpenCandidate = (relPath: string) => {
    const base = selectedPath.replaceAll('\\', '/').replace(/\/+$/, '');
    const rel = relPath.replaceAll('\\', '/').replace(/^\/+/, '');
    return runAction(() => openProject(`${base}/${rel}`));
  };

  return { busy, handleOpen, handleCreate, handleOpenCandidate };
}

function useProjectDialogState(
  initialPath: string,
  currentProject: ProjectInfo | undefined,
  onClose: () => void,
  onProjectOpened: (info: ProjectInfo) => void,
) {
  const [selectedPath, setSelectedPath] = useState(initialPath);
  const backendsState = useProjectBackendsState(currentProject);
  const probeState = useProjectProbe(selectedPath);
  const actions = useProjectActions(selectedPath, probeState, onClose, onProjectOpened);

  return {
    selectedPath,
    setSelectedPath,
    ...actions,
    backends: backendsState.backends,
    probe: probeState.probe,
    probing: probeState.probing,
    errorMsg: probeState.errorMsg,
    handleAddBackend: backendsState.handleAddBackend,
    handleRemoveBackend: backendsState.handleRemoveBackend,
  };
}

export type ProjectDialogProps = {
  readonly open: boolean;
  readonly initialPath?: string | undefined;
  readonly currentProject?: ProjectInfo | undefined;
  readonly onClose: () => void;
  readonly onProjectOpened: (info: ProjectInfo) => void;
  /** 'new' opens straight on the new-project form (the Home "New project" button). */
  readonly mode?: DialogMode | undefined;
};

type DialogMode = 'open' | 'new';

/** New project: its own form; the way back to opening one stays one click away. */
function NewProjectContent({
  s,
  onBack,
}: {
  readonly s: ReturnType<typeof useProjectDialogState>;
  readonly onBack: () => void;
}) {
  const { t } = useTranslation();
  return (
    <div className="flex flex-col gap-3">
      <NewProjectForm
        initialPath={s.selectedPath}
        busy={s.busy}
        onCreate={(targetPath, name, pm) => {
          void s.handleCreate(targetPath, name, pm);
        }}
      />
      {s.errorMsg !== undefined && (
        <p role="alert" className="text-xs font-medium text-danger">
          {s.errorMsg}
        </p>
      )}
      <button
        type="button"
        onClick={onBack}
        className="cursor-pointer self-start text-xs text-ink-soft hover:text-ink hover:underline"
        data-testid="open-existing-btn"
      >
        {t('project.openExisting')}
      </button>
    </div>
  );
}

function ProjectSettingsContent({
  currentProject,
}: {
  readonly currentProject?: ProjectInfo | undefined;
}) {
  return (
    <div className="flex flex-col gap-4">
      <DesignDirsForm designDirs={currentProject?.designDirs} />
      <DevPortForm devPort={currentProject?.devPort} />
    </div>
  );
}

function OpenProjectContent({
  s,
  onNewProject,
}: {
  readonly s: ReturnType<typeof useProjectDialogState>;
  readonly onNewProject: () => void;
}) {
  const { t } = useTranslation();
  return (
    <div className="flex flex-col gap-4">
      <button
        type="button"
        onClick={onNewProject}
        className="cursor-pointer self-start rounded-full bg-field px-4 py-1.5 text-xs font-medium text-ink hover:bg-field-hover"
        data-testid="new-project-btn"
      >
        {t('project.newProjectButton')}
      </button>
      <DirectoryBrowser currentPath={s.selectedPath} onSelectPath={s.setSelectedPath} />
      <ProjectProbeResultView
        probe={s.probe}
        location={s.selectedPath}
        probing={s.probing}
        busy={s.busy}
        errorMsg={s.errorMsg}
        onOpen={() => {
          void s.handleOpen();
        }}
        onOpenCandidate={(relPath) => {
          void s.handleOpenCandidate(relPath);
        }}
        onCreate={(targetPath, name, pm) => {
          void s.handleCreate(targetPath, name, pm);
        }}
      />
    </div>
  );
}

function ProjectDialogContent({
  activeTab,
  currentProject,
  s,
  onNewProject,
}: {
  readonly activeTab: ProjectTab;
  readonly currentProject?: ProjectInfo | undefined;
  readonly s: ReturnType<typeof useProjectDialogState>;
  readonly onNewProject: () => void;
}) {
  if (activeTab === 'settings') return <ProjectSettingsContent currentProject={currentProject} />;
  if (activeTab === 'backends') {
    return (
      <BackendsView
        backends={s.backends}
        onAddBackend={s.handleAddBackend}
        onRemoveBackend={s.handleRemoveBackend}
        projectRoot={currentProject?.root}
      />
    );
  }
  return <OpenProjectContent s={s} onNewProject={onNewProject} />;
}

/** With a project open the dialog is also its settings: a title that says so. */
function useDialogTitle(mode: DialogMode, hasProject: boolean): string {
  const { t } = useTranslation();
  if (mode === 'new') return t('project.newDialog');
  return hasProject ? t('project.dialogTitle') : t('project.openDialog');
}

export function ProjectDialog({
  open,
  initialPath = '',
  currentProject,
  onClose,
  onProjectOpened,
  mode: startMode = 'open',
}: ProjectDialogProps) {
  const [activeTab, setActiveTab] = useState<ProjectTab>('project');
  const [mode, setMode] = useState<DialogMode>(startMode);
  const s = useProjectDialogState(initialPath, currentProject, onClose, onProjectOpened);
  const title = useDialogTitle(mode, currentProject !== undefined);

  return (
    <Dialog
      open={open}
      title={title}
      closeLabel="✕"
      onClose={onClose}
      size={currentProject === undefined ? 'normal' : 'wide'}
    >
      <div className="flex flex-col gap-4 text-xs text-ink" data-testid="project-dialog">
        {mode === 'new' ? (
          <NewProjectContent
            s={s}
            onBack={() => {
              setMode('open');
            }}
          />
        ) : (
          <>
            <ProjectDialogTabs
              currentProject={currentProject}
              activeTab={activeTab}
              setActiveTab={setActiveTab}
            />
            <ProjectDialogContent
              activeTab={activeTab}
              currentProject={currentProject}
              s={s}
              onNewProject={() => {
                setMode('new');
              }}
            />
          </>
        )}
      </div>
    </Dialog>
  );
}
