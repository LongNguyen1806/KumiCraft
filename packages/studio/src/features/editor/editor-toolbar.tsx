import type { HistoryLabel } from '@kumicraft/shared';
import type { TFunction } from 'i18next';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

import { shortcutLabel } from '../../app/platform.ts';
import { PanelLeftIcon, PanelRightIcon, RedoIcon, UndoIcon } from '../../components/ui/icons.tsx';
import { HistoryErrorNotice } from '../history/history-error-notice.tsx';
import { useHistoryStore } from '../history/history-store.ts';
import { FramePager } from './frame-focus-controls.tsx';
import { RunnerStatusBadge } from './runner-status-badge.tsx';
import type { Side } from './use-panel-layout.ts';

export type EditorToolbarProps = {
  readonly projectName: string;
  readonly visible: Readonly<Record<Side, boolean>>;
  readonly onToggle: (side: Side) => void;
  readonly onOpenProject?: () => void;
};

function resolveThemeHistoryLabel(
  label: HistoryLabel,
  name: string,
  t: TFunction,
): string | undefined {
  if (label.key !== 'history:theme' && label.key !== 'history.theme') return undefined;
  const op = label.params?.['op'];
  if (op === 'add') return t('history.themeAdd', { name });
  if (op === 'remove') return t('history.themeRemove', { name });
  return t('history.themeSet', { name });
}

/** Every history label kind the server sends that has words in `history.*`. */
const HISTORY_KINDS = [
  'setClassName',
  'setText',
  'setAttribute',
  'setStyle',
  'setFlag',
  'insert',
  'remove',
  'duplicate',
  'move',
  'wrap',
  'unwrap',
  'batch',
  'pageAdd',
  'pageRename',
  'pageDelete',
  'extract',
  'insertImage',
  'routerInstall',
  'draftCreate',
  'draftRename',
  'draftDuplicate',
  'draftDelete',
  'draftPromote',
  'fileCreate',
  'fileRename',
  'fileDelete',
] as const;
type HistoryKind = (typeof HISTORY_KINDS)[number];

function isHistoryKind(kind: string): kind is HistoryKind {
  return HISTORY_KINDS.some((k) => k === kind);
}

/**
 * The words for the server's history label `history:<kind>` (with its params); the raw key only
 * for a kind this Studio has no words for yet.
 */
export function resolveHistoryLabel(
  label: HistoryLabel | undefined,
  t: TFunction,
): string | undefined {
  if (label === undefined) return undefined;
  const name = label.params?.['name'] ?? '';
  const theme = resolveThemeHistoryLabel(label, name, t);
  if (theme !== undefined) return theme;
  const kind = label.key.replace(/^history[:.]/, '');
  return isHistoryKind(kind) ? t(`history.${kind}`, { ...label.params, name }) : label.key;
}

function HistoryButtons() {
  const { t } = useTranslation();
  const canUndo = useHistoryStore((s) => s.canUndo);
  const canRedo = useHistoryStore((s) => s.canRedo);
  const undoLabel = useHistoryStore((s) => s.undoLabel);
  const redoLabel = useHistoryStore((s) => s.redoLabel);
  const undo = useHistoryStore((s) => s.undo);
  const redo = useHistoryStore((s) => s.redo);

  const resolvedUndo = resolveHistoryLabel(undoLabel, t);
  const resolvedRedo = resolveHistoryLabel(redoLabel, t);

  const undoTooltip =
    resolvedUndo !== undefined
      ? t('editor.undoWithLabel', { label: resolvedUndo, shortcut: shortcutLabel('undo') })
      : t('editor.undo', { shortcut: shortcutLabel('undo') });

  const redoTooltip =
    resolvedRedo !== undefined
      ? t('editor.redoWithLabel', { label: resolvedRedo, shortcut: shortcutLabel('redo') })
      : t('editor.redo', { shortcut: shortcutLabel('redo') });

  return (
    <>
      <RoundButton
        label={undoTooltip}
        disabled={!canUndo}
        onClick={() => {
          void undo();
        }}
      >
        <UndoIcon />
      </RoundButton>
      <RoundButton
        label={redoTooltip}
        disabled={!canRedo}
        onClick={() => {
          void redo();
        }}
      >
        <RedoIcon />
      </RoundButton>
    </>
  );
}

