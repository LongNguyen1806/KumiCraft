import type { FileTreeEntry } from '@kumicraft/shared';
import { FilePlus, FolderPlus, Loader2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { useFilesStore } from './files-store.ts';
import { FilesTreeRow, InlineCreateRow } from './files-tree-row.tsx';

export function PanelTopActions({
  onNewFile,
  onNewFolder,
}: {
  readonly onNewFile: () => void;
  readonly onNewFolder: () => void;
}) {
  const { t } = useTranslation();
  return (
    <div className="flex items-center justify-between border-b border-border/40 px-2 py-1.5 text-ink-muted shrink-0">
      <span className="font-medium text-[11px] uppercase tracking-wider">
        {t('activity.files')}
      </span>
      <div className="flex items-center gap-0.5">
        <button
          type="button"
          data-testid="files-top-new-file"
          title={t('files.newFile')}
          aria-label={t('files.newFile')}
          onClick={onNewFile}
          className="rounded p-1 text-ink-muted hover:bg-hover hover:text-ink transition-colors cursor-pointer"
        >
          <FilePlus className="size-3.5" />
        </button>
        <button
          type="button"
          data-testid="files-top-new-folder"
          title={t('files.newFolder')}
          aria-label={t('files.newFolder')}
          onClick={onNewFolder}
          className="rounded p-1 text-ink-muted hover:bg-hover hover:text-ink transition-colors cursor-pointer"
        >
          <FolderPlus className="size-3.5" />
        </button>
      </div>
    </div>
  );
}

function useTreeItemFlags(
  entry: FileTreeEntry,
  designFile?: string,
  buildErrorFile?: string,
  aiFiles?: ReadonlySet<string>,
) {
  const isDesignSelected = designFile === entry.path;
  const hasBuildError = entry.kind === 'file' && buildErrorFile === entry.path;
  const hasParentBuildError =
    entry.kind === 'directory' &&
    Boolean(buildErrorFile && buildErrorFile.startsWith(`${entry.path}/`));
  const isAiModified = Boolean(aiFiles?.has(entry.path));
  return { isDesignSelected, hasBuildError, hasParentBuildError, isAiModified };
}

export type TreeItemRowProps = {
  readonly entry: FileTreeEntry;
  readonly level: number;
  readonly designFile?: string | undefined;
  readonly buildErrorFile?: string | undefined;
  readonly aiFiles: ReadonlySet<string>;
  readonly onFileClick: (entry: FileTreeEntry) => void;
  readonly onOpenMenu: (entry: FileTreeEntry, buttonEl: HTMLElement) => void;
  readonly onContextMenu: (entry: FileTreeEntry, e: React.MouseEvent) => void;
  readonly onCommitRename: (path: string, newName: string) => Promise<void>;
};

function useTreeItemActions(
  entry: FileTreeEntry,
  onFileClick: (entry: FileTreeEntry) => void,
  onCommitRename: (path: string, newName: string) => Promise<void>,
) {
  const { toggleDir, setSelectedPath, setInlineAction } = useFilesStore();
  const handleToggle = () => {
    setSelectedPath(entry.path);
    void toggleDir(entry.path);
  };
  const handleClick = () => {
    setSelectedPath(entry.path);
    onFileClick(entry);
  };
  const handleCommit = async (newName: string) => {
    await onCommitRename(entry.path, newName);
  };
  const handleCancel = () => {
    setInlineAction(undefined);
  };
  return { handleToggle, handleClick, handleCommit, handleCancel };
}

export function TreeItemRow({
  entry,
  level,
  designFile,
  buildErrorFile,
  aiFiles,
  onFileClick,
  onOpenMenu,
  onContextMenu,
  onCommitRename,
}: TreeItemRowProps) {
  const { expandedDirs, loadingDirs, selectedPath, inlineAction } = useFilesStore();
  const flags = useTreeItemFlags(entry, designFile, buildErrorFile, aiFiles);
  const actions = useTreeItemActions(entry, onFileClick, onCommitRename);

  const isSelected = selectedPath === entry.path;
  const isLoading = loadingDirs.has(entry.path);
  const isRenaming = inlineAction?.kind === 'rename' && inlineAction.path === entry.path;

  return (
    <FilesTreeRow
      entry={entry}
      level={level}
      isExpanded={expandedDirs.has(entry.path)}
      isSelected={isSelected}
      isDesignSelected={flags.isDesignSelected}
      hasBuildError={flags.hasBuildError}
      hasParentBuildError={flags.hasParentBuildError}
      isAiModified={flags.isAiModified}
      isLoading={isLoading}
      isRenaming={isRenaming}
      onToggle={actions.handleToggle}
      onClick={actions.handleClick}
      onContextMenu={(e) => {
        onContextMenu(entry, e);
      }}
      onOpenMenu={(buttonEl) => {
        onOpenMenu(entry, buttonEl);
      }}
      onCommitRename={actions.handleCommit}
      onCancelRename={actions.handleCancel}
    />
  );
}

export type FilesTreeListProps = {
  readonly items: readonly { readonly entry: FileTreeEntry; readonly level: number }[];
  readonly loadingRoot: boolean;
  readonly inlineAction?:
    | {
        readonly kind: 'newFile' | 'newFolder' | 'rename';
        readonly dir?: string;
        readonly path?: string;
        readonly oldName?: string;
      }
    | undefined;
  readonly designFile?: string | undefined;
  readonly buildErrorFile?: string | undefined;
  readonly aiFiles: ReadonlySet<string>;
  readonly onFileClick: (entry: FileTreeEntry) => void;
  readonly onOpenMenu: (entry: FileTreeEntry, buttonEl: HTMLElement) => void;
  readonly onContextMenu: (entry: FileTreeEntry, e: React.MouseEvent) => void;
  readonly onCommitRename: (path: string, newName: string) => Promise<void>;
  readonly onCommitCreate: (name: string) => Promise<void>;
  readonly onCancelAction: () => void;
};

/** One tree row plus the inline create input when a new item goes inside this folder. */
function TreeListEntry(
  props: FilesTreeListProps & { readonly entry: FileTreeEntry; readonly level: number },
) {
  const { entry, inlineAction } = props;
  const rowCreateAction =
    inlineAction && inlineAction.kind !== 'rename' && inlineAction.dir === entry.path
      ? { kind: inlineAction.kind, dir: entry.path }
      : undefined;
  return (
    <div>
      <TreeItemRow
        entry={entry}
        level={props.level}
        designFile={props.designFile}
        buildErrorFile={props.buildErrorFile}
        aiFiles={props.aiFiles}
        onFileClick={props.onFileClick}
        onOpenMenu={props.onOpenMenu}
        onContextMenu={props.onContextMenu}
        onCommitRename={props.onCommitRename}
      />
      {rowCreateAction && (
        <InlineCreateRow
          action={rowCreateAction}
          onCommit={props.onCommitCreate}
          onCancel={props.onCancelAction}
        />
      )}
    </div>
  );
}

export function FilesTreeList(props: FilesTreeListProps) {
  const { t } = useTranslation();
  const { items, loadingRoot, inlineAction, onCommitCreate, onCancelAction } = props;
  const rootCreateAction =
    inlineAction && inlineAction.kind !== 'rename' && inlineAction.dir === ''
      ? { kind: inlineAction.kind, dir: '' }
      : undefined;

  return (
    <div className="flex flex-col flex-1 min-h-0 overflow-y-auto overflow-x-hidden pt-1">
      {rootCreateAction && (
        <InlineCreateRow
          action={rootCreateAction}
          onCommit={onCommitCreate}
          onCancel={onCancelAction}
        />
      )}
      {items.length === 0 && loadingRoot && (
        <div className="flex items-center gap-2 p-3 text-ink-faint">
          <Loader2 className="size-3.5 animate-spin" />
          <span>{t('files.loading')}</span>
        </div>
      )}
      {items.map(({ entry, level }) => (
        <TreeListEntry key={entry.path} {...props} entry={entry} level={level} />
      ))}
    </div>
  );
}
