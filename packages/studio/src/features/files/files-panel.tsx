import { type FileTreeEntry, parseLocString } from '@kumicraft/shared';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { openInEditor } from '../../api/editor-client.ts';
import { createEventsClient } from '../../api/events-client.ts';
import { createProjectFile, deleteProjectFile, renameProjectFile } from '../../api/files-client.ts';
import { isRecord } from '../../api/http.ts';
import { deleteProjectPage } from '../../api/project-client.ts';
import { useBuildCheckStore } from '../build-check/build-check-store.ts';
import { useCanvasErrorStore } from '../canvas-errors/canvas-error-store.ts';
import { type ChatTurnView, useChatStore } from '../chat/chat-store.ts';
import { useDesignStore } from '../design/design-store.ts';
import { usePagesData } from '../editor/page-select.tsx';
import { useProjectInfo } from '../project/project-store.ts';
import { studioBridgeChannel } from '../selection/bridge-channel.ts';
import { useSelectionStore } from '../selection/selection-store.ts';
import { FilesDialogsSection } from './files-delete-dialog.tsx';
import { FilesActionError } from './files-design-menu.tsx';
import { flattenDirectory, useFilesStore } from './files-store.ts';
import { FilesTreeList, PanelTopActions } from './files-tree-list.tsx';

function selectLatestAiFiles(turns: readonly ChatTurnView[]): ReadonlySet<string> {
  for (let i = turns.length - 1; i >= 0; i -= 1) {
    const files = turns[i]?.summary?.files;
    if (files && files.length > 0) return new Set(files.map((f) => f.path));
  }
  return new Set<string>();
}

type MenuState = {
  readonly open: boolean;
  readonly x: number;
  readonly y: number;
  readonly entry?: FileTreeEntry | undefined;
};

function resolveParentDir(path: string): string {
  const idx = path.lastIndexOf('/');
  return idx === -1 ? '' : path.slice(0, idx);
}

function useFileClickHandler(pagesData: ReturnType<typeof usePagesData>) {
  return useCallback(
    (entry: FileTreeEntry) => {
      const matchedPage = pagesData.pages.find((p) => p.file === entry.path);
      if (matchedPage !== undefined) {
        studioBridgeChannel.navigate(matchedPage.path);
        return;
      }
      if (/\.(jsx|tsx)$/i.test(entry.name)) {
        const dot = entry.name.lastIndexOf('.');
        const componentName = dot === -1 ? entry.name : entry.name.slice(0, dot);
        useDesignStore.getState().enterComponentMode({ componentName, filePath: entry.path });
        return;
      }
      void openInEditor(`${entry.path}:1:1`);
    },
    [pagesData.pages],
  );
}

function useFileTreeWatcher() {
  const refreshAffected = useFilesStore((s) => s.refreshAffected);
  useEffect(() => {
    const client = createEventsClient({
      onEvent: (event) => {
        if (event.type === 'project.filesChanged' && isRecord(event.payload)) {
          const files = event.payload['files'];
          if (Array.isArray(files)) {
            const stringFiles = files.filter((f): f is string => typeof f === 'string');
            void refreshAffected(stringFiles);
          }
        }
      },
    });
    return () => {
      client.close();
    };
  }, [refreshAffected]);
}

function useCanvasSelectionSync() {
  const selectedRefs = useSelectionStore((s) => s.selectedRefs);
  const expandParents = useFilesStore((s) => s.expandParents);
  const setSelectedPath = useFilesStore((s) => s.setSelectedPath);

  const selectedLoc = selectedRefs[0]?.loc;
  useEffect(() => {
    if (!selectedLoc) return;
    const parsed = parseLocString(selectedLoc);
    if (parsed?.file) {
      void expandParents(parsed.file);
      setSelectedPath(parsed.file);
    }
  }, [selectedLoc, expandParents, setSelectedPath]);
}

