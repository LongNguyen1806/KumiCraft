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

function resolveDraftHistoryLabel(key: string, name: string, t: TFunction): string | undefined {
  if (key === 'history:draftCreate' || key === 'history.draftCreate') {
    return t('history.draftCreate', { name });
  }
  if (key === 'history:draftRename' || key === 'history.draftRename') {
    return t('history.draftRename', { name });
  }
  if (key === 'history:draftDuplicate' || key === 'history.draftDuplicate') {
    return t('history.draftDuplicate', { name });
  }
  if (key === 'history:draftDelete' || key === 'history.draftDelete') {
    return t('history.draftDelete', { name });
  }
  if (key === 'history:draftPromote' || key === 'history.draftPromote') {
    return t('history.draftPromote', { name });
  }
  return undefined;
}

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

function resolveHistoryLabel(label: HistoryLabel | undefined, t: TFunction): string | undefined {
  if (label === undefined) return undefined;
  const name = label.params?.['name'] ?? '';
  const draft = resolveDraftHistoryLabel(label.key, name, t);
  if (draft !== undefined) return draft;
  const theme = resolveThemeHistoryLabel(label, name, t);
  if (theme !== undefined) return theme;
  if (label.key === 'history:setClassName' || label.key === 'history.setClassName') {
    return t('history.setClassName');
  }
  if (label.key === 'history:setText' || label.key === 'history.setText') {
    return t('history.setText');
  }
  if (label.key === 'history:setAttribute' || label.key === 'history.setAttribute') {
    const tag = label.params?.['tag'] ?? '';
    return t('history.setAttribute', { tag });
  }
  if (label.key === 'history:pageAdd' || label.key === 'history.pageAdd') {
    return t('history.pageAdd', { name });
  }
  if (label.key === 'history:pageRename' || label.key === 'history.pageRename') {
    return t('history.pageRename', { name });
  }
  if (label.key === 'history:pageDelete' || label.key === 'history.pageDelete') {
    return t('history.pageDelete', { name });
  }
  if (label.key === 'history:extract' || label.key === 'history.extract') {
    return t('history.extract', { name });
  }
  if (label.key === 'history:insertImage' || label.key === 'history.insertImage') {
    return t('history.insertImage', { name });
  }
  if (label.key === 'history:routerInstall' || label.key === 'history.routerInstall') {
    return t('history.routerInstall');
  }
  return label.key;
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
    <header className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2.5 whitespace-nowrap">
      <div className="flex min-w-0 items-center gap-2.5 [&>*]:shrink-0">
        <div className="flex h-10 max-w-[24rem] min-w-[9rem] !shrink items-center gap-2 rounded-full border-[1.5px] border-charcoal px-[18px] text-[17px] tracking-tight">
          {t('app.name')}
          <span
            className="min-w-0 truncate text-xs text-ink-faint"
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
            className="h-10 rounded-full border border-border bg-field px-4 text-xs font-medium text-ink hover:bg-field-hover"
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
      <div className="flex min-w-0 items-center justify-end gap-2.5 [&>*]:shrink-0">
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
      className="grid size-10 place-items-center rounded-full bg-card text-ink shadow-soft backdrop-blur-md transition-transform hover:-translate-y-px disabled:text-ink-faint disabled:hover:translate-y-0 aria-[pressed=false]:bg-transparent aria-[pressed=false]:text-ink-soft aria-[pressed=false]:shadow-[inset_0_0_0_1.5px_var(--color-line)]"
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
