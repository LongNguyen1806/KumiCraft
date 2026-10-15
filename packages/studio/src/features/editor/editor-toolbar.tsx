import type { HistoryLabel } from '@reactcraft/shared';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

import { LanguageSwitcher } from '../../app/language-switcher.tsx';
import { shortcutLabel } from '../../app/platform.ts';
import { PanelLeftIcon, PanelRightIcon, RedoIcon, UndoIcon } from '../../components/ui/icons.tsx';
import { useHistoryStore } from '../history/history-store.ts';
import { SettingsButton } from '../settings/settings-button.tsx';
import type { Side } from './use-panel-layout.ts';

export type EditorToolbarProps = {
  readonly projectName: string;
  readonly visible: Readonly<Record<Side, boolean>>;
  readonly onToggle: (side: Side) => void;
  readonly onOpenProject?: () => void;
};

function resolveHistoryLabel(
  label: HistoryLabel | undefined,
  t: ReturnType<typeof useTranslation>['t'],
): string | undefined {
  if (label === undefined) return undefined;
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
    <header className="flex items-center gap-2.5 whitespace-nowrap [&>*]:shrink-0">
      <div className="flex h-10 max-w-[24rem] min-w-[9rem] !shrink items-center gap-2 rounded-full border-[1.5px] border-charcoal px-[18px] text-[17px] tracking-tight">
        {t('app.name')}
        <span
          className="min-w-0 truncate text-xs text-ink-faint"
          title={props.projectName}
          data-testid="project-name"
        >
          {props.projectName}
        </span>
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
      <div className="flex-1" />
      <HistoryButtons />
      <LanguageSwitcher />
      <SettingsButton />
      <PanelToggle side="right" {...props} />
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
