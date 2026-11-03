import type { PageInfo, RouterStatus, StructureResult } from '@kumicraft/shared';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { deleteProjectPage } from '../../api/project-client.ts';
import { errorText, toErrorInfo } from '../../routes/error-text.ts';
import { usePagesData } from '../editor/page-select.tsx';
import { AddPageForm } from './add-page-form.tsx';
import { RenamePageForm } from './rename-page-form.tsx';
import { RouterStatusBox } from './router-status-box.tsx';

type PageRowActionsProps = {
  readonly path: string;
  readonly convention: boolean;
  readonly onStartRename: () => void;
  readonly onDelete: (path: string) => void;
};

function PageRowActions({ path, convention, onStartRename, onDelete }: PageRowActionsProps) {
  const { t } = useTranslation();
  return (
    <div className="flex items-center gap-1.5 shrink-0">
      <button
        type="button"
        data-testid={`page-rename-${path}`}
        disabled={!convention}
        onClick={onStartRename}
        className="rounded border border-border px-2 py-0.5 text-ink-soft hover:text-ink disabled:opacity-40"
      >
        {t('pages.rename')}
      </button>
      <button
        type="button"
        data-testid={`page-delete-${path}`}
        disabled={!convention}
        onClick={() => {
          onDelete(path);
        }}
        className="rounded border border-border px-2 py-0.5 text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 disabled:opacity-40"
      >
        {t('pages.delete')}
      </button>
    </div>
  );
}

type PageRowProps = {
  readonly page: PageInfo;
  readonly convention: boolean;
  readonly isRenaming: boolean;
  readonly onStartRename: () => void;
  readonly onCancelRename: () => void;
  readonly onDelete: (path: string) => void;
  readonly onRenamed: (res: StructureResult) => void;
};

function PageRow({
  page,
  convention,
  isRenaming,
  onStartRename,
  onCancelRename,
  onDelete,
  onRenamed,
}: PageRowProps) {
  if (isRenaming) {
    return (
      <RenamePageForm
        page={page}
        convention={convention}
        onCancel={onCancelRename}
        onRenamed={onRenamed}
      />
    );
  }

  return (
    <div className="flex items-center justify-between rounded border border-border/60 bg-field/20 px-3 py-2 text-xs">
      <div className="flex flex-col min-w-0">
        <span className="font-medium text-ink truncate">
          {page.component !== undefined ? page.component : page.path}
        </span>
        <span className="font-mono text-[11px] text-ink-faint truncate">{page.path}</span>
      </div>
      <PageRowActions
        path={page.path}
        convention={convention}
        onStartRename={onStartRename}
        onDelete={onDelete}
      />
    </div>
  );
}

type PagesListProps = {
  readonly pages: readonly PageInfo[];
  readonly convention: boolean;
  readonly renamingPath?: string | undefined;
  readonly onStartRename: (path: string) => void;
  readonly onCancelRename: () => void;
  readonly onDelete: (path: string) => void;
  readonly onRenamed: () => void;
};

export function PagesList({
  pages,
  convention,
  renamingPath,
  onStartRename,
  onCancelRename,
  onDelete,
  onRenamed,
}: PagesListProps) {
  const { t } = useTranslation();
  return (
    <div className="flex flex-col gap-1.5">
      <div className="text-xs font-semibold text-ink-soft">{t('pages.title')}</div>
      {pages.map((p) => (
        <PageRow
          key={p.path}
          page={p}
          convention={convention}
          isRenaming={renamingPath === p.path}
          onStartRename={() => {
            onStartRename(p.path);
          }}
          onCancelRename={() => {
            onCancelRename();
          }}
          onDelete={(path) => {
            onDelete(path);
          }}
          onRenamed={() => {
            onRenamed();
          }}
        />
      ))}
    </div>
  );
}

export function usePageDeletion() {
  const { t } = useTranslation();
  const { t: tError } = useTranslation('errors');
  const [deleteError, setDeleteError] = useState<string | undefined>();

  const handleDelete = async (path: string) => {
    if (!window.confirm(t('pages.deleteConfirm', { path }))) return;
    setDeleteError(undefined);
    try {
      await deleteProjectPage({ path });
    } catch (err) {
      const info = toErrorInfo(err);
      setDeleteError(errorText(tError, info.code, info.params));
    }
  };

  return { deleteError, handleDelete };
}

type PagesHeaderProps = {
  readonly convention: boolean;
  readonly router: RouterStatus;
  readonly defaultDir?: string | undefined;
  readonly onPageAdded?: ((pagePath: string) => void) | undefined;
  readonly onRouterChanged?: (() => void) | undefined;
  readonly deleteError?: string | undefined;
};

export function PagesHeader({
  convention,
  router,
  defaultDir,
  onPageAdded,
  onRouterChanged,
  deleteError,
}: PagesHeaderProps) {
  return (
    <>
      <RouterStatusBox router={router} onRouterChanged={onRouterChanged} />
      <AddPageForm
        convention={convention}
        defaultDir={defaultDir}
        onAdded={(res) => {
          if (res.pagePath !== undefined) onPageAdded?.(res.pagePath);
        }}
      />
      {deleteError !== undefined && (
        <div role="alert" className="text-xs text-rose-600">
          {deleteError}
        </div>
      )}
    </>
  );
}

export type PagesPanelProps = {
  readonly pages?: readonly PageInfo[] | undefined;
  readonly convention?: boolean | undefined;
  readonly router?: RouterStatus | undefined;
  readonly defaultDir?: string | undefined;
  readonly onPageAdded?: ((pagePath: string) => void) | undefined;
};

export function PagesPanel({
  pages: propPages,
  convention: propConvention,
  router: propRouter,
  defaultDir,
  onPageAdded,
}: PagesPanelProps = {}) {
  const storeData = usePagesData();
  const pages = propPages ?? storeData.pages;
  const router: RouterStatus =
    propRouter ??
    (propConvention === true && storeData.router.status !== 'found'
      ? { status: 'found', file: 'src/routes.tsx', line: 1, kind: 'dataRouter', chosen: false }
      : propConvention === false && storeData.router.status === 'found'
        ? { status: 'none', hasRouterPackage: false }
        : storeData.router);
  const convention = propConvention ?? router.status === 'found';
  const [renamingPath, setRenamingPath] = useState<string | undefined>();
  const { deleteError, handleDelete } = usePageDeletion();

  return (
    <div data-testid="pages-panel" className="flex flex-col gap-3 text-xs text-ink">
      <PagesHeader
        convention={convention}
        router={router}
        defaultDir={defaultDir}
        onPageAdded={onPageAdded}
        onRouterChanged={storeData.refresh}
        deleteError={deleteError}
      />
      <PagesList
        pages={pages}
        convention={convention}
        renamingPath={renamingPath}
        onStartRename={(path) => {
          setRenamingPath(path);
        }}
        onCancelRename={() => {
          setRenamingPath(undefined);
        }}
        onDelete={(path) => {
          void handleDelete(path);
        }}
        onRenamed={() => {
          setRenamingPath(undefined);
        }}
      />
    </div>
  );
}
