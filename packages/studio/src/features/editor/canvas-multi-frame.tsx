// Multi-frame layout component for Canvas (SPEC-04 M-MF).
import type { Frame, LoginSession } from '@kumicraft/shared';

import { useFrameFocusActive } from '../../core/frame-focus-store.ts';
import type { OpenFrame } from '../../core/open-frames-storage.ts';
import type { CanvasMode } from '../../core/selection-store.ts';
import { CanvasFrameTile } from './canvas-frame-tile.tsx';

const FALLBACK_FRAME: Frame = { id: 'desktop', label: 'Desktop', width: 1280, height: 800 };

function resolveFramePreset(frames: readonly Frame[], frameId: string): Frame {
  return frames.find((f) => f.id === frameId) ?? frames[0] ?? FALLBACK_FRAME;
}

export type CanvasMultiFrameProps = {
  readonly openFrames: readonly OpenFrame[];
  readonly frames: readonly Frame[];
  readonly activeOpenFrameId: string;
  readonly zoom: number;
  readonly mode: CanvasMode;
  readonly runnerOrigin: string;
  readonly nonce?: string | undefined;
  readonly logTail: readonly string[];
  readonly reloadTick?: number | undefined;
  readonly sessions: readonly LoginSession[];
  readonly sessionEnabled: boolean;
  readonly onSelectFrame: (id: string) => void;
  readonly onCloseFrame: (id: string) => void;
  readonly onUpdateFrameSession: (id: string, sessionId: number) => void;
  readonly onSessionsUpdated: (sessions: readonly LoginSession[]) => void;
};

export function CanvasMultiFrame(props: CanvasMultiFrameProps) {
  const { openFrames, frames, activeOpenFrameId } = props;
  const isOnlyFrame = openFrames.length <= 1;
  const focusMode = useFrameFocusActive();

  return (
    <div
      data-testid="canvas-multi-frame"
      className="relative flex flex-row items-start gap-8 min-w-max p-8"
    >
      {openFrames.map((of) => {
        const preset = resolveFramePreset(frames, of.frameId);
        const isActive = of.id === activeOpenFrameId;
        return (
          <CanvasFrameTile
            key={of.id}
            openFrame={of}
            preset={preset}
            isActive={isActive}
            isOnlyFrame={isOnlyFrame}
            focusMode={focusMode}
            zoom={props.zoom}
            mode={props.mode}
            runnerOrigin={props.runnerOrigin}
            nonce={props.nonce}
            logTail={props.logTail}
            reloadTick={props.reloadTick}
            sessions={props.sessions}
            sessionEnabled={props.sessionEnabled}
            onSelect={props.onSelectFrame}
            onClose={props.onCloseFrame}
            onUpdateSession={props.onUpdateFrameSession}
            onSessionsUpdated={props.onSessionsUpdated}
          />
        );
      })}
    </div>
  );
}