function usePanelCommitActions(refreshAffected: (paths: readonly string[]) => Promise<void>) {
  const inlineAction = useFilesStore((s) => s.inlineAction);
  const setInlineAction = useFilesStore((s) => s.setInlineAction);

  const handleCommitCreate = async (name: string) => {
    if (!inlineAction || inlineAction.kind === 'rename') return;
    const path = inlineAction.dir ? `${inlineAction.dir}/${name}` : name;
    await createProjectFile({
      path,
      kind: inlineAction.kind === 'newFile' ? 'file' : 'directory',
    });
    setInlineAction(undefined);
    await refreshAffected([path]);
  };

  const handleCommitRename = async (from: string, newName: string) => {
    const parent = resolveParentDir(from);
    const to = parent ? `${parent}/${newName}` : newName;
    await renameProjectFile({ from, to });
    setInlineAction(undefined);
    await refreshAffected([from, to]);
  };

  return { handleCommitCreate, handleCommitRename };
}

function usePanelPageActions(
  pagesData: ReturnType<typeof usePagesData>,
  setDeleteTarget: (entry: FileTreeEntry | undefined) => void,
  setRenamingPage: (page: (typeof pagesData.pages)[number] | undefined) => void,
) {
  const { t } = useTranslation();
  const setInlineAction = useFilesStore((s) => s.setInlineAction);
  const refreshAffected = useFilesStore((s) => s.refreshAffected);

  const handleDeleteRequest = (entry: FileTreeEntry) => {
    const page = pagesData.pages.find((p) => p.file === entry.path);
    if (page !== undefined) {
      if (window.confirm(t('pages.deleteConfirm', { path: page.path }))) {
        const run = async () => {
          await deleteProjectPage({ path: page.path });
          await refreshAffected([entry.path]);
        };
        void run();
      }
      return;
    }
    setDeleteTarget(entry);
  };

  const handleStartRename = (entry: FileTreeEntry) => {
    const page = pagesData.pages.find((p) => p.file === entry.path);
    if (page !== undefined) {
      setRenamingPage(page);
      return;
    }
    setInlineAction({ kind: 'rename', path: entry.path, oldName: entry.name });
  };

  return { handleDeleteRequest, handleStartRename };
}

function useFilesPanelState(pagesData: ReturnType<typeof usePagesData>) {
  const { t } = useTranslation();
  const projectInfo = useProjectInfo();
  const {
    treeData,
    expandedDirs,
    loadingDirs,
    inlineAction,
    setProjectId,
    loadDir,
    setInlineAction,
    refreshAffected,
  } = useFilesStore();
  const [menu, setMenu] = useState<MenuState>({ open: false, x: 0, y: 0 });
  const [deleteTarget, setDeleteTarget] = useState<FileTreeEntry | undefined>();
  const [renamingPage, setRenamingPage] = useState<(typeof pagesData.pages)[number] | undefined>();

  useEffect(() => {
    setProjectId(projectInfo?.id);
    void loadDir('');
  }, [projectInfo?.id, setProjectId, loadDir]);

  useFileTreeWatcher();
  useCanvasSelectionSync();
  const { handleCommitCreate, handleCommitRename } = usePanelCommitActions(refreshAffected);
  const { handleDeleteRequest, handleStartRename } = usePanelPageActions(
    pagesData,
    setDeleteTarget,
    setRenamingPage,
  );

  return {
    t,
    treeData,
    expandedDirs,
    loadingDirs,
    inlineAction,
    setInlineAction,
    menu,
    setMenu,
    deleteTarget,
    setDeleteTarget,
    renamingPage,
    setRenamingPage,
    handleCommitCreate,
    handleCommitRename,
    handleDeleteRequest,
    handleStartRename,
    refreshAffected,
  };
}

type PanelDialogsProps = {
  readonly s: ReturnType<typeof useFilesPanelState>;
  readonly pagesData: ReturnType<typeof usePagesData>;
};

