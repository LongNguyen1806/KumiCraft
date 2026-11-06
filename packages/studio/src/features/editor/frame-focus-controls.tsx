// Controls of "one frame at a time": ‹ › at the Canvas edges, a pager under the frame (position,
// jump list, back to side by side), and one status message per step for screen readers.
import { type Frame, type LoginSession, shortcutLabel } from '@kumicraft/shared';
import { ChevronLeft, ChevronRight, LayoutGrid } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { isApplePlatform } from '../../app/platform.ts';
import { useCanvasViewStore } from './canvas-view-store.ts';
import { exitFrameFocus, focusFrame, stepFrame, useFrameFocusActive } from './frame-focus-store.ts';
import { sessionLabel } from './session-popover.tsx';

type FrameFocusControlsProps = {
  readonly frames: readonly Frame[];
  readonly sessions: readonly LoginSession[];
  readonly sessionEnabled: boolean;
};

const ROUND =
  'grid place-items-center rounded-full border border-border bg-card-solid/85 text-ink shadow-md backdrop-blur-md transition-colors hover:bg-field-hover focus-visible:ring-2 focus-visible:ring-primary/60 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-35';

/** "Mobile · Session 2" for frame `index` of the open frames. */
function useFrameNames(props: FrameFocusControlsProps) {
  const { t } = useTranslation();
  const openFrames = useCanvasViewStore((s) => s.openFrames);
  return openFrames.map((of) => {
    const preset = props.frames.find((f) => f.id === of.frameId);
    const session = props.sessions.find((s) => s.id === of.sessionId);
    return {
      id: of.id,
      name: preset?.label ?? of.frameId,
      session:
        props.sessionEnabled && session !== undefined
          ? sessionLabel(t, session)
          : t('sessions.defaultLabel', { id: 1 }),
    };
  });
}

function EdgeButton({
  side,
  disabled,
}: {
  readonly side: 'prev' | 'next';
  readonly disabled: boolean;
}) {
  const { t } = useTranslation();
  const label = side === 'prev' ? t('editor.framePrev') : t('editor.frameNext');
  return (
    <button
      type="button"
      data-testid={`frame-focus-${side}`}
      aria-label={label}
      title={`${label} (${shortcutLabel(side === 'prev' ? 'framePrev' : 'frameNext', isApplePlatform())})`}
      disabled={disabled}
      onClick={() => {
        stepFrame(side === 'prev' ? -1 : 1);
      }}
      className={`${ROUND} pointer-events-auto absolute top-1/2 size-10 -translate-y-1/2 ${
        side === 'prev' ? 'left-3' : 'right-3'
      }`}
    >
      {side === 'prev' ? <ChevronLeft className="size-5" /> : <ChevronRight className="size-5" />}
    </button>
  );
}

/** The frame list of the pager: pick one to jump straight to it. */
function FrameJump({
  names,
  currentId,
}: {
  readonly names: ReturnType<typeof useFrameNames>;
  readonly currentId?: string | undefined;
}) {
  const { t } = useTranslation();
  const setActive = useCanvasViewStore((s) => s.setActiveOpenFrameId);
  const zoomFit = useCanvasViewStore((s) => s.zoomFit);
  return (
    <>
      <label className="sr-only" htmlFor="frame-focus-jump">
        {t('editor.frameJump')}
      </label>
      <select
        id="frame-focus-jump"
        data-testid="frame-focus-jump"
        value={currentId ?? ''}
        onChange={(e) => {
          setActive(e.target.value);
          zoomFit();
        }}
        className="max-w-72 min-w-0 rounded-full bg-transparent py-1 pr-7 pl-2 font-medium hover:bg-field-hover focus-visible:ring-2 focus-visible:ring-primary/60 focus-visible:outline-none"
      >
        {names.map((n, i) => (
          <option key={n.id} value={n.id}>
            {t('editor.frameOption', { n: i + 1, name: n.name, session: n.session })}
          </option>
        ))}
      </select>
    </>
  );
}

