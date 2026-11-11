// A single frame tile on multi-frame Canvas (SPEC-04 M-MF).
import { type Frame, type LoginSession, sessionOrigin } from '@kumicraft/shared';
import { Maximize2, Minimize2, X } from 'lucide-react';
import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';

import type { CanvasMode } from '../selection/selection-store.ts';
import { IframeFrame } from './canvas-frame.tsx';
import { frameTileWidth } from './canvas-zoom.tsx';
import { exitFrameFocus, focusFrame, useFrameFocusStore } from './frame-focus-store.ts';
import type { OpenFrame } from './open-frames-storage.ts';
import { SessionSelect } from './session-select.tsx';

export type CanvasFrameTileProps = {
  readonly openFrame: OpenFrame;
  readonly preset: Frame;
  readonly isActive: boolean;
  readonly isOnlyFrame: boolean;
  /** One frame at a time is on (two or more frames). */
  readonly focusMode: boolean;
  readonly zoom: number;
  readonly mode: CanvasMode;
  readonly runnerOrigin: string;
  readonly nonce?: string | undefined;
  readonly logTail: readonly string[];
  readonly draftFile?: string | undefined;
  readonly reloadTick?: number | undefined;
  readonly sessions: readonly LoginSession[];
  readonly sessionEnabled: boolean;
  readonly onSelect: (id: string) => void;
  readonly onClose: (id: string) => void;
  readonly onUpdateSession: (id: string, sessionId: number) => void;
  readonly onSessionsUpdated: (sessions: readonly LoginSession[]) => void;
};

type FrameTileHeaderProps = {
  readonly openFrame: OpenFrame;
  readonly preset: Frame;
  readonly isOnlyFrame: boolean;
  readonly focusMode: boolean;
  readonly runnerOrigin: string;
  readonly sessions: readonly LoginSession[];
  readonly sessionEnabled: boolean;
  readonly onSelect: (id: string) => void;
  readonly onClose: (id: string) => void;
  readonly onUpdateSession: (id: string, sessionId: number) => void;
  readonly onSessionsUpdated: (sessions: readonly LoginSession[]) => void;
};

function FrameTileHeader(props: FrameTileHeaderProps) {
  const { openFrame, preset, isOnlyFrame, runnerOrigin, sessions, sessionEnabled } = props;

  return (
    <div
      className="flex h-7 min-w-0 items-center justify-between gap-2 overflow-hidden rounded-t-md border-b border-line bg-card-solid px-2.5 text-xs select-none"
      data-testid={`canvas-frame-header-${openFrame.id}`}
      onPointerDown={() => {
        props.onSelect(openFrame.id);
      }}
      onDoubleClick={() => {
        if (isOnlyFrame) return;
        if (props.focusMode) exitFrameFocus();
        else focusFrame(openFrame.id);
      }}
    >
      <div className="flex min-w-0 items-center gap-2">
        <span className="truncate font-medium text-ink" data-testid={`frame-label-${openFrame.id}`}>
          {preset.label}
        </span>
        <span className="truncate font-mono text-[11px] text-ink-soft">
          {preset.width}×{preset.height}
        </span>
        {sessionEnabled && (
          <SessionSelect
            sessions={sessions}
            activeSessionId={openFrame.sessionId}
            runnerOrigin={runnerOrigin}
            onSelectSession={(sid) => {
              props.onUpdateSession(openFrame.id, sid);
            }}
            onSessionsUpdated={props.onSessionsUpdated}
          />
        )}
      </div>
      <div className="flex shrink-0 items-center gap-0.5">
        {!isOnlyFrame && (
          <FocusToggleButton openFrameId={openFrame.id} focusMode={props.focusMode} />
        )}
        <CloseFrameButton {...props} />
      </div>
    </div>
  );
}

/** ⤢ shows only this frame; ⤡ goes back to side by side. */
function FocusToggleButton({
  openFrameId,
  focusMode,
}: {
  readonly openFrameId: string;
  readonly focusMode: boolean;
}) {
  const { t } = useTranslation();
  const label = focusMode ? t('editor.frameFocusOff') : t('editor.frameFocusOn');
  return (
    <button
      type="button"
      data-testid="frame-focus-btn"
      aria-pressed={focusMode}
      aria-label={label}
      title={`${label} (Shift+2)`}
      onPointerDown={(e) => {
        e.stopPropagation();
      }}
      onClick={() => {
        if (focusMode) exitFrameFocus();
        else focusFrame(openFrameId);
      }}
      className="rounded p-0.5 text-ink-soft hover:bg-field hover:text-ink focus-visible:ring-2 focus-visible:ring-primary/60 focus-visible:outline-none"
    >
      {focusMode ? <Minimize2 className="size-3.5" /> : <Maximize2 className="size-3.5" />}
    </button>
  );
}

