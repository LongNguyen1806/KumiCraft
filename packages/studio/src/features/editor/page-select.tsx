// Page list on the Canvas toolbar (SPEC-04 M-PG R-PG-15): pick a page of the project to show it
// in the Canvas; a page with `:param` asks for the value first.
import type { DraftInfo, PageInfo } from '@reactcraft/shared';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { createEventsClient } from '../../api/events-client.ts';
import { isRecord } from '../../api/http.ts';
import { fetchPages } from '../../api/project-client.ts';
import { DraftsDialog } from '../drafts/drafts-dialog.tsx';
import { NewDraftDialog } from '../drafts/new-draft-dialog.tsx';
import { useDrafts } from '../drafts/use-drafts.ts';
import { PagesDialog } from '../pages/pages-dialog.tsx';
import { studioBridgeChannel } from '../selection/bridge-channel.ts';
import { useSelectionStore } from '../selection/selection-store.ts';
import { useCanvasViewStore } from './canvas-view-store.ts';

const CODE_FILE = /\.(tsx|jsx|ts|js)$/;

export type PagesData = {
  readonly pages: readonly PageInfo[];
  readonly convention: boolean;
};

/** Pages and router convention of the open project, read again when code changes. */
export function usePagesData(): PagesData {
  const [data, setData] = useState<PagesData>({ pages: [], convention: false });

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const info = await fetchPages();
        if (active) setData({ pages: info.pages, convention: info.convention });
      } catch {
        // No project or no router yet: the list stays empty.
      }
    };
    void load();
    const client = createEventsClient({
      onEvent: (event) => {
        if (event.type === 'project.changed') void load();
        if (event.type !== 'project.filesChanged') return;
        const files = isRecord(event.payload) ? event.payload['files'] : undefined;
        if (Array.isArray(files) && files.some((f) => typeof f === 'string' && CODE_FILE.test(f))) {
          void load();
        }
      },
    });
    return () => {
      active = false;
      client.close();
    };
  }, []);

  return data;
}

/** Pages of the open project, read again when its code changes. */
export function usePages(): readonly PageInfo[] {
  return usePagesData().pages;
}

function go(route: string): void {
  if (route.startsWith('/')) studioBridgeChannel.navigate(route);
}

/** A `:param` page: the user types the value, Enter shows it, Esc gives up. */
function ParamInput({
  initial,
  onDone,
}: {
  readonly initial: string;
  readonly onDone: () => void;
}) {
  const { t } = useTranslation();
  const [value, setValue] = useState(initial);
  return (
    <input
      data-testid="canvas-page-param"
      aria-label={t('editor.pageParamHint')}
      title={t('editor.pageParamHint')}
      value={value}
      onChange={(e) => {
        setValue(e.target.value);
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          go(value.trim());
          onDone();
        } else if (e.key === 'Escape') {
          onDone();
        }
      }}
      className="w-44 rounded border border-border bg-field px-2 py-1 font-mono text-ink"
    />
  );
}

function DraftSelectOptGroup({ drafts }: { readonly drafts: readonly DraftInfo[] }) {
  const { t } = useTranslation();
  return (
    <optgroup label={t('drafts.title')}>
      <option value="draft:new">{t('drafts.new')}</option>
      {drafts.map((d) => (
        <option key={d.file} value={`draft:${d.file}`}>
          {d.name} — {d.file}
        </option>
      ))}
    </optgroup>
  );
}

type PageSelectControlProps = {
  readonly pages: readonly PageInfo[];
  readonly drafts: readonly DraftInfo[];
  readonly current: string;
  readonly draftFile: string | undefined;
  readonly draft?: string | undefined;
  readonly onDraftChange: (path?: string) => void;
  readonly onOpenDraft: (file: string) => void;
  readonly onCloseDraft: () => void;
  readonly onNewDraft: () => void;
};

function handlePageSelectChange(
  val: string,
  pages: readonly PageInfo[],
  draftFile: string | undefined,
  callbacks: {
    readonly onOpenDraft: (file: string) => void;
    readonly onCloseDraft: () => void;
    readonly onNewDraft: () => void;
    readonly onDraftChange: (path?: string) => void;
  },
): void {
  if (val === 'draft:new') {
    callbacks.onNewDraft();
    return;
  }
  if (val.startsWith('draft:')) {
    callbacks.onOpenDraft(val.slice('draft:'.length));
    return;
  }
  const page = pages.find((p) => p.path === val);
  if (page === undefined) return;
  if (draftFile !== undefined) callbacks.onCloseDraft();
  if (page.dynamic) callbacks.onDraftChange(page.path);
  else go(page.path);
}

function PageSelectControl({
  pages,
  drafts,
  current,
  draftFile,
  draft,
  onDraftChange,
  onOpenDraft,
  onCloseDraft,
  onNewDraft,
}: PageSelectControlProps) {
  const { t } = useTranslation();
  return (
    <label className="flex items-center gap-1.5 text-ink-soft">
      {t('editor.page')}
      <select
        value={current}
        data-testid="canvas-page-select"
        onChange={(e) => {
          handlePageSelectChange(e.target.value, pages, draftFile, {
            onOpenDraft,
            onCloseDraft,
            onNewDraft,
            onDraftChange,
          });
        }}
        className="max-w-48 rounded border border-border bg-field px-2 py-1 text-ink"
      >
        <option value="">
          {pages.length === 0 ? t('editor.noPages') : t('editor.pageChoose')}
        </option>
        {pages.map((p) => (
          <option key={p.path} value={p.path}>
            {p.component === undefined ? p.path : `${p.component} — ${p.path}`}
          </option>
        ))}
        <DraftSelectOptGroup drafts={drafts} />
      </select>
      {draft !== undefined && (
        <ParamInput
          initial={draft}
          onDone={() => {
            onDraftChange(undefined);
          }}
        />
      )}
    </label>
  );
}

