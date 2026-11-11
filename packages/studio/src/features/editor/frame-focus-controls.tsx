// Controls of "one frame at a time": a pager in the middle of the app's top bar (‹, position,
// jump list, ›, back to side by side), so nothing sits on the Canvas while editing (owner
// 2026-11-06), and one status message per step for screen readers.
import {
  DEFAULT_LOGIN_SESSIONS,
  type Frame,
  type LoginSession,
  shortcutLabel,
} from '@kumicraft/shared';
import { ChevronLeft, ChevronRight, LayoutGrid, Square } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { isApplePlatform } from '../../app/platform.ts';
import { useSettingsStore } from '../../store/settings-store.ts';
import { useProjectInfo } from '../project/project-store.ts';
import { useCanvasViewStore } from './canvas-view-store.ts';
import { exitFrameFocus, focusFrame, stepFrame, useFrameFocusActive } from './frame-focus-store.ts';
import { sessionLabel } from './session-popover.tsx';

type FrameFocusControlsProps = {
  readonly frames: readonly Frame[];
  readonly sessions: readonly LoginSession[];
  readonly sessionEnabled: boolean;
};

const ROUND =
  'grid shrink-0 place-items-center rounded-[5px] text-ink-soft transition-colors hover:bg-card-solid hover:text-ink focus-visible:ring-2 focus-visible:ring-accent/60 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-35 disabled:hover:bg-transparent aria-[pressed=true]:bg-card-solid aria-[pressed=true]:text-accent aria-[pressed=true]:shadow-[0_0_0_1px_var(--color-line)]';

/** Frames and sessions as the Canvas has them, for the toolbar pager that gets no props. */
function useNameSources(): FrameFocusControlsProps {
  const frames = useCanvasViewStore((s) => s.frames);
  const project = useProjectInfo();
  const sessionEnabled = useSettingsStore((s) => s.settings?.loginSessions === true);
  return { frames, sessions: project?.sessions ?? DEFAULT_LOGIN_SESSIONS, sessionEnabled };
}

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

function StepButton({
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
      className={`${ROUND} size-6`}
    >
      {side === 'prev' ? <ChevronLeft className="size-4" /> : <ChevronRight className="size-4" />}
    </button>
  );
}

/** The frame list of the pager: pick one to jump straight to it. */
function FrameJump({
  names,
  currentId,
  disabled,
}: {
  readonly names: ReturnType<typeof useFrameNames>;
  readonly currentId?: string | undefined;
  readonly disabled: boolean;
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
        disabled={disabled}
        id="frame-focus-jump"
        data-testid="frame-focus-jump"
        value={currentId ?? ''}
        onChange={(e) => {
          setActive(e.target.value);
          zoomFit();
        }}
        className="h-6 max-w-72 min-w-0 rounded-[5px] bg-transparent py-0 pr-7 pl-2 font-medium hover:bg-card-solid focus-visible:ring-2 focus-visible:ring-accent/60 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent"
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
    <div className="sr-only" data-testid="frame-focus-controls">
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

/**
 * One button for the frame view: ⊞ (side by side) shows several frames, ▢ (one at a time) shows the
 * working frame alone. The icon shows what a click turns on; the pressed state says which is on.
 */
function FrameViewToggle({ focus }: { readonly focus: boolean }) {
  const { t } = useTranslation();
  const activeId = useCanvasViewStore((s) => s.activeOpenFrameId);
  const label = focus ? t('editor.frameFocusOff') : t('editor.frameLayoutFocus');
  const shortcut = shortcutLabel('toggleFrameFocus', isApplePlatform());
  return (
    <button
      type="button"
      data-testid="frame-layout-toggle"
      aria-pressed={focus}
      aria-label={label}
      title={`${label} (${shortcut})`}
      onClick={() => {
        if (focus) exitFrameFocus();
        else focusFrame(activeId);
      }}
      className={`${ROUND} size-6`}
    >
      {focus ? (
        <LayoutGrid aria-hidden className="size-4" />
      ) : (
        <Square aria-hidden className="size-4" />
      )}
    </button>
  );
}

/**
 * Centred in the top bar from two frames up: ‹ position · jump list › and the view button. Side by
 * side the stepping parts stay in place, greyed out, so the bar never changes size.
 */
export function FramePager() {
  const active = useFrameFocusActive();
  const count = useCanvasViewStore((s) => s.openFrames.length);
  const activeId = useCanvasViewStore((s) => s.activeOpenFrameId);
  const names = useFrameNames(useNameSources());
  if (count < 2) return undefined;
  const index = Math.max(
    0,
    names.findIndex((n) => n.id === activeId),
  );
  return (
    <div
      data-testid="frame-focus-pager"
      className="flex h-[30px] shrink-0 items-center gap-0.5 rounded-[7px] border border-line bg-field px-1 text-xs text-ink"
    >
      {/* Always there, so the bar keeps its size; side by side only greys these out. */}
      <StepButton side="prev" disabled={!active || index === 0} />
      <span
        className={`px-1.5 font-mono text-[11px] text-ink-soft ${active ? '' : 'opacity-40'}`}
        data-testid="frame-focus-position"
      >
        {index + 1} / {names.length}
      </span>
      <FrameJump names={names} currentId={names[index]?.id} disabled={!active} />
      <StepButton side="next" disabled={!active || index >= names.length - 1} />
      <span aria-hidden className="mx-0.5 h-4 w-px bg-line" />
      <FrameViewToggle focus={active} />
    </div>
  );
}
