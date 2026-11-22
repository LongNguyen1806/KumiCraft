import { type Frame, type LoginSession, type RunnerStatus } from '@kumicraft/shared';
import { useEffect, useMemo, useRef } from 'react';

import { useCanvasNavigation } from '../../core/canvas-navigation.ts';
import { useCanvasViewStore } from '../../core/canvas-view-store.ts';
import { useProjectInfo } from '../../core/project-store.ts';
import type { CanvasMode } from '../../core/selection-store.ts';
import { RuntimeErrorList } from '../canvas-errors/runtime-error-list.tsx';
import { CanvasMultiFrame } from './canvas-multi-frame.tsx';
import { CanvasPanSurface, PannedContent } from './canvas-pan.tsx';
import {
  ErrorView,
  NeedsInstallPrompt,
  StartingView,
  StoppedView,
  UntrustedPrompt,
} from './canvas-prompts.tsx';
import { fitZoomForFocus, fitZoomForFrames, useElementSize, type Zoom } from './canvas-zoom.tsx';

const FALLBACK_FRAME = { id: 'desktop', label: 'Desktop', width: 1280, height: 800 };
import { useFrameFocusActive, useFrameFocusStore } from '../../core/frame-focus-store.ts';
import type { OpenFrame } from '../../core/open-frames-storage.ts';
import { FrameFocusControls } from './frame-focus-controls.tsx';
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
  // Each frame shows its own draft (its `OpenFrame.draftFile`), not one shared by all frames.
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

/** Widths of the frames on screen: all of them side by side, the working one alone in focus. */
function useShownFrames(
  openFrames: CanvasContentProps['openFrames'],
  frames: CanvasContentProps['frames'],
): {
  readonly focusMode: boolean;
  readonly shown: readonly CanvasContentProps['frames'][number][];
} {
  const focusMode = useFrameFocusActive();
  const activeOpenFrameId = useCanvasViewStore((st) => st.activeOpenFrameId);
  const projectId = useCanvasViewStore((st) => st.currentProjectId);
  const loadFocus = useFrameFocusStore((st) => st.load);
  useEffect(() => {
    loadFocus(projectId);
  }, [loadFocus, projectId]);
  // One frame at a time fits the frame on screen, not the whole row.
  const shown = useMemo(
    () =>
      openFrames
        .filter((of) => !focusMode || of.id === activeOpenFrameId)
        .map((of) => frames.find((f) => f.id === of.frameId) ?? frames[0] ?? FALLBACK_FRAME),
    [openFrames, frames, focusMode, activeOpenFrameId],
  );
  return { focusMode, shown };
}

export function CanvasViewport(props: Omit<CanvasContentProps, 'zoom'> & { readonly zoom: Zoom }) {
  const viewport = useRef<HTMLDivElement>(undefined);
  const area = useRef<HTMLDivElement>(undefined);
  const size = useElementSize(viewport);
  const { focusMode, shown } = useShownFrames(props.openFrames, props.frames);
  const alone = shown[0];
  const fit =
    focusMode && alone !== undefined
      ? fitZoomForFocus(size, alone)
      : fitZoomForFrames(
          size.width,
          shown.map((f) => f.width),
        );
  const zoom = props.zoom === 'fit' ? fit : props.zoom;
  const setDisplayedZoom = useCanvasViewStore((st) => st.setDisplayedZoom);

  useEffect(() => {
    setDisplayedZoom(zoom);
  }, [zoom, setDisplayedZoom]);
  useCanvasNavigation(area, zoom);

  return (
    <div
      ref={(el) => {
        area.current = el ?? undefined;
      }}
      className="relative flex min-h-0 min-w-0 flex-1 flex-col"
    >
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
      <FrameFocusControls
        frames={props.frames}
        sessions={props.sessions}
        sessionEnabled={props.sessionEnabled}
      />
    </div>
  );
}