type PageSelectDialogsProps = {
  readonly pages: readonly PageInfo[];
  readonly convention: boolean;
  readonly drafts: readonly DraftInfo[];
  readonly ignored: boolean;
  readonly projectId: string | undefined;
  readonly reload: () => void;
  readonly pagesDialogOpen: boolean;
  readonly draftsDialogOpen: boolean;
  readonly newDraftOpen: boolean;
  readonly onPagesClose: () => void;
  readonly onDraftsClose: () => void;
  readonly onNewDraftClose: () => void;
};

function PageSelectDialogs({
  pages,
  convention,
  drafts,
  ignored,
  projectId,
  reload,
  pagesDialogOpen,
  draftsDialogOpen,
  newDraftOpen,
  onPagesClose,
  onDraftsClose,
  onNewDraftClose,
}: PageSelectDialogsProps) {
  return (
    <>
      {pagesDialogOpen && (
        <PagesDialog
          open={pagesDialogOpen}
          pages={pages}
          convention={convention}
          onClose={onPagesClose}
          onPageAdded={(pagePath) => {
            go(pagePath);
          }}
        />
      )}
      {draftsDialogOpen && (
        <DraftsDialog
          open={draftsDialogOpen}
          drafts={drafts}
          ignored={ignored}
          projectId={projectId}
          onClose={onDraftsClose}
          onReload={reload}
        />
      )}
      {newDraftOpen && (
        <NewDraftDialog
          open={newDraftOpen}
          projectId={projectId}
          onClose={onNewDraftClose}
          onCreated={() => {
            reload();
          }}
        />
      )}
    </>
  );
}

type PageManageButtonsProps = {
  readonly onOpenPages: () => void;
  readonly onOpenDrafts: () => void;
};

function PageManageButtons({ onOpenPages, onOpenDrafts }: PageManageButtonsProps) {
  const { t } = useTranslation();
  return (
    <>
      <button
        type="button"
        data-testid="pages-manage"
        title={t('pages.manage')}
        onClick={onOpenPages}
        className="shrink-0 whitespace-nowrap rounded border border-border bg-field px-2 py-1 text-xs text-ink hover:bg-field-hover"
      >
        {t('pages.manage')}
      </button>
      <button
        type="button"
        data-testid="drafts-manage"
        title={t('drafts.manage')}
        onClick={onOpenDrafts}
        className="shrink-0 whitespace-nowrap rounded border border-border bg-field px-2 py-1 text-xs text-ink hover:bg-field-hover"
      >
        {t('drafts.manage')}
      </button>
    </>
  );
}

function usePageSelectDialogs() {
  const [pagesDialogOpen, setPagesDialogOpen] = useState(false);
  const [draftsDialogOpen, setDraftsDialogOpen] = useState(false);
  const [newDraftOpen, setNewDraftOpen] = useState(false);

  return {
    pagesDialogOpen,
    draftsDialogOpen,
    newDraftOpen,
    openPages: () => {
      setPagesDialogOpen(true);
    },
    closePages: () => {
      setPagesDialogOpen(false);
    },
    openDrafts: () => {
      setDraftsDialogOpen(true);
    },
    closeDrafts: () => {
      setDraftsDialogOpen(false);
    },
    openNewDraft: () => {
      setNewDraftOpen(true);
    },
    closeNewDraft: () => {
      setNewDraftOpen(false);
    },
  };
}

export function PageSelect() {
  const { pages, convention } = usePagesData();
  const { drafts, ignored, projectId, reload } = useDrafts();
  const route = useSelectionStore((s) => s.currentRoute);
  const draftFile = useCanvasViewStore((s) => s.draftFile);
  const openDraft = useCanvasViewStore((s) => s.openDraft);
  const closeDraft = useCanvasViewStore((s) => s.closeDraft);
  const [paramDraft, setParamDraft] = useState<string>();
  const dialogs = usePageSelectDialogs();

  const current =
    draftFile !== undefined
      ? `draft:${draftFile}`
      : pages.some((p) => p.path === route)
        ? route
        : '';

  return (
    <div className="flex items-center gap-2">
      <PageSelectControl
        pages={pages}
        drafts={drafts}
        current={current}
        draftFile={draftFile}
        draft={paramDraft}
        onDraftChange={setParamDraft}
        onOpenDraft={(f) => {
          openDraft(f, projectId);
        }}
        onCloseDraft={() => {
          closeDraft(projectId);
        }}
        onNewDraft={dialogs.openNewDraft}
      />
      <PageManageButtons onOpenPages={dialogs.openPages} onOpenDrafts={dialogs.openDrafts} />
      <PageSelectDialogs
        pages={pages}
        convention={convention}
        drafts={drafts}
        ignored={ignored}
        projectId={projectId}
        reload={reload}
        pagesDialogOpen={dialogs.pagesDialogOpen}
        draftsDialogOpen={dialogs.draftsDialogOpen}
        newDraftOpen={dialogs.newDraftOpen}
        onPagesClose={dialogs.closePages}
        onDraftsClose={dialogs.closeDrafts}
        onNewDraftClose={dialogs.closeNewDraft}
      />
    </div>
  );
}
