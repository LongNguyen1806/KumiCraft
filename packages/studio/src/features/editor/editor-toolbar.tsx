import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

import { LanguageSwitcher } from '../../app/language-switcher.tsx';
import { shortcutLabel } from '../../app/platform.ts';
import { PanelLeftIcon, PanelRightIcon, RedoIcon, UndoIcon } from '../../components/ui/icons.tsx';
import { SettingsButton } from '../settings/settings-button.tsx';
import type { Side } from './use-panel-layout.ts';

export type EditorToolbarProps = {
  readonly projectName: string;
  readonly visible: Readonly<Record<Side, boolean>>;
  readonly onToggle: (side: Side) => void;
};

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
      <PanelToggle side="left" {...props} />
      <div className="flex-1" />
      <RoundButton label={t('editor.undo', { shortcut: shortcutLabel('undo') })} disabled>
        <UndoIcon />
      </RoundButton>
      <RoundButton label={t('editor.redo', { shortcut: shortcutLabel('redo') })} disabled>
        <RedoIcon />
      </RoundButton>
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
