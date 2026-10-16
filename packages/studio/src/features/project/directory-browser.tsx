import type { DirectoryListing } from '@reactcraft/shared';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { fetchDirectories } from '../../api/project-client.ts';

function WindowsDrivesBar({
  roots,
  onSelectPath,
}: {
  readonly roots: readonly string[];
  readonly onSelectPath: (path: string) => void;
}) {
  const { t } = useTranslation();
  return (
    <div className="flex items-center gap-1.5 overflow-x-auto text-xs" data-testid="windows-drives">
      <span className="text-ink-faint">{t('project.drives')}:</span>
      {roots.map((root) => (
        <button
          key={root}
          type="button"
          onClick={() => {
            onSelectPath(root);
          }}
          className="rounded bg-field px-2 py-1 font-mono hover:bg-field-hover text-ink"
        >
          {root}
        </button>
      ))}
    </div>
  );
}

type DirectoryPathBarProps = {
  readonly inputPath: string;
  readonly setInputPath: (path: string) => void;
  readonly parent?: string | undefined;
  readonly onSelectPath: (path: string) => void;
};

function DirectoryPathBar({
  inputPath,
  setInputPath,
  parent,
  onSelectPath,
}: DirectoryPathBarProps) {
  const { t } = useTranslation();
  return (
    <div className="flex items-center gap-2">
      {parent !== undefined && (
        <button
          type="button"
          onClick={() => {
            onSelectPath(parent);
          }}
          className="rounded-full bg-field px-3 py-1.5 text-xs text-ink-soft hover:text-ink shrink-0"
          data-testid="parent-dir-btn"
        >
          ↑
        </button>
      )}
      <input
        type="text"
        value={inputPath}
        onChange={(e) => {
          setInputPath(e.target.value);
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') onSelectPath(inputPath);
        }}
        className="flex-1 rounded-lg border border-border bg-field px-3 py-1.5 font-mono text-xs text-ink focus:outline-none focus:ring-1 focus:ring-primary"
        placeholder={t('project.pathLabel')}
        data-testid="path-input"
      />
      <button
        type="button"
        onClick={() => {
          onSelectPath(inputPath);
        }}
        className="rounded-lg bg-charcoal px-3 py-1.5 text-xs text-on-charcoal"
      >
        {t('project.go')}
      </button>
    </div>
  );
}

function DirectoryBreadcrumbs({
  currentPath,
  onSelectPath,
}: {
  readonly currentPath: string;
  readonly onSelectPath: (path: string) => void;
}) {
  const breadcrumbs = currentPath.replaceAll('\\', '/').split('/').filter(Boolean);
  return (
    <div className="flex flex-wrap items-center gap-1 text-xs text-ink-faint font-mono">
      {breadcrumbs.map((segment, index) => {
        const pathUpTo = breadcrumbs.slice(0, index + 1).join('/');
        const full = currentPath.startsWith('/') ? `/${pathUpTo}` : pathUpTo;
        return (
          <span key={full} className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => {
                onSelectPath(full);
              }}
              className="hover:underline text-ink-soft"
            >
              {segment}
            </button>
            {index < breadcrumbs.length - 1 && <span>/</span>}
          </span>
        );
      })}
    </div>
  );
}

function DirectoryEntriesList({
  loading,
  entries,
  onSelectPath,
}: {
  readonly loading: boolean;
  readonly entries?: DirectoryListing['entries'] | undefined;
  readonly onSelectPath: (path: string) => void;
}) {
  const { t } = useTranslation();
  if (loading) {
    return (
      <div className="max-h-48 overflow-y-auto rounded-lg border border-border bg-card p-1">
        <div className="p-3 text-center text-xs text-ink-faint">{t('project.loading')}</div>
      </div>
    );
  }

  return (
    <div className="max-h-48 overflow-y-auto rounded-lg border border-border bg-card p-1">
      {entries && entries.length > 0 ? (
        <div className="flex flex-col gap-0.5" data-testid="dir-entries">
          {entries.map((entry) => (
            <button
              key={entry.path}
              type="button"
              onClick={() => {
                onSelectPath(entry.path);
              }}
              className="flex items-center justify-between rounded px-2.5 py-1.5 text-left text-xs hover:bg-field-hover text-ink"
              data-testid={`dir-entry-${entry.name}`}
            >
              <span className="truncate">{entry.name}</span>
              {entry.isProject && (
                <span
                  className="rounded bg-primary-soft px-1.5 py-0.5 text-[10px] text-primary shrink-0"
                  data-testid="is-project-badge"
                >
                  {t('project.isProject')}
                </span>
              )}
            </button>
          ))}
        </div>
      ) : (
        <div className="p-3 text-center text-xs text-ink-faint">{t('project.noFolders')}</div>
      )}
    </div>
  );
}

function useDirectoryBrowserState(currentPath: string) {
  const [listing, setListing] = useState<DirectoryListing>();
  const [loading, setLoading] = useState(false);
  const [inputPath, setInputPath] = useState(currentPath);
  const [prevPath, setPrevPath] = useState(currentPath);

  if (currentPath !== prevPath) {
    setPrevPath(currentPath);
    setInputPath(currentPath);
  }

  useEffect(() => {
    let active = true;
    const load = async () => {
      setLoading(true);
      try {
        const res = await fetchDirectories(currentPath);
        if (active) setListing(res);
      } catch {
        // Handled silently or empty listing
      } finally {
        if (active) setLoading(false);
      }
    };
    void load();
    return () => {
      active = false;
    };
  }, [currentPath]);

  return { listing, loading, inputPath, setInputPath };
}

type DirectoryBrowserProps = {
  readonly currentPath: string;
  readonly onSelectPath: (path: string) => void;
};

export function DirectoryBrowser({ currentPath, onSelectPath }: DirectoryBrowserProps) {
  const { listing, loading, inputPath, setInputPath } = useDirectoryBrowserState(currentPath);

  return (
    <div className="flex flex-col gap-3" data-testid="directory-browser">
      {listing?.roots && listing.roots.length > 0 && (
        <WindowsDrivesBar roots={listing.roots} onSelectPath={onSelectPath} />
      )}
      <DirectoryPathBar
        inputPath={inputPath}
        setInputPath={setInputPath}
        parent={listing?.parent}
        onSelectPath={onSelectPath}
      />
      <DirectoryBreadcrumbs currentPath={currentPath} onSelectPath={onSelectPath} />
      <DirectoryEntriesList
        loading={loading}
        entries={listing?.entries}
        onSelectPath={onSelectPath}
      />
    </div>
  );
}