function CloseFrameButton(props: FrameTileHeaderProps) {
  const { t } = useTranslation();
  const { openFrame, isOnlyFrame } = props;
  return (
    <button
      type="button"
      disabled={isOnlyFrame}
      onClick={(e) => {
        e.stopPropagation();
        props.onClose(openFrame.id);
      }}
      data-testid="close-frame-btn"
      aria-label={t('editor.closeFrame')}
      title={isOnlyFrame ? t('editor.cannotCloseLastFrame') : t('editor.closeFrame')}
      className="rounded p-0.5 text-ink-soft hover:bg-field hover:text-ink disabled:cursor-not-allowed disabled:opacity-30"
    >
      <X className="size-3.5" />
    </button>
  );
}

/**
 * Stepping to another frame slides the new one in from the side it came from (180 ms). A new step
 * cancels the running slide; reduced motion shows the frame at once.
 */
function useSlideIn(el: { readonly current?: HTMLElement | undefined }, run: boolean) {
  const direction = useFrameFocusStore((s) => s.direction);
  useEffect(() => {
    const node = el.current;
    if (!run || direction === 0 || node === undefined || typeof node.animate !== 'function') return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    for (const running of node.getAnimations()) running.cancel();
    node.animate(
      [
        { transform: `translateX(${String(direction * 48)}px)`, opacity: 0.35 },
        { transform: 'none', opacity: 1 },
      ],
      { duration: 180, easing: 'cubic-bezier(0.2, 0.8, 0.2, 1)' },
    );
  }, [el, run, direction]);
}

export function CanvasFrameTile(props: CanvasFrameTileProps) {
  const { openFrame, preset, isActive, zoom, runnerOrigin, sessionEnabled } = props;
  const effectiveSessionId = sessionEnabled ? openFrame.sessionId : 1;
  const effectiveOrigin = sessionOrigin(runnerOrigin, effectiveSessionId);
  const root = useRef<HTMLDivElement>(undefined);
  // One frame at a time: the others stay mounted (no reload, sign-in kept), just out of sight.
  const hidden = props.focusMode && !isActive;
  useSlideIn(root, props.focusMode && isActive);

  return (
    <div
      ref={(el) => {
        root.current = el ?? undefined;
      }}
      data-testid={`canvas-frame-tile-${openFrame.id}`}
      data-hidden={hidden ? 'true' : undefined}
      aria-hidden={hidden ? true : undefined}
      inert={hidden}
      onPointerDown={() => {
        props.onSelect(openFrame.id);
      }}
      style={tileStyle(frameTileWidth(preset.width, zoom), hidden)}
      className={`relative flex shrink-0 flex-col rounded-md border transition-shadow ${
        isActive
          ? 'border-accent shadow-md ring-2 ring-accent/30'
          : 'border-border shadow-sm hover:border-ink-faint'
      }`}
    >
      <FrameTileHeader
        openFrame={openFrame}
        preset={preset}
        isOnlyFrame={props.isOnlyFrame}
        focusMode={props.focusMode}
        runnerOrigin={runnerOrigin}
        sessions={props.sessions}
        sessionEnabled={props.sessionEnabled}
        onSelect={props.onSelect}
        onClose={props.onClose}
        onUpdateSession={props.onUpdateSession}
        onSessionsUpdated={props.onSessionsUpdated}
      />
      <TileBody {...props} origin={effectiveOrigin} />
    </div>
  );
}

/** The tile's width; a hidden tile keeps its page loaded but takes no room and no pointer. */
function tileStyle(width: number, hidden: boolean): React.CSSProperties {
  const base = { width: `${String(width)}px` };
  return hidden
    ? {
        ...base,
        position: 'absolute',
        left: 0,
        top: 0,
        visibility: 'hidden',
        pointerEvents: 'none',
      }
    : base;
}

function TileBody(props: CanvasFrameTileProps & { readonly origin: string }) {
  const { openFrame, preset, zoom, runnerOrigin } = props;
  return (
    // A frame narrower than the title bar sits in the middle of its tile.
    <div className="flex justify-center overflow-hidden rounded-b-md bg-card-solid">
      <IframeFrame
        key={`${runnerOrigin}|${props.nonce ?? ''}|${props.draftFile ?? ''}|${String(props.reloadTick ?? 0)}`}
        origin={props.origin}
        frame={preset}
        zoom={zoom}
        nonce={props.nonce}
        mode={props.mode}
        logTail={props.logTail}
        draftFile={props.draftFile}
        openFrameId={openFrame.id}
        route={openFrame.route}
      />
    </div>
  );
}
