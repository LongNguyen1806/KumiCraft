// Page list on the Canvas toolbar (SPEC-04 M-PG R-PG-15): pick a page of the project to show it
// in the Canvas; a page with `:param` asks for the value first.
import type { DraftInfo, PageInfo, RouterStatus } from '@kumicraft/shared';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { createEventsClient } from '../../api/events-client.ts';
import { isRecord } from '../../api/http.ts';
import { fetchPages } from '../../api/project-client.ts';
import { studioBridgeChannel } from '../../core/bridge-channel.ts';
import { useCanvasViewStore } from '../../core/canvas-view-store.ts';
import { isDraftAddress } from '../../core/open-frames-storage.ts';
import { useProjectInfo } from '../../core/project-store.ts';
import { useSelectionStore } from '../../core/selection-store.ts';
import { NewDraftDialog } from '../drafts/new-draft-dialog.tsx';
import { useDrafts } from '../drafts/use-drafts.ts';

const CODE_FILE = /\.(tsx|jsx|ts|js)$/;

export type PagesData = {
  readonly pages: readonly PageInfo[];
  readonly convention: boolean;
  readonly router: RouterStatus;
  readonly refresh: () => void;
};

const DEFAULT_ROUTER_STATUS: RouterStatus = { status: 'none', hasRouterPackage: false };

/** Pages and router convention of the open project, read again when code changes. */
export function usePagesData(): PagesData {
  const [data, setData] = useState<Omit<PagesData, 'refresh'>>({
    pages: [],
    convention: false,
    router: DEFAULT_ROUTER_STATUS,
  });
  const [reloadTick, setReloadTick] = useState(0);

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const info = await fetchPages();
        if (!active) return;
        const next = {
          pages: info.pages,
          convention: info.convention,
          router: info.router,
        };
        // Same list again (most history changes): keep the old object so the design target stays.
        setData((prev) => (JSON.stringify(prev) === JSON.stringify(next) ? prev : next));
      } catch {
        // No project or no router yet: the list stays empty.
      }
    };
    void load();
    const client = createEventsClient({
      onEvent: (event) => {
        // Studio's own page edits (add, rename, delete, Undo) reach only the history, not the watcher.
        if (event.type === 'project.changed' || event.type === 'history.changed') void load();
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
  }, [reloadTick]);

  return {
    ...data,
    refresh: () => {
      setReloadTick((n) => n + 1);
    },
  };
}

/** Pages of the open project, read again when its code changes. */
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
      className="h-[26px] w-44 rounded-md border border-line bg-field px-2 py-0 font-mono text-ink"
    />
  );
}

function DraftSelectOptGroup({ drafts }: { readonly drafts: readonly DraftInfo[] }) {
  const { t } = useTranslation();
  const project = useProjectInfo();
  // A Next.js project has no draft page yet (03b section 1.5): say so instead of offering one.
  if (project?.support.framework === 'next-react') {
    return (
      <optgroup label={t('drafts.title')}>
        <option value="draft:unavailable" disabled>
          {t('drafts.unavailableNext')}
        </option>
      </optgroup>
    );
  }
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
    <label className="flex min-w-0 items-center gap-1.5 text-ink-soft">
      <span className="sr-only">{t('editor.page')}</span>
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
        className="h-[26px] w-48 min-w-0 rounded-md border border-line bg-field px-2 py-0 font-medium text-ink"
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
  readonly projectId: string | undefined;
  readonly reload: () => void;
  readonly newDraftOpen: boolean;
  readonly onNewDraftClose: () => void;
};

function PageSelectDialogs({
  projectId,
  reload,
  newDraftOpen,
  onNewDraftClose,
}: PageSelectDialogsProps) {
  return (
    <>
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

function computeCurrentRoute(
  draftFile: string | undefined,
  pages: readonly PageInfo[],
  route: string,
): string {
  if (draftFile !== undefined) return `draft:${draftFile}`;
  return pages.some((p) => p.path === route) ? route : '';
}

/** The concrete route (`/admin/markets/5`) when the list cannot name it as one page. */
function RouteText({ route }: { readonly route: string }) {
  return (
    <span
      className="min-w-0 truncate font-mono text-ink-soft"
      title={route}
      data-testid="canvas-route"
    >
      {route}
    </span>
  );
}

export function PageSelect() {
  const { pages } = usePagesData();
  const { drafts, projectId, reload } = useDrafts();
  const route = useSelectionStore((s) => s.currentRoute);
  const draftFile = useCanvasViewStore((s) => s.draftFile);
  const openDraft = useCanvasViewStore((s) => s.openDraft);
  const closeDraft = useCanvasViewStore((s) => s.closeDraft);
  const [paramDraft, setParamDraft] = useState<string>();
  const [newDraftOpen, setNewDraftOpen] = useState(false);
  const current = computeCurrentRoute(draftFile, pages, route);

  return (
    <div className="flex min-w-0 items-center gap-2">
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
        onNewDraft={() => {
          setNewDraftOpen(true);
        }}
      />
      {/* A route the list cannot name; never the internal address a draft is shown at. */}
      {current === '' && draftFile === undefined && !isDraftAddress(route) && (
        <RouteText route={route} />
      )}
      <PageSelectDialogs
        projectId={projectId}
        reload={reload}
        newDraftOpen={newDraftOpen}
        onNewDraftClose={() => {
          setNewDraftOpen(false);
        }}
      />
    </div>
  );
}
