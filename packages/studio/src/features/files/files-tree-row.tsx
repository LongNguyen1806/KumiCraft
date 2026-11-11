import type { FileTreeEntry } from '@kumicraft/shared';
import {
  ChevronRight,
  File,
  FileCode,
  FileJson,
  FileText,
  Folder,
  FolderOpen,
  Image as ImageIcon,
  Loader2,
  MoreHorizontal,
} from 'lucide-react';
import { type ReactNode, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { useNameCommit } from './files-inline-create.tsx';

export { InlineCreateRow } from './files-inline-create.tsx';

export type FilesTreeRowProps = {
  readonly entry: FileTreeEntry;
  readonly level: number;
  readonly isExpanded: boolean;
  readonly isSelected: boolean;
  readonly isDesignSelected: boolean;
  readonly hasBuildError: boolean;
  readonly hasParentBuildError: boolean;
  readonly isAiModified: boolean;
  readonly isLoading: boolean;
  readonly isRenaming: boolean;
  readonly onToggle: () => void;
  readonly onClick: () => void;
  readonly onContextMenu: (e: React.MouseEvent) => void;
  readonly onOpenMenu: (buttonEl: HTMLElement) => void;
  readonly onCommitRename: (newName: string) => Promise<void>;
  readonly onCancelRename: () => void;
  readonly rowRef?: ((el: HTMLDivElement | undefined) => void) | undefined;
};

const CODE_EXTS = new Set(['.tsx', '.jsx', '.ts', '.js', '.mjs', '.cjs']);
const STYLE_EXTS = new Set(['.css', '.scss', '.sass', '.less']);
const IMG_EXTS = new Set(['.png', '.jpg', '.jpeg', '.webp', '.gif', '.svg', '.ico']);

function resolveFileIcon(name: string): ReactNode {
  const ext = name.slice(name.lastIndexOf('.')).toLowerCase();
  if (CODE_EXTS.has(ext)) return <FileCode className="size-3.5 shrink-0 text-warn" />;
  if (STYLE_EXTS.has(ext)) return <FileText className="size-3.5 shrink-0 text-accent" />;
  if (ext === '.json') return <FileJson className="size-3.5 shrink-0 text-leaf" />;
  if (IMG_EXTS.has(ext)) return <ImageIcon className="size-3.5 shrink-0 text-purple-600" />;
  return <File className="size-3.5 shrink-0 text-ink-faint" />;
}

function resolveEntryIcon(entry: FileTreeEntry, isExpanded: boolean): ReactNode {
  if (entry.kind !== 'directory') return resolveFileIcon(entry.name);
  const Icon = isExpanded ? FolderOpen : Folder;
  return <Icon className="size-3.5 shrink-0 text-warn" />;
}

function StatusDots({
  hasBuildError,
  hasParentBuildError,
  isAiModified,
}: {
  readonly hasBuildError: boolean;
  readonly hasParentBuildError: boolean;
  readonly isAiModified: boolean;
}) {
  const { t } = useTranslation();
  return (
    <div className="flex items-center gap-1 shrink-0">
      {hasBuildError && (
        <span
          data-testid="build-error-dot"
          title={t('files.buildError')}
          aria-label={t('files.buildError')}
          className="size-2 rounded-full bg-danger"
        />
      )}
      {hasParentBuildError && (
        <span
          data-testid="build-error-folder-dot"
          title={t('files.buildError')}
          aria-label={t('files.buildError')}
          className="size-1.5 rounded-full bg-danger"
        />
      )}
      {isAiModified && (
        <span
          data-testid="ai-modified-dot"
          title={t('files.aiModified')}
          aria-label={t('files.aiModified')}
          className="size-2 rounded-full bg-accent"
        />
      )}
    </div>
  );
}

type InlineRenameInputProps = {
  readonly oldName: string;
  readonly onCommit: (newName: string) => Promise<void>;
  readonly onCancel: () => void;
};

export function InlineRenameInput({ oldName, onCommit, onCancel }: InlineRenameInputProps) {
  const [val, setVal] = useState(oldName);
  const { error, setError, submit } = useNameCommit(onCommit);
  const inputRef = useRef<HTMLInputElement | undefined>(undefined);

  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key !== 'Escape' && e.key !== 'Enter') return;
    e.stopPropagation();
    if (e.key === 'Escape') onCancel();
    else submit(val);
  };

  return (
    <div className="flex flex-col flex-1 min-w-0">
      <input
        ref={(el) => {
          inputRef.current = el ?? undefined;
        }}
        data-testid="files-inline-rename-input"
        type="text"
        value={val}
        onChange={(e) => {
          setVal(e.target.value);
          if (error !== undefined) setError(undefined);
        }}
        onKeyDown={handleKeyDown}
        onBlur={() => {
          if (val.trim() === oldName) onCancel();
        }}
        className="w-full rounded border border-accent bg-card-solid px-1.5 py-0.5 text-xs text-ink"
      />
      {error !== undefined && (
        <span data-testid="files-inline-error" className="text-[10px] text-danger">
          {error}
        </span>
      )}
    </div>
  );
}

