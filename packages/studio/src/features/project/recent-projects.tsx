// "Open again" list of the projects opened before (R-PJ-25): one click instead of browsing.
import type { RecentProject } from '@kumicraft/shared';
import { X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { fetchRecentProjects, forgetRecentProject, openProject } from '../../api/project-client.ts';
import { errorText, toErrorInfo } from '../../routes/error-text.ts';

function useRecentProjects() {
  const [recent, setRecent] = useState<readonly RecentProject[]>([]);
  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const list = await fetchRecentProjects();
        if (active) setRecent(list);
      } catch {
        // No list: the Project button still works.
      }
    };
    void load();
    return () => {
      active = false;
    };
  }, []);
  // The row goes at once; it comes back if the list cannot be saved.
  const forget = async (path: string): Promise<boolean> => {
    const before = recent;
    setRecent(before.filter((entry) => entry.path !== path));
    try {
      await forgetRecentProject(path);
      return true;
    } catch {
      setRecent(before);
      return false;
    }
  };
  return { recent, forget };
}

function useOpenRecent(onOpened: () => void) {
  const { t: tError } = useTranslation('errors');
  const [opening, setOpening] = useState<string>();
  const [error, setError] = useState<string>();
  const open = async (path: string) => {
    setOpening(path);
    setError(undefined);
    try {
      await openProject(path);
      onOpened();
    } catch (cause) {
      const info = toErrorInfo(cause);
      setError(errorText(tError, info.code, info.params));
    } finally {
      setOpening(undefined);
    }
  };
  return { opening, error, open };
}

type RecentRowProps = {
  readonly entry: RecentProject;
  readonly index: number;
  readonly busy: boolean;
  readonly onOpen: () => void;
  readonly onForget: () => void;
};

/** One project: click to open it again; the x only takes it off the list (R-PJ-25). */
function RecentRow({ entry, index, busy, onOpen, onForget }: RecentRowProps) {
  const { t } = useTranslation();
  return (
    <li className="relative">
      <button
        type="button"
        data-testid={`recent-project-${String(index)}`}
        disabled={busy}
        onClick={onOpen}
        className="grid w-full cursor-pointer rounded-2xl bg-card py-2.5 pr-12 pl-4 text-left shadow-soft hover:bg-field disabled:opacity-60"
      >
        <span className="font-medium text-ink">{entry.name}</span>
        <span className="font-mono text-xs break-all text-ink-faint">{entry.path}</span>
      </button>
      <button
        type="button"
        data-testid={`recent-project-forget-${String(index)}`}
        title={t('noProject.forget')}
        aria-label={t('noProject.forgetNamed', { name: entry.name })}
        disabled={busy}
        onClick={onForget}
        className="absolute top-1/2 right-3 flex size-7 -translate-y-1/2 cursor-pointer items-center justify-center rounded-full text-ink-faint hover:bg-field hover:text-ink disabled:opacity-60"
      >
        <X className="size-4" />
      </button>
    </li>
  );
}

export function RecentProjects({ onOpened }: { readonly onOpened: () => void }) {
  const { t } = useTranslation();
  const { recent, forget } = useRecentProjects();
  const { opening, error, open } = useOpenRecent(onOpened);
  const [forgetFailed, setForgetFailed] = useState(false);
  const onForget = async (path: string) => {
    setForgetFailed(!(await forget(path)));
  };
  if (recent.length === 0) return undefined;

  return (
    <section data-testid="recent-projects" className="grid gap-2">
      <h2 className="text-sm font-medium text-ink-soft">{t('noProject.recent')}</h2>
      <ul className="grid gap-1.5">
        {recent.map((entry, index) => (
          <RecentRow
            key={entry.path}
            entry={entry}
            index={index}
            busy={opening !== undefined}
            onOpen={() => {
              void open(entry.path);
            }}
            onForget={() => {
              void onForget(entry.path);
            }}
          />
        ))}
      </ul>
      {forgetFailed && (
        <p role="alert" data-testid="recent-project-forget-error" className="text-sm text-danger">
          {t('noProject.forgetFailed')}
        </p>
      )}
      {error !== undefined && (
        <p role="alert" data-testid="recent-project-error" className="text-sm text-danger">
          {error}
        </p>
      )}
    </section>
  );
}
