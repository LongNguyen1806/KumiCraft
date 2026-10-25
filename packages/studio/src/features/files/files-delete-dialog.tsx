import type { FileTreeEntry, PageInfo } from '@kumicraft/shared';
import { Loader2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { openInEditor } from '../../api/editor-client.ts';
import { fetchFileImporters } from '../../api/files-client.ts';
import { Dialog } from '../../components/ui/dialog.tsx';
import { errorText, toErrorInfo } from '../../routes/error-text.ts';
import { RenamePageForm } from '../pages/rename-page-form.tsx';
import { FilesContextMenu } from './files-context-menu.tsx';
import { useFilesStore } from './files-store.ts';

export type FilesDeleteDialogProps = {
  readonly open: boolean;
  readonly entry: FileTreeEntry | undefined;
  readonly routerPageCount?: number | undefined;
  readonly onClose: () => void;
  readonly onConfirm: (path: string) => Promise<void>;
};

function ImportersList({
  importers,
  truncated,
}: {
  readonly importers: readonly string[];
  readonly truncated: boolean;
}) {
  const { t } = useTranslation();
  if (importers.length === 0) return undefined;
  const displayed = importers.slice(0, 10);
  const remaining = importers.length - displayed.length;

  return (
    <div className="flex flex-col gap-1 rounded bg-rose-500/10 p-2.5 text-xs text-rose-700 dark:text-rose-300">
      <span className="font-medium">{t('files.deleteWarningImporters')}</span>
      <ul className="list-disc pl-4 font-mono text-[11px]">
        {displayed.map((imp) => (
          <li key={imp}>{imp}</li>
        ))}
      </ul>
      {(remaining > 0 || truncated) && (
        <span className="text-[11px] italic">
          {t('files.deleteWarningAndMore', { count: remaining > 0 ? remaining : 1 })}
        </span>
      )}
    </div>
  );
}

function useImportersFetcher(open: boolean, entry?: FileTreeEntry) {
  const [loading, setLoading] = useState(false);
  const [importers, setImporters] = useState<readonly string[]>([]);
  const [truncated, setTruncated] = useState(false);

  useEffect(() => {
    if (!open || entry === undefined || entry.kind !== 'file') return;
    let active = true;
    const run = async () => {
      setLoading(true);
      try {
        const res = await fetchFileImporters(entry.path);
        if (active) {
          setImporters(res.importers);
          setTruncated(res.truncated);
        }
      } catch {
        // Ignore fetch error
      } finally {
        if (active) setLoading(false);
      }
    };
    void run();
    return () => {
      active = false;
    };
  }, [open, entry]);

  const activeImporters = open && entry?.kind === 'file' ? importers : [];
  const activeTruncated = open && entry?.kind === 'file' ? truncated : false;

  return { loading: open && loading, importers: activeImporters, truncated: activeTruncated };
}

type DialogButtonsProps = {
  readonly busy: boolean;
  readonly isDangerous: boolean;
  readonly onClose: () => void;
  readonly onConfirm: () => void;
};

function DialogButtons({ busy, isDangerous, onClose, onConfirm }: DialogButtonsProps) {
  const { t } = useTranslation();
  return (
    <div className="flex items-center justify-end gap-2 pt-3">
      <button
        type="button"
        data-testid="files-delete-cancel"
        onClick={onClose}
        disabled={busy}
        className="rounded-full px-4 py-1.5 text-xs text-ink-soft hover:bg-field cursor-pointer"
      >
        {t('files.cancel')}
      </button>
      <button
        type="button"
        data-testid="files-delete-confirm"
        onClick={onConfirm}
        disabled={busy}
        className={`rounded-full px-4 py-1.5 text-xs font-medium cursor-pointer ${
          isDangerous
            ? 'bg-rose-600 text-white hover:bg-rose-700'
            : 'bg-primary text-on-charcoal hover:bg-primary-hover'
        }`}
      >
        {busy ? <Loader2 className="size-3.5 animate-spin" /> : t('files.deleteButton')}
      </button>
    </div>
  );
}

function DeleteDialogContent({
  entry,
  loading,
  importers,
  truncated,
  routerPageCount,
  busy,
  isDangerous,
  onClose,
  onConfirm,
}: {
  readonly entry: FileTreeEntry;
  readonly loading: boolean;
  readonly importers: readonly string[];
  readonly truncated: boolean;
  readonly routerPageCount: number;
  readonly busy: boolean;
  readonly isDangerous: boolean;
  readonly onClose: () => void;
  readonly onConfirm: () => void;
}) {
  const { t } = useTranslation();
  return (
    <div className="flex flex-col gap-3 text-xs">
      <p className="text-ink-soft">{t('files.deleteConfirm', { name: entry.name })}</p>
      {loading && (
        <div className="flex items-center gap-2 text-ink-faint">
          <Loader2 className="size-3.5 animate-spin" />
          <span>{t('files.loading')}</span>
        </div>
      )}
      <ImportersList importers={importers} truncated={truncated} />
      {entry.kind === 'directory' && routerPageCount > 0 && (
        <p className="rounded bg-amber-500/10 p-2 text-amber-700 dark:text-amber-300">
          {t('files.deleteFolderRouterPages', { count: routerPageCount })}
        </p>
      )}
      <DialogButtons
        busy={busy}
        isDangerous={isDangerous}
        onClose={onClose}
        onConfirm={onConfirm}
      />
    </div>
  );
}

/** Runs the delete; a refusal stays in the dialog as a message instead of closing it. */
function useDeleteConfirm(onConfirm: (path: string) => Promise<void>, onClose: () => void) {
  const { t: tError } = useTranslation('errors');
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<string | undefined>();
  const confirm = async (path: string) => {
    setBusy(true);
    setFailure(undefined);
    try {
      await onConfirm(path);
      onClose();
    } catch (error: unknown) {
      const info = toErrorInfo(error);
      setFailure(errorText(tError, info.code, info.params));
    } finally {
      setBusy(false);
    }
  };
  return { busy, failure, confirm };
}

export function FilesDeleteDialog({
  open,
  entry,
  routerPageCount = 0,
  onClose,
  onConfirm,
}: FilesDeleteDialogProps) {
  const { t } = useTranslation();
  const { loading, importers, truncated } = useImportersFetcher(open, entry);
  const { busy, failure, confirm } = useDeleteConfirm(onConfirm, onClose);

  if (!open || entry === undefined) return undefined;

  const isDangerous = importers.length > 0 || routerPageCount > 0;
  const handleConfirm = () => confirm(entry.path);

  return (
    <Dialog
      open={open}
      title={t('files.deleteTitle', { name: entry.name })}
      closeLabel={t('files.cancel')}
      onClose={onClose}
    >
      <DeleteDialogContent
        entry={entry}
        loading={loading}
        importers={importers}
        truncated={truncated}
        routerPageCount={routerPageCount}
        busy={busy}
        isDangerous={isDangerous}
        onClose={onClose}
        onConfirm={() => {
          void handleConfirm();
        }}
      />
      {failure !== undefined && (
        <p data-testid="files-delete-error" role="alert" className="pt-2 text-xs text-rose-600">
          {failure}
        </p>
      )}
    </Dialog>
  );
}

export type FilesDialogsSectionProps = {
  readonly menu: {
    readonly open: boolean;
    readonly x: number;
    readonly y: number;
    readonly entry?: FileTreeEntry | undefined;
  };
  readonly deleteTarget?: FileTreeEntry | undefined;
  readonly renamingPage?: PageInfo | undefined;
  readonly convention: boolean;
  readonly routerPageCount: number;
  readonly onCloseMenu: () => void;
  readonly onStartRename: (entry: FileTreeEntry) => void;
  readonly onDeleteRequest: (entry: FileTreeEntry) => void;
  readonly onCloseDelete: () => void;
  readonly onConfirmDelete: (path: string) => Promise<void>;
  readonly onCloseRenamePage: () => void;
  readonly onPageRenamed: (file?: string) => void;
};

function PageRenameModal({
  page,
  convention,
  onClose,
  onRenamed,
}: {
  readonly page?: PageInfo | undefined;
  readonly convention: boolean;
  readonly onClose: () => void;
  readonly onRenamed: (file?: string) => void;
}) {
  const { t } = useTranslation();
  if (page === undefined) return undefined;
  return (
    <Dialog open title={t('pages.rename')} closeLabel={t('files.cancel')} onClose={onClose}>
      <RenamePageForm
        page={page}
        convention={convention}
        onCancel={onClose}
        onRenamed={() => {
          onRenamed(page.file);
        }}
      />
    </Dialog>
  );
}

export function FilesDialogsSection(props: FilesDialogsSectionProps) {
  const { menu, deleteTarget, renamingPage, convention, routerPageCount } = props;
  const { onCloseMenu, onStartRename, onDeleteRequest } = props;
  const { onCloseDelete, onConfirmDelete, onCloseRenamePage, onPageRenamed } = props;
  const setInlineAction = useFilesStore((s) => s.setInlineAction);

  return (
    <>
      <FilesContextMenu
        open={menu.open}
        x={menu.x}
        y={menu.y}
        entry={menu.entry}
        onClose={onCloseMenu}
        onOpenInEditor={(path) => {
          void openInEditor(`${path}:1:1`);
        }}
        onNewFile={(dir) => {
          setInlineAction({ kind: 'newFile', dir });
        }}
        onNewFolder={(dir) => {
          setInlineAction({ kind: 'newFolder', dir });
        }}
        onRename={() => {
          if (menu.entry) onStartRename(menu.entry);
        }}
        onDelete={(entry) => {
          onDeleteRequest(entry);
        }}
        onCopyPath={(path) => {
          void navigator.clipboard.writeText(path).catch(() => undefined);
        }}
      />
      <FilesDeleteDialog
        open={deleteTarget !== undefined}
        entry={deleteTarget}
        routerPageCount={routerPageCount}
        onClose={onCloseDelete}
        onConfirm={onConfirmDelete}
      />
      <PageRenameModal
        page={renamingPage}
        convention={convention}
        onClose={onCloseRenamePage}
        onRenamed={onPageRenamed}
      />
    </>
  );
}
