import {
  DEFAULT_LOGIN_SESSIONS,
  type Frame,
  type ProjectInfo,
  tailwindMajorOf,
} from '@kumicraft/shared';
import { Moon } from 'lucide-react';
import { useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import { errorText } from '../../routes/error-text.ts';
import { BuildErrorBanner } from '../canvas-errors/build-error-banner.tsx';
import { DesignBar } from '../design/design-bar.tsx';
import { DndErrorBanner } from '../dnd/dnd-error-banner.tsx';
import { CanvasImagePicker } from '../draw/draw-toolbar.tsx';
import { registerFreeFrameCommands } from '../free-frame/free-frame-commands.ts';
import {
  DarkModeSetupBanner,
  useDarkModePrompt,
} from '../inspector/components/inspector-scope-controls.tsx';
import { useDarkPreviewStore } from '../inspector/dark-preview-store.ts';
import { useEditMode } from '../project/use-edit-mode.ts';
import { bridgeChannels, studioBridgeChannel } from '../selection/bridge-channel.ts';
import { type CanvasMode, useSelectionStore } from '../selection/selection-store.ts';
import { InlineTextBar } from '../text-edit/inline-text-bar.tsx';
import { useCanvasTextEdit } from '../text-edit/use-canvas-text-edit.ts';
import { TextEditOverlay } from './canvas-text-edit-overlay.tsx';
import { useCanvasViewStore } from './canvas-view-store.ts';
import { CanvasViewport } from './canvas-viewport.tsx';
import { defaultInitialOpenFrames } from './open-frames-storage.ts';
import { PageSelect } from './page-select.tsx';
import { PortBusyBanner } from './port-busy-banner.tsx';
import {
  ResponsiveAuditButton,
  ResponsiveAuditResults,
  useResponsiveAudit,
} from './responsive-audit.tsx';
import { readStoredSessionId, useCanvasSession } from './session-select.tsx';
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

function useProjectSync(projectInfo?: ProjectInfo) {
  const setFrames = useCanvasViewStore((st) => st.setFrames);
  const setTailwindMajor = useCanvasViewStore((st) => st.setTailwindMajor);
  const initOpenFrames = useCanvasViewStore((st) => st.initOpenFrames);
  const tailwindVersion = projectInfo?.support.versions.tailwindcss;
  const projectId = projectInfo?.id;

  useEffect(() => {
    if (projectInfo?.frames && projectInfo.frames.length > 0) {
      setFrames(projectInfo.frames);
    }
    setTailwindMajor(tailwindMajorOf(tailwindVersion));
    if (projectId) {
      const storedSession = readStoredSessionId(
        projectId,
        projectInfo.sessions ?? DEFAULT_LOGIN_SESSIONS,
      );
      const initialRoute = useSelectionStore.getState().currentRoute;
      initOpenFrames(projectId, initialRoute, storedSession);
    }
  }, [
    projectInfo?.frames,
    projectId,
    projectInfo?.sessions,
    tailwindVersion,
    setFrames,
    setTailwindMajor,
    initOpenFrames,
  ]);
}

function useCanvasFramesState() {
  const frames = useCanvasViewStore((st) => st.frames);
  const openFrames = useCanvasViewStore((st) => st.openFrames);
  const activeOpenFrameId = useCanvasViewStore((st) => st.activeOpenFrameId);
  const setActiveOpenFrameId = useCanvasViewStore((st) => st.setActiveOpenFrameId);
  const closeOpenFrame = useCanvasViewStore((st) => st.closeOpenFrame);
  const updateOpenFrame = useCanvasViewStore((st) => st.updateOpenFrame);
  return {
    frames,
    openFrames,
    activeOpenFrameId,
    setActiveOpenFrameId,
    closeOpenFrame,
    updateOpenFrame,
  };
}

function useCanvasAreaState(projectInfo?: ProjectInfo) {
  const runner = useRunnerStatus();
  const mode = useCanvasViewStore((st) => st.mode);
  const setMode = useCanvasViewStore((st) => st.setMode);
  const zoom = useCanvasViewStore((st) => st.zoom);
  const activeFrameId = useCanvasViewStore((st) => st.activeFrameId);
  const fs = useCanvasFramesState();

  useEffect(() => {
    return () => {
      useCanvasViewStore.setState({
        currentProjectId: undefined,
        openFrames: defaultInitialOpenFrames(),
        activeOpenFrameId: 'default',
      });
    };
  }, []);

  useProjectSync(projectInfo);

  useEffect(() => {
    return registerFreeFrameCommands();
  }, []);

  const activeFrame = useMemo(
    () => getActiveFrame(fs.frames, activeFrameId),
    [fs.frames, activeFrameId],
  );
  const editor = useOpenInEditor();
  const session = useCanvasSession(projectInfo, runner.status.origin);
  const textEdit = useCanvasTextEdit({ mode, activeFrameId: activeFrame.id });

  return {
    runner,
    mode,
    setMode,
    zoom,
    frames: fs.frames,
    openFrames: fs.openFrames,
    activeOpenFrameId: fs.activeOpenFrameId,
    setActiveOpenFrameId: fs.setActiveOpenFrameId,
    closeOpenFrame: fs.closeOpenFrame,
    updateOpenFrame: fs.updateOpenFrame,
    editor,
    textEdit,
    session,
  };
}

function CanvasAreaOverlays({
  textEdit,
  errorInfo,
  onOpenLoc,
}: {
  readonly textEdit: ReturnType<typeof useCanvasAreaState>['textEdit'];
  readonly errorInfo: ReturnType<typeof useCanvasAreaState>['editor']['errorInfo'];
  readonly onOpenLoc: (loc: string) => void;
}) {
  const { t: tError } = useTranslation('errors');
  return (
    <>
      <CanvasNotices onOpenLoc={onOpenLoc} />
      <TextEditOverlay loopCount={textEdit.loopCount} />
      {textEdit.textSelection !== undefined && (
        <div className="absolute top-22 left-1/2 z-40 -translate-x-1/2">
          <InlineTextBar
            selection={textEdit.textSelection}
            onApplied={textEdit.endEditingSession}
          />
        </div>
      )}
      {errorInfo !== undefined && (
        <p role="alert" className="px-4 text-xs text-danger" data-testid="open-editor-error">
          {errorText(tError, errorInfo.code, errorInfo.params)}
        </p>
      )}
    </>
  );
}

function CanvasViewportWrapper({
  state: s,
  trusted,
  needsInstall,
  onTrustRequest,
  onInstallRequest,
}: {
  readonly state: ReturnType<typeof useCanvasAreaState>;
  readonly trusted: boolean;
  readonly needsInstall: boolean;
  readonly onTrustRequest?: (() => void) | undefined;
  readonly onInstallRequest?: (() => void) | undefined;
}) {
  return (
    <CanvasViewport
      status={s.runner.status}
      trusted={trusted}
      needsInstall={needsInstall}
      logTail={s.runner.logTail}
      frames={s.frames}
      openFrames={s.openFrames}
      activeOpenFrameId={s.activeOpenFrameId}
      zoom={s.zoom}
      mode={s.mode}
      sessions={s.session.sessions}
      sessionEnabled={s.session.enabled}
      onTrustRequest={onTrustRequest}
      onInstallRequest={onInstallRequest}
      onStart={s.runner.start}
      onRestart={s.runner.restart}
      onSelectFrame={s.setActiveOpenFrameId}
      onCloseFrame={(id) => {
        bridgeChannels.detach(id);
        s.closeOpenFrame(id);
      }}
      onUpdateFrameSession={(id, sid) => {
        s.updateOpenFrame(id, { sessionId: sid });
        s.session.selectSession(sid);
      }}
      onSessionsUpdated={s.session.setLocalSessions}
    />
  );
}

function CanvasDarkPromptRow({
  darkPrompt,
}: {
  readonly darkPrompt: ReturnType<typeof useDarkModePrompt>;
}) {
  if (!darkPrompt.promptNeeded) return undefined;
  return (
    <div
      className="border-b border-line bg-card-solid px-2.5 py-1.5"
      data-testid="canvas-dark-mode-prompt"
    >
      <DarkModeSetupBanner onDismiss={darkPrompt.dismiss} />
    </div>
  );
}

/** The Canvas "Dark" preview: view only; tells when the project's dark colors would not apply. */
function useCanvasDarkToggle() {
  const darkPrompt = useDarkModePrompt();
  const canvasDark = useDarkPreviewStore((st) => st.canvasDark);
  const toggle = () => {
    const next = !canvasDark;
    useDarkPreviewStore.getState().setCanvasDark(next);
    studioBridgeChannel.setDarkPreview(next);
    if (next) void darkPrompt.checkBeforeDarkUse();
  };
  return { darkPrompt, canvasDark, toggle };
}

export function CanvasArea(props: CanvasAreaProps) {
  const { projectInfo, trusted = true, onTrustRequest, onInstallRequest } = props;
  const { t } = useTranslation();
  const s = useCanvasAreaState(projectInfo);
  const audit = useResponsiveAudit();
  const { darkPrompt, canvasDark, toggle: handleToggleDark } = useCanvasDarkToggle();

  return (
    <main
      aria-label={t('editor.canvas')}
      data-testid="editor"
      className="relative flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-canvas bg-[radial-gradient(var(--color-canvas-dot)_1px,transparent_1px)] bg-size-[16px_16px]"
    >
      <CanvasToolbar
        mode={s.mode}
        canvasDark={canvasDark}
        auditRunning={audit.running}
        onToggleDark={handleToggleDark}
        onRunAudit={audit.runAudit}
        onToggleMode={() => {
          s.setMode((m) => (m === 'design' ? 'preview' : 'design'));
        }}
      />
      <CanvasDarkPromptRow darkPrompt={darkPrompt} />
      <ResponsiveAuditResults
        open={audit.open}
        running={audit.running}
        issues={audit.issues}
        onClose={audit.close}
      />
      <CanvasAreaOverlays
        textEdit={s.textEdit}
        errorInfo={s.editor.errorInfo}
        onOpenLoc={s.editor.open}
      />
      <CanvasViewportWrapper
        state={s}
        trusted={trusted}
        needsInstall={projectInfo?.needsInstall ?? false}
        onTrustRequest={onTrustRequest}
        onInstallRequest={onInstallRequest}
      />
      <CanvasImagePicker />
    </main>
  );
}

type CanvasToolbarProps = {
  readonly mode: CanvasMode;
  readonly canvasDark: boolean;
  readonly auditRunning: boolean;
  readonly onToggleDark: () => void;
  readonly onRunAudit: () => void;
  readonly onToggleMode: () => void;
};

function CanvasDarkPreviewButton({
  canvasDark,
  onToggleDark,
}: {
  readonly canvasDark: boolean;
  readonly onToggleDark: () => void;
}) {
  const { t } = useTranslation();
  return (
    <button
      type="button"
      data-testid="canvas-dark-preview"
      aria-pressed={canvasDark}
      title={t('editor.darkPreviewTooltip')}
      onClick={onToggleDark}
      className={`flex h-7 shrink-0 items-center gap-1 rounded-md border px-2 font-medium transition-colors ${
        canvasDark
          ? 'border-accent bg-accent-soft text-accent'
          : 'border-line bg-card-solid text-ink hover:bg-field'
      }`}
    >
      <Moon className="size-3.5" aria-hidden />
      <span>{t('inspector.stateDark')}</span>
    </button>
  );
}

function CanvasToolbar({
  mode,
  canvasDark,
  auditRunning,
  onToggleDark,
  onRunAudit,
  onToggleMode,
}: CanvasToolbarProps) {
  const { t } = useTranslation();
  const { t: tErrors } = useTranslation('errors');
  const editMode = useEditMode();

  return (
    // One row (P5): page · what is designed (kind, name, file) · view-only · Responsive Audit · Design/Preview.
    <header className="flex h-9 shrink-0 items-center justify-between gap-2 border-b border-line bg-card-solid px-2.5 text-xs">
      <div className="flex min-w-0 flex-1 items-center gap-2">
        <PageSelect />
        <span aria-hidden className="h-[18px] w-px shrink-0 bg-line" />
        <DesignBar />
        {editMode === 'viewOnly' && (
          <span
            data-testid="view-only-chip"
            className="inline-flex shrink-0 items-center gap-1 rounded-md bg-sun-soft px-2 py-0.5 text-[11px] font-medium text-warn"
            title={tErrors('E023.reasons.viewOnly')}
          >
            {t('editor.viewOnly')}
          </span>
        )}
      </div>
      <div className="flex shrink-0 items-center gap-1.5">
        <CanvasDarkPreviewButton canvasDark={canvasDark} onToggleDark={onToggleDark} />
        <ResponsiveAuditButton running={auditRunning} onClick={onRunAudit} />
        <button
          type="button"
          onClick={onToggleMode}
          className="h-7 shrink-0 rounded-md border border-line bg-card-solid px-2.5 font-medium text-ink hover:bg-field"
          data-testid="canvas-mode-toggle"
        >
          {mode === 'design' ? t('editor.modePreview') : t('editor.modeDesign')}
        </button>
      </div>
    </header>
  );
}
