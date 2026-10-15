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
import { BackendsView } from './backends-view.tsx';
import { DirectoryBrowser } from './directory-browser.tsx';

type ProjectDialogProps = {
  readonly open: boolean;
  readonly initialPath?: string | undefined;
  readonly currentProject?: ProjectInfo | undefined;
  readonly onClose: () => void;
  readonly onProjectOpened: (info: ProjectInfo) => void;
};

const PACKAGE_MANAGERS: readonly PackageManager[] = ['pnpm', 'npm', 'yarn'];

export function ProjectDialog({
  open,
  initialPath = '',
  currentProject,
  onClose,
  onProjectOpened,
}: ProjectDialogProps) {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<'project' | 'backends'>('project');
  const [selectedPath, setSelectedPath] = useState(initialPath);
  const [probe, setProbe] = useState<ProjectProbe>();
  const [probing, setProbing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string>();

  // Create form state
  const [createName, setCreateName] = useState('my-app');
  const [createPm, setCreatePm] = useState<PackageManager>('pnpm');

  // Backends local state
  const [backends, setBackends] = useState<readonly BackendInfo[]>(currentProject?.backends ?? []);

  const [prevInitial, setPrevInitial] = useState(initialPath);
  if (initialPath !== prevInitial) {
    setPrevInitial(initialPath);
    if (initialPath) setSelectedPath(initialPath);
  }

  const [prevBackends, setPrevBackends] = useState(currentProject?.backends);
  if (currentProject?.backends !== prevBackends) {
    setPrevBackends(currentProject?.backends);
    if (currentProject?.backends) setBackends(currentProject.backends);
  }

  // Probe when selectedPath changes
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
          setErrorMsg(err instanceof Error ? err.message : 'Failed to probe folder');
        }
      } finally {
        if (active) setProbing(false);
      }
    };
    void runProbe();
    return () => {
      active = false;
    };
  }, [selectedPath]);

  const handleOpen = async () => {
    setBusy(true);
    setErrorMsg(undefined);
    try {
      const info = await openProject(selectedPath);
      onProjectOpened(info);
      onClose();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to open project');
    } finally {
      setBusy(false);
    }
  };

  const handleCreate = async (e: React.SyntheticEvent) => {
    e.preventDefault();
    setBusy(true);
    setErrorMsg(undefined);
    try {
      const info = await createProject(selectedPath, createName, createPm);
      onProjectOpened(info);
      onClose();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to create project');
    } finally {
      setBusy(false);
    }
  };

  const handleAddBackend = async (path: string, label?: string) => {
    const added = await addProjectBackend(path, label);
    setBackends((prev) => [...prev, added]);
  };

  const handleRemoveBackend = async (id: string) => {
    await removeProjectBackend(id);
    setBackends((prev) => prev.filter((b) => b.id !== id));
  };

  return (
    <Dialog open={open} title={t('project.openDialog')} closeLabel="✕" onClose={onClose}>
      <div className="flex flex-col gap-4 text-xs text-ink" data-testid="project-dialog">
        {/* Tab selection */}
        {currentProject !== undefined && (
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
        )}

        {activeTab === 'backends' ? (
          <BackendsView
            backends={backends}
            onAddBackend={handleAddBackend}
            onRemoveBackend={handleRemoveBackend}
          />
        ) : (
          <div className="flex flex-col gap-4">
            {/* Directory picker */}
            <DirectoryBrowser currentPath={selectedPath} onSelectPath={setSelectedPath} />

            {/* Probe Results View */}
            <div className="rounded-lg border border-border bg-card p-4 min-h-[120px] flex flex-col justify-center">
              {probing ? (
                <div className="text-center text-xs text-ink-faint">{t('project.probing')}</div>
              ) : probe?.kind === 'project' ? (
                probe.support.supported ? (
                  <div className="flex flex-col gap-3">
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-emerald-600">{t('project.supported')}</span>
                      <span className="font-mono text-[11px] text-ink-faint">
                        {probe.support.framework} • {probe.support.language.toUpperCase()}
                      </span>
                    </div>
                    {probe.support.tailwindCss && (
                      <span className="text-[11px] text-ink-faint font-mono truncate">
                        {t('project.cssPath', { path: probe.support.tailwindCss })}
                      </span>
                    )}
                    <button
                      type="button"
                      onClick={() => {
                        void handleOpen();
                      }}
                      disabled={busy}
                      className="self-end rounded-full bg-primary px-5 py-2 font-medium text-white hover:bg-primary-hover disabled:opacity-50"
                      data-testid="open-project-btn"
                    >
                      {busy ? t('project.opening') : t('project.open')}
                    </button>
                  </div>
                ) : (
                  <div className="flex flex-col gap-2">
                    <span className="font-medium text-rose-600">{t('project.unsupported')}:</span>
                    <ul className="list-disc pl-4 text-ink-soft space-y-1">
                      {probe.support.reasons.map((reason) => (
                        <li key={reason}>
                          {t(`project.reasons.${reason}`, { defaultValue: reason })}
                        </li>
                      ))}
                    </ul>
                  </div>
                )
              ) : probe?.kind === 'empty' || (probe?.kind === 'missing' && probe.canCreate) ? (
                <form
                  onSubmit={(e) => {
                    void handleCreate(e);
                  }}
                  className="flex flex-col gap-3"
                >
                  <span className="font-medium text-ink">{t('project.create')}</span>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[10px] text-ink-faint block mb-1">
                        {t('project.projectName')}
                      </label>
                      <input
                        type="text"
                        value={createName}
                        onChange={(e) => {
                          setCreateName(e.target.value);
                        }}
                        className="w-full rounded border border-border bg-field px-2.5 py-1.5 text-xs text-ink focus:outline-none"
                        data-testid="create-project-name"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-ink-faint block mb-1">
                        {t('project.packageManager')}
                      </label>
                      <select
                        value={createPm}
                        onChange={(e) => {
                          setCreatePm(e.target.value as PackageManager);
                        }}
                        className="w-full rounded border border-border bg-field px-2.5 py-1.5 text-xs text-ink focus:outline-none"
                        data-testid="create-project-pm"
                      >
                        {PACKAGE_MANAGERS.map((pm) => (
                          <option key={pm} value={pm}>
                            {pm}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <button
                    type="submit"
                    disabled={busy || !createName.trim()}
                    className="self-end rounded-full bg-primary px-5 py-2 font-medium text-white hover:bg-primary-hover disabled:opacity-50"
                    data-testid="create-project-btn"
                  >
                    {busy ? t('project.creating') : t('project.create')}
                  </button>
                </form>
              ) : probe?.kind === 'other' ? (
                <p className="text-center text-ink-soft" data-testid="not-project-msg">
                  {t('project.notProject')}
                </p>
              ) : undefined}

              {errorMsg && <p className="mt-2 text-xs text-rose-600 font-medium">{errorMsg}</p>}
            </div>
          </div>
        )}
      </div>
    </Dialog>
  );
}
