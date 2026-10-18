import { type Frame, type ProjectInfo, type RunnerStatus } from '@reactcraft/shared';
import { type ChangeEvent, useEffect, useMemo, useRef } from 'react';
import { useTranslation } from 'react-i18next';

import { errorText } from '../../routes/error-text.ts';
import { BuildErrorBanner } from '../canvas-errors/build-error-banner.tsx';
import { RuntimeErrorList } from '../canvas-errors/runtime-error-list.tsx';
import { DndErrorBanner } from '../dnd/dnd-error-banner.tsx';
import { type CanvasMode, useSelectionStore } from '../selection/selection-store.ts';
import { type TextEditWarning, useCanvasTextEdit } from '../text-edit/use-canvas-text-edit.ts';
import { IframeFrame } from './canvas-frame.tsx';
import {
  ErrorView,
  NeedsInstallPrompt,
  StartingView,
  StoppedView,
  UntrustedPrompt,
} from './canvas-prompts.tsx';
import { useCanvasViewStore } from './canvas-view-store.ts';
import { fitZoom, useElementWidth, type Zoom, ZoomSelect } from './canvas-zoom.tsx';
import { PageSelect } from './page-select.tsx';
import { PortBusyBanner } from './port-busy-banner.tsx';
import { useOpenInEditor } from './use-open-in-editor.ts';
import { useRunnerStatus } from './use-runner-status.ts';

export type CanvasAreaProps = {
  readonly projectInfo?: ProjectInfo | undefined;
  readonly trusted?: boolean;
  readonly onTrustRequest?: (() => void) | undefined;
  readonly onInstallRequest?: (() => void) | undefined;
};

const FALLBACK_FRAME: Frame = { id: 'desktop', label: 'Desktop', width: 1280, height: 800 };

function getActiveFrame(frames: readonly Frame[], activeId?: string): Frame {
  const match = frames.find((f) => f.id === activeId);
  return match ?? frames[0] ?? FALLBACK_FRAME;
}

function TextEditWarningBanner({
  warning,
  onOpenEditor,
  onDismiss,
}: {
  readonly warning: TextEditWarning;
  readonly onOpenEditor: () => void;
  readonly onDismiss: () => void;
}) {
  const { t } = useTranslation();
  return (
    <div
      role="alert"
      data-testid="text-edit-warning-banner"
      className="absolute top-14 left-1/2 z-30 flex -translate-x-1/2 items-center gap-3 rounded-lg border border-amber-500/30 bg-card-solid/95 px-4 py-2 text-xs text-amber-500 shadow-xl backdrop-blur-md"
    >
      <span>{t(warning.messageKey)}</span>
      <button
        type="button"
        onClick={onOpenEditor}
        className="font-medium text-primary underline hover:opacity-80"
        data-testid="text-edit-open-editor-btn"
      >
        {t('textEdit.openInEditor')}
      </button>
      <button
        type="button"
        onClick={onDismiss}
        aria-label={t('settings.close')}
        className="ml-1 text-sm leading-none text-ink-soft hover:text-ink"
        data-testid="text-edit-dismiss-warning-btn"
      >
        ×
      </button>
    </div>
  );
}

function TextEditLoopBanner({ count }: { readonly count: number }) {
  const { t } = useTranslation();
  return (
    <div
      data-testid="text-edit-loop-banner"
      className="absolute top-14 left-1/2 z-30 flex -translate-x-1/2 items-center gap-2 rounded-full border border-primary/30 bg-card-solid/95 px-3 py-1 text-xs font-medium text-primary shadow-lg backdrop-blur-md"
    >
      <span>{t('textEdit.loopBanner', { count })}</span>
    </div>
  );
}

function TextEditOverlay({
  warning,
  loopCount,
  onOpenEditor,
  onDismiss,
}: {
  readonly warning: TextEditWarning | undefined;
  readonly loopCount: number | undefined;
  readonly onOpenEditor: () => void;
  readonly onDismiss: () => void;
}) {
  return (
    <>
      {warning && (
        <TextEditWarningBanner
          warning={warning}
          onOpenEditor={onOpenEditor}
          onDismiss={onDismiss}
        />
      )}
      {loopCount !== undefined && <TextEditLoopBanner count={loopCount} />}
    </>
  );
}

