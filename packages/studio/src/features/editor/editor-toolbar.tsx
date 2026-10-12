import type { Frame } from '@reactcraft/model';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

import { LanguageSwitcher } from '../../app/language-switcher.tsx';
import {
  CodeIcon,
  PanelLeftIcon,
  PanelRightIcon,
  RedoIcon,
  UndoIcon,
} from '../../components/ui/icons.tsx';
import type { Side } from './use-panel-layout.ts';

export type EditorToolbarProps = {
  readonly workspaceName: string;
  readonly pages: readonly { readonly id: string; readonly name: string }[];
  readonly activePageId: string | undefined;
  readonly onPage: (pageId: string) => void;
  readonly frames: readonly Frame[];
  readonly activeFrameId: string;
  readonly onFrame: (frameId: string) => void;
  readonly zoomPercent: number;
  readonly canUndo: boolean;
  readonly canRedo: boolean;
  readonly onUndo: () => void;
  readonly onRedo: () => void;
  readonly visible: Readonly<Record<Side, boolean>>;
  readonly onToggle: (side: Side) => void;
};

/** Top row of the Editor (SPEC-04.1 section 6.2), as in the approved mockup. */
export function EditorToolbar(props: EditorToolbarProps) {
  const { t } = useTranslation();
  return (
    <header className="flex items-center gap-2.5">
      <div className="flex h-10 items-center gap-2 rounded-full border-[1.5px] border-charcoal px-[18px] text-[17px] tracking-tight">
        {t('app.name')}
        <span className="text-xs text-ink-faint">{props.workspaceName}</span>
      </div>
      <PanelToggle side="left" {...props} />
      <div className="flex h-10 items-center gap-0.5 rounded-full bg-card px-1 shadow-soft backdrop-blur-md">
        <PagePicker {...props} />
        <span className="mx-1 h-[18px] w-px bg-line" />
        <FramePicker {...props} />
        <span className="mx-1 h-[18px] w-px bg-line" />
        <span className="px-3 font-mono text-xs text-ink-soft" title={t('editor.zoomFit')}>
          {t('editor.zoom', { percent: props.zoomPercent })}
        </span>
      </div>
      <div className="flex-1" />
      <RoundButton label={t('editor.undo')} disabled={!props.canUndo} onClick={props.onUndo}>
        <UndoIcon />
      </RoundButton>
      <RoundButton label={t('editor.redo')} disabled={!props.canRedo} onClick={props.onRedo}>
        <RedoIcon />
      </RoundButton>
      <LanguageSwitcher />
      <button
        type="button"
        disabled
        title={t('editor.exportLater')}
        className="flex h-10 items-center gap-2 rounded-full bg-sun px-[18px] font-medium text-ink disabled:opacity-55"
      >
        <CodeIcon />
        {t('editor.exportCode')}
      </button>
      <PanelToggle side="right" {...props} />
    </header>
  );
}

type RoundButtonProps = {
  readonly label: string;
  readonly onClick: () => void;
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
      label={t(side === 'left' ? 'editor.toggleLeft' : 'editor.toggleRight')}
      pressed={visible[side]}
      onClick={() => {
        onToggle(side);
      }}
    >
      {side === 'left' ? <PanelLeftIcon /> : <PanelRightIcon />}
    </RoundButton>
  );
}

function PagePicker({ pages, activePageId, onPage }: EditorToolbarProps) {
  const { t } = useTranslation();
  return (
    <label className="flex h-8 items-center gap-1.5 rounded-full pl-3.5 text-ink-soft">
      {t('editor.page')}
      <select
        value={activePageId}
        onChange={(event) => {
          onPage(event.target.value);
        }}
        className="h-8 rounded-full bg-transparent pr-2 text-ink"
        data-testid="page-picker"
      >
        {pages.map((page) => (
          <option key={page.id} value={page.id}>
            {page.name}
          </option>
        ))}
      </select>
    </label>
  );
}

function FramePicker({ frames, activeFrameId, onFrame }: EditorToolbarProps) {
  const { t } = useTranslation();
  return (
    <div role="group" aria-label={t('editor.frames')} className="flex gap-0.5">
      {frames.map((frame) => (
        <button
          key={frame.id}
          type="button"
          aria-pressed={frame.id === activeFrameId}
          onClick={() => {
            onFrame(frame.id);
          }}
          className="flex h-8 items-center gap-1.5 rounded-full px-3.5 text-ink-soft transition-colors hover:bg-field hover:text-ink aria-pressed:bg-charcoal aria-pressed:text-on-charcoal"
        >
          {frame.label}
          <span className="font-mono text-xs opacity-60">{frame.width}</span>
        </button>
      ))}
    </div>
  );
}