function Pager({
  names,
  index,
}: {
  readonly names: ReturnType<typeof useFrameNames>;
  readonly index: number;
}) {
  const { t } = useTranslation();
  const current = names[index];
  return (
    <div
      data-testid="frame-focus-pager"
      className="pointer-events-auto absolute bottom-4 left-1/2 flex -translate-x-1/2 items-center gap-1 rounded-full border border-border bg-card-solid/90 p-1 text-xs text-ink shadow-lg backdrop-blur-md"
    >
      <span className="px-2 font-mono text-[11px] text-ink-soft" data-testid="frame-focus-position">
        {index + 1} / {names.length}
      </span>
      <FrameJump names={names} currentId={current?.id} />
      <span aria-hidden className="mx-1 h-4 w-px bg-border" />
      <button
        type="button"
        data-testid="frame-focus-exit"
        title={`${t('editor.frameFocusOff')} (Esc)`}
        onClick={() => {
          exitFrameFocus();
        }}
        className="flex items-center gap-1 rounded-full px-2.5 py-1 font-medium hover:bg-field-hover focus-visible:ring-2 focus-visible:ring-primary/60 focus-visible:outline-none"
      >
        <LayoutGrid aria-hidden className="size-3.5" />
        {t('editor.frameLayoutRow')}
      </button>
    </div>
  );
}

/** Drawn over the Canvas while one frame at a time is on; nothing otherwise. */
export function FrameFocusControls(props: FrameFocusControlsProps) {
  const { t } = useTranslation();
  const active = useFrameFocusActive();
  const activeId = useCanvasViewStore((s) => s.activeOpenFrameId);
  const names = useFrameNames(props);
  if (!active) return undefined;
  const index = Math.max(
    0,
    names.findIndex((n) => n.id === activeId),
  );
  const current = names[index];
  return (
    <div className="pointer-events-none absolute inset-0 z-30" data-testid="frame-focus-controls">
      <EdgeButton side="prev" disabled={index === 0} />
      <EdgeButton side="next" disabled={index >= names.length - 1} />
      <Pager names={names} index={index} />
      <p role="status" className="sr-only" data-testid="frame-focus-status">
        {current === undefined
          ? ''
          : t('editor.frameAnnounce', {
              n: index + 1,
              total: names.length,
              name: current.name,
              session: current.session,
            })}
      </p>
    </div>
  );
}

function LayoutItem({ on, label }: { readonly on: boolean; readonly label: string }) {
  const active = useFrameFocusActive();
  const activeId = useCanvasViewStore((s) => s.activeOpenFrameId);
  const shortcut = shortcutLabel('toggleFrameFocus', isApplePlatform());
  return (
    <button
      type="button"
      data-testid={on ? 'frame-layout-focus' : 'frame-layout-row'}
      aria-pressed={active === on}
      onClick={() => {
        if (on === active) return;
        if (on) focusFrame(activeId);
        else exitFrameFocus();
      }}
      title={`${label} (${shortcut})`}
      className={`rounded px-2 py-0.5 text-xs focus-visible:ring-2 focus-visible:ring-primary/60 focus-visible:outline-none ${
        active === on ? 'bg-ink text-card font-medium' : 'text-ink hover:bg-field-hover'
      }`}
    >
      {label}
    </button>
  );
}

/** "Side by side | One at a time" in the status bar, from two frames up. */
export function FrameLayoutSwitch() {
  const { t } = useTranslation();
  const count = useCanvasViewStore((s) => s.openFrames.length);
  if (count < 2) return undefined;
  return (
    <div
      role="group"
      aria-label={t('editor.frameLayoutLabel')}
      className="flex items-center gap-0.5 rounded-md border border-border bg-field p-0.5"
    >
      <LayoutItem on={false} label={t('editor.frameLayoutRow')} />
      <LayoutItem on label={t('editor.frameLayoutFocus')} />
    </div>
  );
}