/**
 * Top row of the Editor: project name, panels, Undo/Redo, language and settings. The frame picker
 * and zoom come with the Canvas (WP-1.04); Undo/Redo work from WP-1.06.
 */
export function EditorToolbar(props: EditorToolbarProps) {
  const { t } = useTranslation();

  return (
    // Three columns, the outer two equal: the pager sits in the very middle and never covers a
    // button; when room runs out the project name on the left shrinks first.
    <header className="grid h-11 shrink-0 grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2 border-b border-line bg-card-solid px-2.5 whitespace-nowrap">
      <div className="flex min-w-0 items-center gap-1.5 [&>*]:shrink-0">
        <div className="flex h-[30px] max-w-[24rem] min-w-[9rem] !shrink items-center gap-2 rounded-md border border-line pr-2.5 pl-1.5 text-[13px] font-semibold">
          <span
            aria-hidden
            className="grid size-5 shrink-0 place-items-center rounded-[5px] bg-sun text-[11px] font-bold text-on-sun"
          >
            K
          </span>
          <span>{t('app.name')}</span>
          <span
            className="min-w-0 truncate font-mono text-[11.5px] font-normal text-ink-soft"
            title={props.projectName}
            data-testid="project-name"
          >
            {props.projectName}
          </span>
          <RunnerStatusBadge />
        </div>
        {props.onOpenProject !== undefined && (
          <button
            type="button"
            onClick={props.onOpenProject}
            className="h-7 rounded-md border border-line bg-card-solid px-2.5 text-xs font-medium text-ink hover:bg-field"
            data-testid="project-btn"
          >
            {t('project.button')}
          </button>
        )}
        <PanelToggle side="left" {...props} />
      </div>
      {/* Always there, so the right group keeps its column when no pager is shown. */}
      <div className="flex justify-center">
        <FramePager />
      </div>
      <div className="flex min-w-0 items-center justify-end gap-1 [&>*]:shrink-0">
        <HistoryErrorNotice />
        <HistoryButtons />
        <PanelToggle side="right" {...props} />
      </div>
    </header>
  );
}

type RoundButtonProps = {
  readonly label: string;
  readonly onClick?: () => void;
  readonly disabled?: boolean;
  readonly pressed?: boolean;
  readonly children: ReactNode;
};

function RoundButton({ label, onClick, disabled = false, pressed, children }: RoundButtonProps) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={disabled}
      {...(pressed === undefined ? {} : { 'aria-pressed': pressed })}
      onClick={onClick}
      className="grid size-7 place-items-center rounded-md border border-transparent text-ink-soft transition-colors hover:bg-field hover:text-ink disabled:opacity-40 disabled:hover:bg-transparent aria-[pressed=true]:border-line aria-[pressed=true]:bg-field aria-[pressed=true]:text-ink"
    >
      {children}
    </button>
  );
}

function PanelToggle({
  side,
  visible,
  onToggle,
}: Pick<EditorToolbarProps, 'visible' | 'onToggle'> & { readonly side: Side }) {
  const { t } = useTranslation();
  return (
    <RoundButton
      label={t(side === 'left' ? 'editor.toggleLeft' : 'editor.toggleRight', {
        shortcut: shortcutLabel('panels'),
      })}
      pressed={visible[side]}
      onClick={() => {
        onToggle(side);
      }}
    >
      {side === 'left' ? <PanelLeftIcon /> : <PanelRightIcon />}
    </RoundButton>
  );
}
