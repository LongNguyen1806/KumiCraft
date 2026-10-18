// Page list on the Canvas toolbar (SPEC-04 M-PG R-PG-15): pick a page of the project to show it
// in the Canvas; a page with `:param` asks for the value first.
import type { PageInfo } from '@reactcraft/shared';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { createEventsClient } from '../../api/events-client.ts';
import { isRecord } from '../../api/http.ts';
import { fetchPages } from '../../api/project-client.ts';
import { PagesDialog } from '../pages/pages-dialog.tsx';
import { studioBridgeChannel } from '../selection/bridge-channel.ts';
import { useSelectionStore } from '../selection/selection-store.ts';

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

type PageSelectControlProps = {
  readonly pages: readonly PageInfo[];
  readonly current: string;
  readonly draft?: string | undefined;
  readonly onDraftChange: (path?: string) => void;
};

function PageSelectControl({ pages, current, draft, onDraftChange }: PageSelectControlProps) {
  const { t } = useTranslation();
  return (
    <label className="flex items-center gap-1.5 text-ink-soft">
      {t('editor.page')}
      <select
        value={current}
        data-testid="canvas-page-select"
        onChange={(e) => {
          const page = pages.find((p) => p.path === e.target.value);
          if (page === undefined) return;
          if (page.dynamic) onDraftChange(page.path);
          else go(page.path);
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

export function PageSelect() {
  const { t } = useTranslation();
  const { pages, convention } = usePagesData();
  const route = useSelectionStore((s) => s.currentRoute);
  const [draft, setDraft] = useState<string>();
  const [dialogOpen, setDialogOpen] = useState(false);
  const current = pages.some((p) => p.path === route) ? route : '';

  return (
    <div className="flex items-center gap-2">
      <PageSelectControl
        pages={pages}
        current={current}
        draft={draft}
        onDraftChange={(d) => {
          setDraft(d);
        }}
      />
      <button
        type="button"
        data-testid="pages-manage"
        title={t('pages.manage')}
        onClick={() => {
          setDialogOpen(true);
        }}
        className="rounded border border-border bg-field px-2 py-1 text-xs text-ink hover:bg-field-hover"
      >
        {t('pages.manage')}
      </button>
      {dialogOpen && (
        <PagesDialog
          open={dialogOpen}
          pages={pages}
          convention={convention}
          onClose={() => {
            setDialogOpen(false);
          }}
          onPageAdded={(pagePath) => {
            go(pagePath);
          }}
        />
      )}
    </div>
  );
}
