import type { DesignNode, WorkspaceMeta } from '@reactcraft/model';
import { useTranslation } from 'react-i18next';

import type { SyncNotice, SyncStatus } from '../../store/editor-store.ts';

const DOT: Record<SyncStatus, string> = {
  saved: 'bg-leaf',
  saving: 'bg-sun animate-pulse',
  error: 'bg-danger',
  external_conflict: 'bg-danger',
};

type StatusBarProps = {
  readonly status: SyncStatus;
  /** Why the Studio just reloaded the document (SPEC-04.1 section 13.2). */
  readonly notice: SyncNotice | undefined;
  readonly revision: number;
  /** From the page root to the selected node. */
  readonly path: readonly DesignNode[];
  readonly workspace: WorkspaceMeta;
};

/** Save state, revision and the selected node (SPEC-04.1 R-SH-03). */
export function StatusBar({ status, notice, revision, path, workspace }: StatusBarProps) {
  const { t } = useTranslation();
  return (
    <footer className="flex h-[34px] items-center gap-4 overflow-hidden rounded-full bg-card px-4 text-xs whitespace-nowrap text-ink-soft shadow-soft">
      <span role="status" className="flex items-center gap-2" data-testid="sync-status">
        <span className={`size-2 rounded-full ${DOT[status]}`} />
        {t(`editor.sync.${status}`)}
      </span>
      {notice !== undefined && (
        <span role="alert" className="rounded-full bg-sun-soft px-2.5 py-0.5 text-ink">
          {t(`editor.notice.${notice}`)}
        </span>
      )}
      <span className="font-mono">{t('editor.revision', { revision })}</span>
      <span className="min-w-0 truncate" data-testid="breadcrumb">
        {path.map((node, index) => (
          <span key={node.id}>
            {index > 0 && <span className="px-1 text-ink-faint">›</span>}
            <span className={index === path.length - 1 ? 'font-medium text-ink' : ''}>
              {node.type}
            </span>
          </span>
        ))}
      </span>
      <span className="flex-1" />
      <span className="rounded-full bg-field px-2.5 py-0.5">
        {t(`editor.mode.${workspace.responsiveMode}`)}
      </span>
      <span className="rounded-full bg-field px-2.5 py-0.5 font-mono">
        {workspace.contentLocale}
      </span>
    </footer>
  );
}
