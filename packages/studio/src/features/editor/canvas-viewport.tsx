import { type Frame, type LoginSession, type RunnerStatus } from '@kumicraft/shared';
import { useEffect, useMemo, useRef } from 'react';

import { RuntimeErrorList } from '../canvas-errors/runtime-error-list.tsx';
import { useProjectInfo } from '../project/project-store.ts';
import type { CanvasMode } from '../selection/selection-store.ts';
import { CanvasMultiFrame } from './canvas-multi-frame.tsx';
import { CanvasPanSurface, PannedContent } from './canvas-pan.tsx';
import {
  ErrorView,
  NeedsInstallPrompt,
  StartingView,
  StoppedView,
  UntrustedPrompt,
} from './canvas-prompts.tsx';
import { useCanvasViewStore } from './canvas-view-store.ts';
import { fitZoomForFrames, useElementWidth, type Zoom } from './canvas-zoom.tsx';
import type { OpenFrame } from './open-frames-storage.ts';
import { useExpressPugReload } from './use-express-pug-reload.ts';

export type CanvasContentProps = {
  readonly status: RunnerStatus;
  readonly trusted: boolean;
  readonly needsInstall: boolean;
  readonly logTail: readonly string[];
  readonly frames: readonly Frame[];
  readonly openFrames: readonly OpenFrame[];
  readonly activeOpenFrameId: string;
  readonly zoom: number;
  readonly mode: CanvasMode;
  readonly sessions: readonly LoginSession[];
  readonly sessionEnabled: boolean;
  readonly onTrustRequest?: (() => void) | undefined;
  readonly onInstallRequest?: (() => void) | undefined;
  readonly onStart: () => void;
  readonly onRestart: () => void;
  readonly onSelectFrame: (id: string) => void;
  readonly onCloseFrame: (id: string) => void;
  readonly onUpdateFrameSession: (id: string, sessionId: number) => void;
  readonly onSessionsUpdated: (sessions: readonly LoginSession[]) => void;
};

export function CanvasContent(props: CanvasContentProps) {
  const draftFile = useCanvasViewStore((s) => s.draftFile);
  const project = useProjectInfo();
  const reloadTick = useExpressPugReload(project);

  if (!props.trusted) return <UntrustedPrompt onTrust={props.onTrustRequest} />;
  if (props.needsInstall) return <NeedsInstallPrompt onInstall={props.onInstallRequest} />;
  if (props.status.state === 'starting') return <StartingView />;
  if (props.status.state === 'stopped') return <StoppedView onStart={props.onStart} />;
  if (props.status.state === 'error' || props.status.state === 'crashed') {
    return <ErrorView status={props.status} logTail={props.logTail} onRestart={props.onRestart} />;
  }
  if (props.status.origin) {
    return (
      <CanvasMultiFrame
        openFrames={props.openFrames}
        frames={props.frames}
        activeOpenFrameId={props.activeOpenFrameId}
        zoom={props.zoom}
        mode={props.mode}
        runnerOrigin={props.status.origin}
        nonce={props.status.nonce}
        logTail={props.logTail}
        draftFile={draftFile}
        reloadTick={reloadTick}
        sessions={props.sessions}
        sessionEnabled={props.sessionEnabled}
        onSelectFrame={props.onSelectFrame}
        onCloseFrame={props.onCloseFrame}
        onUpdateFrameSession={props.onUpdateFrameSession}
        onSessionsUpdated={props.onSessionsUpdated}
      />
    );
  }
  return <></>;
}

export function CanvasViewport(props: Omit<CanvasContentProps, 'zoom'> & { readonly zoom: Zoom }) {
  const viewport = useRef<HTMLDivElement>(undefined);
  const width = useElementWidth(viewport);
  const frameWidths = useMemo(
    () =>
      props.openFrames.map(
        (of) => (props.frames.find((f) => f.id === of.frameId) ?? props.frames[0])?.width ?? 1280,
      ),
    [props.openFrames, props.frames],
  );
  const zoom = props.zoom === 'fit' ? fitZoomForFrames(width, frameWidths) : props.zoom;
  const setDisplayedZoom = useCanvasViewStore((st) => st.setDisplayedZoom);

  useEffect(() => {
    setDisplayedZoom(zoom);
  }, [zoom, setDisplayedZoom]);

  return (
    <div className="relative flex min-h-0 min-w-0 flex-1 flex-col">
      <div
        ref={(el) => {
          viewport.current = el ?? undefined;
        }}
        className="relative grid min-h-0 min-w-0 flex-1 place-items-center-safe overflow-auto p-4 [scrollbar-gutter:stable]"
        data-testid="canvas-placeholder"
      >
        <PannedContent>
          <CanvasContent {...props} zoom={zoom} />
        </PannedContent>
        <RuntimeErrorList />
      </div>
      <CanvasPanSurface />
    </div>
  );
}
