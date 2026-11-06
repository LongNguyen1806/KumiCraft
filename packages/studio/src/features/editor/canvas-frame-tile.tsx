// A single frame tile on multi-frame Canvas (SPEC-04 M-MF).
import { type Frame, type LoginSession, sessionOrigin } from '@kumicraft/shared';
import { X } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import type { CanvasMode } from '../selection/selection-store.ts';
import { IframeFrame } from './canvas-frame.tsx';
import { frameTileWidth } from './canvas-zoom.tsx';
import type { OpenFrame } from './open-frames-storage.ts';
import { SessionSelect } from './session-select.tsx';

export type CanvasFrameTileProps = {
  readonly openFrame: OpenFrame;
  readonly preset: Frame;
  readonly isActive: boolean;
  readonly isOnlyFrame: boolean;
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
  readonly runnerOrigin: string;
  readonly sessions: readonly LoginSession[];
  readonly sessionEnabled: boolean;
  readonly onSelect: (id: string) => void;
  readonly onClose: (id: string) => void;
  readonly onUpdateSession: (id: string, sessionId: number) => void;
  readonly onSessionsUpdated: (sessions: readonly LoginSession[]) => void;
};

function FrameTileHeader(props: FrameTileHeaderProps) {
  const { t } = useTranslation();
  const { openFrame, preset, isOnlyFrame, runnerOrigin, sessions, sessionEnabled } = props;

  return (
    <div
      className="flex h-7 min-w-0 items-center justify-between gap-2 overflow-hidden rounded-t-lg border-b border-border bg-card/90 px-2.5 text-xs select-none"
      data-testid={`canvas-frame-header-${openFrame.id}`}
      onPointerDown={() => {
        props.onSelect(openFrame.id);
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
    </div>
  );
}

export function CanvasFrameTile(props: CanvasFrameTileProps) {
  const { openFrame, preset, isActive, zoom, runnerOrigin, sessionEnabled } = props;
  const effectiveSessionId = sessionEnabled ? openFrame.sessionId : 1;
  const effectiveOrigin = sessionOrigin(runnerOrigin, effectiveSessionId);

  return (
    <div
      data-testid={`canvas-frame-tile-${openFrame.id}`}
      onPointerDown={() => {
        props.onSelect(openFrame.id);
      }}
      style={{ width: `${String(frameTileWidth(preset.width, zoom))}px` }}
      className={`relative flex shrink-0 flex-col rounded-xl border transition-shadow ${
        isActive
          ? 'border-primary shadow-xl ring-2 ring-primary/40'
          : 'border-border/80 shadow-md hover:border-border'
      }`}
    >
      <FrameTileHeader
        openFrame={openFrame}
        preset={preset}
        isOnlyFrame={props.isOnlyFrame}
        runnerOrigin={runnerOrigin}
        sessions={props.sessions}
        sessionEnabled={props.sessionEnabled}
        onSelect={props.onSelect}
        onClose={props.onClose}
        onUpdateSession={props.onUpdateSession}
        onSessionsUpdated={props.onSessionsUpdated}
      />
      {/* A frame narrower than the title bar sits in the middle of its tile. */}
      <div className="flex justify-center overflow-hidden rounded-b-xl bg-card">
        <IframeFrame
          key={`${runnerOrigin}|${props.nonce ?? ''}|${props.draftFile ?? ''}|${String(props.reloadTick ?? 0)}`}
          origin={effectiveOrigin}
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
    </div>
  );
}
