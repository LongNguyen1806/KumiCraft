import type { FileTreeEntry } from '@kumicraft/shared';
import { Copy, Edit3, FilePlus, FolderPlus, Laptop, Trash2 } from 'lucide-react';
import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';

import { useProjectInfo } from '../../core/project-store.ts';
import { FileTokenAction, FolderDesignActions } from './files-design-menu.tsx';
import { MenuItem } from './menu-item.tsx';

export type FilesContextMenuProps = {
  readonly open: boolean;
  readonly x: number;
  readonly y: number;
  readonly entry?: FileTreeEntry | undefined;
  readonly onClose: () => void;
  readonly onOpenInEditor: (path: string) => void;
  readonly onNewFile: (dir: string) => void;
  readonly onNewFolder: (dir: string) => void;
  readonly onRename: (path: string, oldName: string) => void;
  readonly onDelete: (entry: FileTreeEntry) => void;
  readonly onCopyPath: (path: string) => void;
};

function useMenuDismiss(
  open: boolean,
  menuRef: React.RefObject<HTMLDivElement | undefined>,
  onClose: () => void,
) {
  useEffect(() => {
    if (!open) return;
    const handleDown = (e: MouseEvent) => {
      if (menuRef.current && e.target instanceof Node && !menuRef.current.contains(e.target)) {
        onClose();
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('mousedown', handleDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [open, menuRef, onClose]);
}

function resolveTargetDir(entry?: FileTreeEntry): string {
  if (entry === undefined) return '';
  if (entry.kind === 'directory') return entry.path;
  const idx = entry.path.lastIndexOf('/');
  return idx === -1 ? '' : entry.path.slice(0, idx);
}

type EntrySpecificMenuItemsProps = {
  readonly entry: FileTreeEntry;
  readonly onClose: () => void;
  readonly onRename: (path: string, oldName: string) => void;
  readonly onDelete: (entry: FileTreeEntry) => void;
  readonly onCopyPath: (path: string) => void;
};

function EntrySpecificMenuItems({
  entry,
  onClose,
  onRename,
  onDelete,
  onCopyPath,
}: EntrySpecificMenuItemsProps) {
  const { t } = useTranslation();
  const handleRename = () => {
    onClose();
    onRename(entry.path, entry.name);
  };
  const handleDelete = () => {
    onClose();
    onDelete(entry);
  };
  const handleCopy = () => {
    onClose();
    onCopyPath(entry.path);
  };
  return (
    <>
      <MenuItem
        icon={<Edit3 className="size-3.5" />}
        label={t('files.rename')}
        testId="files-menu-rename"
        onClick={handleRename}
      />
      <MenuItem
        icon={<Trash2 className="size-3.5" />}
        label={t('files.delete')}
        testId="files-menu-delete"
        danger
        onClick={handleDelete}
      />
      <MenuItem
        icon={<Copy className="size-3.5" />}
        label={t('files.copyPath')}
        testId="files-menu-copy-path"
        onClick={handleCopy}
      />
    </>
  );
}

function NewItemButtons({
  targetDir,
  onClose,
  onNewFile,
  onNewFolder,
}: {
  readonly targetDir: string;
  readonly onClose: () => void;
  readonly onNewFile: (dir: string) => void;
  readonly onNewFolder: (dir: string) => void;
}) {
  const { t } = useTranslation();
  return (
    <>
      <MenuItem
        icon={<FilePlus className="size-3.5" />}
        label={t('files.newFile')}
        testId="files-menu-new-file"
        onClick={() => {
          onClose();
          onNewFile(targetDir);
        }}
      />
      <MenuItem
        icon={<FolderPlus className="size-3.5" />}
        label={t('files.newFolder')}
        testId="files-menu-new-folder"
        onClick={() => {
          onClose();
          onNewFolder(targetDir);
        }}
      />
    </>
  );
}

function ContextMenuBody({
  entry,
  project,
  targetDir,
  props,
}: {
  readonly entry: FileTreeEntry | undefined;
  readonly project: ReturnType<typeof useProjectInfo>;
  readonly targetDir: string;
  readonly props: FilesContextMenuProps;
}) {
  const { t } = useTranslation();
  const { onClose, onOpenInEditor, onNewFile, onNewFolder, onRename, onDelete, onCopyPath } = props;

  return (
    <>
      {entry !== undefined && (
        <MenuItem
          icon={<Laptop className="size-3.5" />}
          label={t('files.openInEditor')}
          testId="files-menu-open-editor"
          onClick={() => {
            onClose();
            onOpenInEditor(entry.path);
          }}
        />
      )}
      <NewItemButtons
        targetDir={targetDir}
        onClose={onClose}
        onNewFile={onNewFile}
        onNewFolder={onNewFolder}
      />
      {entry !== undefined && (
        <>
          <FolderDesignActions entry={entry} project={project} onClose={onClose} />
          <FileTokenAction entry={entry} project={project} onClose={onClose} />
          <EntrySpecificMenuItems
            entry={entry}
            onClose={onClose}
            onRename={onRename}
            onDelete={onDelete}
            onCopyPath={onCopyPath}
          />
        </>
      )}
    </>
  );
}

export function FilesContextMenu(props: FilesContextMenuProps) {
  const { open, x, y, entry, onClose } = props;
  const project = useProjectInfo();
  const menuRef = useRef<HTMLDivElement | undefined>(undefined);
  useMenuDismiss(open, menuRef, onClose);

  if (!open) return undefined;
  return (
    <div
      ref={(el) => {
        menuRef.current = el ?? undefined;
      }}
      role="menu"
      data-testid="files-context-menu"
      style={{ left: `${String(x)}px`, top: `${String(y)}px` }}
      className="fixed z-50 min-w-44 rounded-lg border border-line bg-card-solid p-1 shadow-soft"
    >
      <ContextMenuBody
        entry={entry}
        project={project}
        targetDir={resolveTargetDir(entry)}
        props={props}
      />
    </div>
  );
}