function CanvasViewport(props: Omit<CanvasContentProps, 'zoom'> & { readonly zoom: Zoom }) {
  const viewport = useRef<HTMLDivElement>(undefined);
  const width = useElementWidth(viewport);
  const zoom = props.zoom === 'fit' ? fitZoom(width, props.frame.width) : props.zoom;
  const setDisplayedZoom = useCanvasViewStore((st) => st.setDisplayedZoom);

  useEffect(() => {
    setDisplayedZoom(zoom);
  }, [zoom, setDisplayedZoom]);

  return (
    <div
      ref={(el) => {
        viewport.current = el ?? undefined;
      }}
      // `safe`: a frame wider than the Canvas scrolls from its left edge instead of being cut.
      className="relative grid min-h-0 min-w-0 flex-1 place-items-center-safe overflow-auto p-4"
      data-testid="canvas-placeholder"
    >
      <CanvasContent {...props} zoom={zoom} />
      <RuntimeErrorList />
    </div>
  );
}

/** Dev server and build notices above the Canvas (R-RN-25, R-RN-27). */
function CanvasNotices({ onOpenLoc }: { readonly onOpenLoc: (loc: string) => void }) {
  return (
    <>
      <PortBusyBanner />
      <BuildErrorBanner onOpenLoc={onOpenLoc} />
      <DndErrorBanner />
    </>
  );
}

function useCanvasAreaState(projectInfo?: ProjectInfo) {
  const runner = useRunnerStatus();
  const mode = useCanvasViewStore((st) => st.mode);
  const setMode = useCanvasViewStore((st) => st.setMode);
  const zoom = useCanvasViewStore((st) => st.zoom);
  const setZoom = useCanvasViewStore((st) => st.setZoom);
  const activeFrameId = useCanvasViewStore((st) => st.activeFrameId);
  const setActiveFrameId = useCanvasViewStore((st) => st.setActiveFrameId);
  const frames = useCanvasViewStore((st) => st.frames);
  const setFrames = useCanvasViewStore((st) => st.setFrames);

  useEffect(() => {
    if (projectInfo?.frames && projectInfo.frames.length > 0) {
      setFrames(projectInfo.frames);
    }
  }, [projectInfo?.frames, setFrames]);

  const activeFrame = useMemo(() => getActiveFrame(frames, activeFrameId), [frames, activeFrameId]);
  const editor = useOpenInEditor();
  const textEdit = useCanvasTextEdit({
    mode,
    activeFrameId: activeFrame.id,
    onOpenEditor: (file, line, column) => {
      editor.open(`${file}:${String(line)}:${String(column)}`);
    },
  });

  return {
    runner,
    mode,
    setMode,
    zoom,
    setZoom,
    frames,
    activeFrame,
    setActiveFrameId,
    editor,
    textEdit,
  };
}

export function CanvasArea(props: CanvasAreaProps) {
  const { projectInfo, trusted = true, onTrustRequest, onInstallRequest } = props;
  const { t } = useTranslation();
  const { t: tError } = useTranslation('errors');
  const s = useCanvasAreaState(projectInfo);

  return (
    <main
      aria-label={t('editor.canvas')}
      data-testid="editor"
      className="relative flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-panel bg-card-solid/35 bg-[radial-gradient(rgb(60_52_30/0.14)_1px,transparent_1px)] bg-size-[18px_18px]"
    >
      <CanvasToolbar
        frames={s.frames}
        activeFrameId={s.activeFrame.id}
        onSelectFrame={s.setActiveFrameId}
        zoom={s.zoom}
        onSelectZoom={s.setZoom}
        mode={s.mode}
        onToggleMode={() => {
          s.setMode((m) => (m === 'design' ? 'preview' : 'design'));
        }}
      />
      <CanvasNotices onOpenLoc={s.editor.open} />
      <TextEditOverlay
        warning={s.textEdit.warning}
        loopCount={s.textEdit.loopCount}
        onOpenEditor={s.textEdit.openEditorForWarning}
        onDismiss={s.textEdit.dismissWarning}
      />
      {s.editor.errorInfo !== undefined && (
        <p role="alert" className="px-4 text-xs text-danger" data-testid="open-editor-error">
          {errorText(tError, s.editor.errorInfo.code, s.editor.errorInfo.params)}
        </p>
      )}
      <CanvasViewport
        status={s.runner.status}
        trusted={trusted}
        needsInstall={projectInfo?.needsInstall ?? false}
        logTail={s.runner.logTail}
        frame={s.activeFrame}
        zoom={s.zoom}
        mode={s.mode}
        onTrustRequest={onTrustRequest}
        onInstallRequest={onInstallRequest}
        onStart={s.runner.start}
        onRestart={s.runner.restart}
      />
    </main>
  );
}