function resolveRowClasses(isSelected: boolean, isDesignSelected: boolean, hidden: boolean) {
  const base =
    'group flex min-h-[26px] cursor-pointer items-center gap-1.5 rounded-[5px] py-0.5 pr-1.5 text-xs transition-colors select-none';
  const state = isDesignSelected
    ? 'bg-accent-soft font-semibold text-accent'
    : isSelected
      ? 'bg-accent-soft font-medium text-ink shadow-[inset_2px_0_0_var(--color-accent)]'
      : 'text-ink-soft hover:bg-field hover:text-ink';
  return `${base} ${state}${hidden ? ' opacity-50 text-ink-faint' : ''}`;
}

function DirectoryToggleButton({
  isExpanded,
  isLoading,
  onToggle,
}: {
  readonly isExpanded: boolean;
  readonly isLoading: boolean;
  readonly onToggle: () => void;
}) {
  const { t } = useTranslation();
  return (
    <button
      type="button"
      tabIndex={-1}
      aria-label={isExpanded ? t('files.collapse') : t('files.expand')}
      onClick={(e) => {
        e.stopPropagation();
        onToggle();
      }}
      className="size-4 flex items-center justify-center shrink-0 text-ink-faint hover:text-ink cursor-pointer"
    >
      {isLoading ? (
        <Loader2 className="size-3 animate-spin" />
      ) : (
        <ChevronRight className={`size-3 transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
      )}
    </button>
  );
}

function RowMoreButton({
  path,
  onOpenMenu,
}: {
  readonly path: string;
  readonly onOpenMenu: (el: HTMLElement) => void;
}) {
  const { t } = useTranslation();
  return (
    <button
      type="button"
      data-testid={`file-menu-btn-${path}`}
      aria-label={t('files.more')}
      onClick={(e) => {
        e.stopPropagation();
        onOpenMenu(e.currentTarget);
      }}
      className="cursor-pointer rounded p-0.5 text-ink-faint opacity-0 group-hover:opacity-100 hover:bg-field-hover hover:text-ink focus-visible:opacity-100"
    >
      <MoreHorizontal className="size-3.5" />
    </button>
  );
}

function RowIconAndName({
  entry,
  isExpanded,
  isRenaming,
  onCommitRename,
  onCancelRename,
}: {
  readonly entry: FileTreeEntry;
  readonly isExpanded: boolean;
  readonly isRenaming: boolean;
  readonly onCommitRename: (newName: string) => Promise<void>;
  readonly onCancelRename: () => void;
}) {
  return (
    <>
      {resolveEntryIcon(entry, isExpanded)}
      {isRenaming ? (
        <InlineRenameInput
          oldName={entry.name}
          onCommit={onCommitRename}
          onCancel={onCancelRename}
        />
      ) : (
        <span className="truncate flex-1 min-w-0">{entry.name}</span>
      )}
    </>
  );
}

function useRowEventHandlers(
  entry: FileTreeEntry,
  isRenaming: boolean,
  onToggle: () => void,
  onClick: () => void,
  onContextMenu: (e: React.MouseEvent) => void,
) {
  const handleClick = () => {
    if (!isRenaming) {
      if (entry.kind === 'directory') onToggle();
      else onClick();
    }
  };
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      if (entry.kind === 'directory') onToggle();
      else onClick();
    }
  };
  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onContextMenu(e);
  };
  return { handleClick, handleKeyDown, handleContextMenu };
}

/** Toggle, icon and name, status dots and the more button inside one row. */
function TreeRowContent(props: FilesTreeRowProps) {
  const { entry, isExpanded, isLoading, isRenaming } = props;
  return (
    <>
      {entry.kind === 'directory' && (
        <DirectoryToggleButton
          isExpanded={isExpanded}
          isLoading={isLoading}
          onToggle={props.onToggle}
        />
      )}
      <RowIconAndName
        entry={entry}
        isExpanded={isExpanded}
        isRenaming={isRenaming}
        onCommitRename={props.onCommitRename}
        onCancelRename={props.onCancelRename}
      />
      <StatusDots
        hasBuildError={props.hasBuildError}
        hasParentBuildError={props.hasParentBuildError}
        isAiModified={props.isAiModified}
      />
      {!isRenaming && <RowMoreButton path={entry.path} onOpenMenu={props.onOpenMenu} />}
    </>
  );
}

export function FilesTreeRow(props: FilesTreeRowProps) {
  const { entry, level, isExpanded, isSelected, isDesignSelected, isRenaming } = props;
  const { handleClick, handleKeyDown, handleContextMenu } = useRowEventHandlers(
    entry,
    isRenaming,
    props.onToggle,
    props.onClick,
    props.onContextMenu,
  );

  return (
    <div
      ref={(el) => {
        props.rowRef?.(el ?? undefined);
      }}
      role="treeitem"
      tabIndex={isSelected ? 0 : -1}
      data-testid={`file-row-${entry.path}`}
      data-path={entry.path}
      aria-expanded={entry.kind === 'directory' ? isExpanded : undefined}
      aria-selected={isSelected}
      draggable={!isRenaming}
      onDragStart={(e) => {
        e.dataTransfer.setData('application/x-kumicraft-path', entry.path);
      }}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      onContextMenu={handleContextMenu}
      style={{ paddingLeft: `${String(level * 14 + 6)}px` }}
      className={resolveRowClasses(isSelected, isDesignSelected, entry.hidden)}
    >
      <TreeRowContent {...props} />
    </div>
  );
}