function FilesPanelDialogs({ s, pagesData }: PanelDialogsProps) {
  const deleteTargetDir = s.deleteTarget?.kind === 'directory' ? s.deleteTarget.path : undefined;
  const routerPageCount =
    deleteTargetDir !== undefined
      ? pagesData.pages.filter(
          (p) => p.file !== undefined && p.file.startsWith(`${deleteTargetDir}/`),
        ).length
      : 0;

  return (
    <FilesDialogsSection
      menu={s.menu}
      deleteTarget={s.deleteTarget}
      renamingPage={s.renamingPage}
      convention={pagesData.convention}
      routerPageCount={routerPageCount}
      onCloseMenu={() => {
        s.setMenu((m) => ({ ...m, open: false }));
      }}
      onStartRename={s.handleStartRename}
      onDeleteRequest={s.handleDeleteRequest}
      onCloseDelete={() => {
        s.setDeleteTarget(undefined);
      }}
      onConfirmDelete={async (path) => {
        await deleteProjectFile({ path });
        await s.refreshAffected([path]);
      }}
      onCloseRenamePage={() => {
        s.setRenamingPage(undefined);
      }}
      onPageRenamed={(file) => {
        s.setRenamingPage(undefined);
        if (file !== undefined) void s.refreshAffected([file]);
      }}
    />
  );
}

/** Files with a build error: the Canvas build error and the last build check (M-BC). */
function useBuildErrorFiles(): ReadonlySet<string> {
  const canvasFile = useCanvasErrorStore((s) => s.buildError?.file);
  const problems = useBuildCheckStore((s) => s.result?.problems);
  const files = new Set<string>();
  if (canvasFile !== undefined) files.add(canvasFile);
  for (const problem of problems ?? []) if (problem.file !== undefined) files.add(problem.file);
  return files;
}

export function FilesPanel() {
  const pagesData = usePagesData();
  const buildErrorFiles = useBuildErrorFiles();
  const turns = useChatStore((s) => s.turns);
  const aiFiles = useMemo(() => selectLatestAiFiles(turns), [turns]);
  const s = useFilesPanelState(pagesData);

  const handleFileClick = useFileClickHandler(pagesData);
  const flatItems = flattenDirectory(s.treeData, s.expandedDirs, '', 0);
  const selectedLoc = useSelectionStore.getState().selectedRefs[0]?.loc;
  const designFile = selectedLoc ? parseLocString(selectedLoc)?.file : undefined;

  return (
    <div
      role="tree"
      aria-label={s.t('activity.files')}
      className="flex flex-col h-full min-h-0 font-sans text-xs select-none"
    >
      <PanelTopActions
        onNewFile={() => {
          s.setInlineAction({ kind: 'newFile', dir: '' });
        }}
        onNewFolder={() => {
          s.setInlineAction({ kind: 'newFolder', dir: '' });
        }}
      />
      <FilesActionError />
      <FilesTreeList
        items={flatItems}
        loadingRoot={s.loadingDirs.has('')}
        inlineAction={s.inlineAction}
        designFile={designFile}
        buildErrorFiles={buildErrorFiles}
        aiFiles={aiFiles}
        onFileClick={handleFileClick}
        onOpenMenu={(targetEntry, buttonEl) => {
          const rect = buttonEl.getBoundingClientRect();
          s.setMenu({ open: true, x: rect.right, y: rect.bottom, entry: targetEntry });
        }}
        onContextMenu={(targetEntry, e) => {
          s.setMenu({ open: true, x: e.clientX, y: e.clientY, entry: targetEntry });
        }}
        onCommitRename={s.handleCommitRename}
        onCommitCreate={s.handleCommitCreate}
        onCancelAction={() => {
          s.setInlineAction(undefined);
        }}
      />
      <FilesPanelDialogs s={s} pagesData={pagesData} />
    </div>
  );
}
