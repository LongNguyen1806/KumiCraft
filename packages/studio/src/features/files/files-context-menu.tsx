import type { FileTreeEntry } from '@kumicraft/shared';
import { Copy, Edit3, FilePlus, FolderPlus, Laptop, Trash2 } from 'lucide-react';
import { type ReactNode, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';

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

type MenuItemProps = {
  readonly icon: ReactNode;
  readonly label: string;
  readonly testId: string;
  readonly onClick: () => void;
  readonly danger?: boolean | undefined;
};

function MenuItem({ icon, label, testId, onClick, danger = false }: MenuItemProps) {
  return (
    <button
      type="button"
      role="menuitem"
      data-testid={testId}
      onClick={onClick}
      className={`flex w-full items-center gap-2 rounded px-2.5 py-1.5 text-left text-xs transition-colors hover:bg-field-hover cursor-pointer ${
        danger ? 'text-rose-600 dark:text-rose-400' : 'text-ink'
      }`}
    >
      <span className="size-4 shrink-0">{icon}</span>
      <span className="truncate">{label}</span>
    </button>
  );
}

function useMenuDismiss(
  open: boolean,
  menuRef: React.RefObject<HTMLDivElement | undefined>,
  onClose: () => void,
) {
  useEffect(() => {
    if (!open) return;
    const handleDown = (e: MouseEvent) => {
      const target = e.target;
      if (menuRef.current && target instanceof Node && !menuRef.current.contains(target)) {
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
  return (
    <>
      <MenuItem
        icon={<Edit3 className="size-3.5" />}
        label={t('files.rename')}
        testId="files-menu-rename"
        onClick={() => {
          onClose();
          onRename(entry.path, entry.name);
        }}
      />
      <MenuItem
        icon={<Trash2 className="size-3.5" />}
        label={t('files.delete')}
        testId="files-menu-delete"
        danger
        onClick={() => {
          onClose();
          onDelete(entry);
        }}
      />
      <MenuItem
        icon={<Copy className="size-3.5" />}
        label={t('files.copyPath')}
        testId="files-menu-copy-path"
        onClick={() => {
          onClose();
          onCopyPath(entry.path);
        }}
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

export function FilesContextMenu(props: FilesContextMenuProps) {
  const { open, x, y, entry, onClose, onOpenInEditor, onNewFile, onNewFolder } = props;
  const { onRename, onDelete, onCopyPath } = props;
  const { t } = useTranslation();
  const menuRef = useRef<HTMLDivElement | undefined>(undefined);
  useMenuDismiss(open, menuRef, onClose);

  if (!open) return undefined;

  const targetDir = resolveTargetDir(entry);

  return (
    <div
      ref={(el) => {
        menuRef.current = el ?? undefined;
      }}
      role="menu"
      data-testid="files-context-menu"
      style={{ left: `${String(x)}px`, top: `${String(y)}px` }}
      className="fixed z-50 min-w-44 rounded-lg border border-border bg-card-solid p-1 shadow-lg backdrop-blur-md"
    >
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
        <EntrySpecificMenuItems
          entry={entry}
          onClose={onClose}
          onRename={onRename}
          onDelete={onDelete}
          onCopyPath={onCopyPath}
        />
      )}
    </div>
  );
}
