import type { BackendInfo, PackageManager, ProjectInfo, ProjectProbe } from '@reactcraft/shared';
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
import { DirectoryBrowser } from './directory-browser.tsx';
import { ProjectProbeResultView } from './project-dialog-probe-view.tsx';

function ProjectDialogTabs({
  currentProject,
  activeTab,
  setActiveTab,
}: {
  readonly currentProject?: ProjectInfo | undefined;
  readonly activeTab: 'project' | 'backends';
  readonly setActiveTab: (tab: 'project' | 'backends') => void;
}) {
  const { t } = useTranslation();
  if (currentProject === undefined) return undefined;
  return (
    <div className="flex border-b border-border">
      <button
        type="button"
        onClick={() => {
          setActiveTab('project');
        }}
        className={`px-4 py-2 font-medium border-b-2 -mb-px ${
          activeTab === 'project'
            ? 'border-primary text-primary'
            : 'border-transparent text-ink-faint hover:text-ink'
        }`}
      >
        {t('project.button')}
      </button>
      <button
        type="button"
        onClick={() => {
          setActiveTab('backends');
        }}
        className={`px-4 py-2 font-medium border-b-2 -mb-px ${
          activeTab === 'backends'
            ? 'border-primary text-primary'
            : 'border-transparent text-ink-faint hover:text-ink'
        }`}
      >
        {t('project.backends.title')}
      </button>
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

function useProjectDialogState(
  initialPath: string,
  currentProject: ProjectInfo | undefined,
  onClose: () => void,
  onProjectOpened: (info: ProjectInfo) => void,
) {
  const [selectedPath, setSelectedPath] = useState(initialPath);
  const [busy, setBusy] = useState(false);
  const backendsState = useProjectBackendsState(currentProject);
  const probeState = useProjectProbe(selectedPath);

  const handleOpen = async () => {
    setBusy(true);
    probeState.setErrorMsg(undefined);
    try {
      const info = await openProject(selectedPath);
      onProjectOpened(info);
      onClose();
    } catch (err) {
      probeState.reportError(err);
    } finally {
      setBusy(false);
    }
  };

  const handleCreate = async (createName: string, createPm: PackageManager) => {
    setBusy(true);
    probeState.setErrorMsg(undefined);
    try {
      const info = await createProject(selectedPath, createName, createPm);
      onProjectOpened(info);
      onClose();
    } catch (err) {
      probeState.reportError(err);
    } finally {
      setBusy(false);
    }
  };

  return {
    selectedPath,
    setSelectedPath,
    busy,
    backends: backendsState.backends,
    probe: probeState.probe,
    probing: probeState.probing,
    errorMsg: probeState.errorMsg,
    handleOpen,
    handleCreate,
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
};

export function ProjectDialog({
  open,
  initialPath = '',
  currentProject,
  onClose,
  onProjectOpened,
}: ProjectDialogProps) {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<'project' | 'backends'>('project');
  const s = useProjectDialogState(initialPath, currentProject, onClose, onProjectOpened);

  return (
    <Dialog open={open} title={t('project.openDialog')} closeLabel="✕" onClose={onClose}>
      <div className="flex flex-col gap-4 text-xs text-ink" data-testid="project-dialog">
        <ProjectDialogTabs
          currentProject={currentProject}
          activeTab={activeTab}
          setActiveTab={setActiveTab}
        />

        {activeTab === 'backends' ? (
          <BackendsView
            backends={s.backends}
            onAddBackend={s.handleAddBackend}
            onRemoveBackend={s.handleRemoveBackend}
          />
        ) : (
          <div className="flex flex-col gap-4">
            <DirectoryBrowser currentPath={s.selectedPath} onSelectPath={s.setSelectedPath} />
            <ProjectProbeResultView
              probe={s.probe}
              probing={s.probing}
              busy={s.busy}
              errorMsg={s.errorMsg}
              onOpen={() => {
                void s.handleOpen();
              }}
              onCreate={(name, pm) => {
                void s.handleCreate(name, pm);
              }}
            />
          </div>
        )}
      </div>
    </Dialog>
  );
}