function FrameSelect({
  frames,
  activeId,
  onChange,
}: {
  readonly frames: readonly Frame[];
  readonly activeId: string;
  readonly onChange: (id: string) => void;
}) {
  const { t } = useTranslation();
  return (
    <label className="flex items-center gap-1.5 text-ink-soft">
      {t('editor.frame')}
      <select
        value={activeId}
        onChange={(e: ChangeEvent<HTMLSelectElement>) => {
          onChange(e.target.value);
        }}
        className="rounded border border-border bg-field px-2 py-1 text-ink"
        data-testid="canvas-frame-select"
      >
        {frames.map((f) => (
          <option key={f.id} value={f.id}>
            {f.label} ({String(f.width)}×{String(f.height)})
          </option>
        ))}
      </select>
    </label>
  );
}

type CanvasToolbarProps = {
  readonly frames: readonly Frame[];
  readonly activeFrameId: string;
  readonly onSelectFrame: (id: string) => void;
  readonly zoom: Zoom;
  readonly onSelectZoom: (zoom: Zoom) => void;
  readonly mode: CanvasMode;
  readonly onToggleMode: () => void;
};

function CanvasToolbar({
  frames,
  activeFrameId,
  onSelectFrame,
  zoom,
  onSelectZoom,
  mode,
  onToggleMode,
}: CanvasToolbarProps) {
  const { t } = useTranslation();
  const route = useSelectionStore((s) => s.currentRoute);
  return (
    <header className="flex h-11 items-center justify-between border-b border-line bg-card/60 px-4 text-xs backdrop-blur-md">
      <div className="flex min-w-0 items-center gap-3">
        <FrameSelect frames={frames} activeId={activeFrameId} onChange={onSelectFrame} />
        <ZoomSelect zoom={zoom} onChange={onSelectZoom} />
        <PageSelect />
        <span
          className="min-w-0 truncate font-mono text-ink-soft"
          title={route}
          data-testid="canvas-route"
        >
          {route}
        </span>
      </div>
      <button
        type="button"
        onClick={onToggleMode}
        className="rounded border border-border bg-field px-3 py-1 font-medium text-ink hover:bg-field-hover"
        data-testid="canvas-mode-toggle"
      >
        {mode === 'design' ? t('editor.modePreview') : t('editor.modeDesign')}
      </button>
    </header>
  );
}

type CanvasContentProps = {
  readonly status: RunnerStatus;
  readonly trusted: boolean;
  readonly needsInstall: boolean;
  readonly logTail: readonly string[];
  readonly frame: Frame;
  readonly zoom: number;
  readonly mode: CanvasMode;
  readonly onTrustRequest?: (() => void) | undefined;
  readonly onInstallRequest?: (() => void) | undefined;
  readonly onStart: () => void;
  readonly onRestart: () => void;
};

function CanvasContent(props: CanvasContentProps) {
  if (!props.trusted) {
    return <UntrustedPrompt onTrust={props.onTrustRequest} />;
  }
  if (props.needsInstall) {
    return <NeedsInstallPrompt onInstall={props.onInstallRequest} />;
  }
  if (props.status.state === 'starting') {
    return <StartingView />;
  }
  if (props.status.state === 'stopped') {
    return <StoppedView onStart={props.onStart} />;
  }
  if (props.status.state === 'error' || props.status.state === 'crashed') {
    return <ErrorView status={props.status} logTail={props.logTail} onRestart={props.onRestart} />;
  }
  if (props.status.origin) {
    return (
      <IframeFrame
        key={`${props.status.origin}|${props.status.nonce ?? ''}`}
        origin={props.status.origin}
        nonce={props.status.nonce}
        mode={props.mode}
        frame={props.frame}
        zoom={props.zoom}
        logTail={props.logTail}
      />
    );
  }
  return <></>;
}
