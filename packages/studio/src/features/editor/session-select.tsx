// Login session selector on the Canvas toolbar (Phase 4 K3d-B Part D).
import {
  DEFAULT_LOGIN_SESSIONS,
  type LoginSession,
  type ProjectInfo,
  sessionOrigin,
} from '@kumicraft/shared';
import { useCallback, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';

import {
  patchProject,
  probeSessionOrigin,
  resetSessionProbeCache,
  SESSION_PROBE_TIMEOUT_MS,
} from '../../api/project-client.ts';
import { errorText, toErrorInfo } from '../../routes/error-text.ts';
import { useSettingsStore } from '../../store/settings-store.ts';
import { useProjectStore } from '../project/project-store.ts';
import { nextFreeSessionId, sessionLabel, SessionPopover } from './session-popover.tsx';

export { nextFreeSessionId, probeSessionOrigin, resetSessionProbeCache, SESSION_PROBE_TIMEOUT_MS };

export function readStoredSessionId(
  projectId: string | undefined,
  sessions: readonly LoginSession[],
): number {
  if (!projectId) return 1;
  try {
    const raw = localStorage.getItem(`kumicraft.session.${projectId}`) ?? '';
    const parsed = Number.parseInt(raw, 10);
    if (Number.isInteger(parsed) && sessions.some((s) => s.id === parsed)) {
      return parsed;
    }
  } catch {
    // Ignore storage read failures.
  }
  return 1;
}

export function writeStoredSessionId(projectId: string | undefined, sessionId: number): void {
  if (!projectId) return;
  try {
    localStorage.setItem(`kumicraft.session.${projectId}`, String(sessionId));
  } catch {
    // Ignore storage write failures.
  }
}

export function useCanvasSession(projectInfo?: ProjectInfo, runnerOrigin?: string) {
  // Off (the default): the Canvas always shows session 1, the plain runner origin.
  const enabled = useSettingsStore((s) => s.settings?.loginSessions === true);
  const storeProject = useProjectStore((s) => s.project);
  const project = storeProject ?? projectInfo;
  const projectId = project?.id;
  const [overriddenSessions, setLocalSessions] = useState<readonly LoginSession[] | undefined>();
  const sessions = overriddenSessions ?? project?.sessions ?? DEFAULT_LOGIN_SESSIONS;

  const [selectedId, setSelectedId] = useState<number | undefined>();
  const candidateId = selectedId ?? readStoredSessionId(projectId, sessions);
  const effectiveActiveId = enabled && sessions.some((s) => s.id === candidateId) ? candidateId : 1;
  const effectiveOrigin =
    runnerOrigin !== undefined ? sessionOrigin(runnerOrigin, effectiveActiveId) : undefined;

  const selectSession = (id: number) => {
    setSelectedId(id);
    writeStoredSessionId(projectId, id);
  };

  return {
    enabled,
    projectId,
    sessions,
    setLocalSessions,
    activeSessionId: effectiveActiveId,
    effectiveOrigin,
    selectSession,
  };
}

export type SessionSelectProps = {
  readonly sessions: readonly LoginSession[];
  readonly activeSessionId: number;
  readonly runnerOrigin?: string | undefined;
  readonly onSelectSession: (id: number) => void;
  readonly onSessionsUpdated: (sessions: readonly LoginSession[]) => void;
};

function useSessionActions(props: SessionSelectProps) {
  const { t } = useTranslation();
  const { t: tError } = useTranslation('errors');
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | undefined>();

  const saveSessions = async (next: readonly LoginSession[], fallbackToFirst = false) => {
    setBusy(true);
    setErrorMsg(undefined);
    try {
      const info = await patchProject({ sessions: next });
      useProjectStore.getState().setProject(info);
      props.onSessionsUpdated(info.sessions ?? next);
      if (fallbackToFirst) props.onSelectSession(1);
    } catch (error: unknown) {
      const err = toErrorInfo(error);
      setErrorMsg(errorText(tError, err.code, err.params));
    } finally {
      setBusy(false);
    }
  };

  const handleSelect = async (id: number) => {
    setErrorMsg(undefined);
    if (id >= 2) {
      const baseOrigin = props.runnerOrigin ?? 'http://127.0.0.1:5173';
      setBusy(true);
      const reachable = await probeSessionOrigin(sessionOrigin(baseOrigin, id));
      setBusy(false);
      if (!reachable) {
        setErrorMsg(t('sessions.localhostUnsupported'));
        return;
      }
    }
    props.onSelectSession(id);
    setOpen(false);
  };

  return {
    open,
    setOpen,
    busy,
    errorMsg,
    select: (id: number) => {
      void handleSelect(id);
    },
    save: (next: readonly LoginSession[], fallback?: boolean) => {
      void saveSessions(next, fallback);
    },
  };
}

/**
 * Closes the floating list on a click outside, on Escape, or when the Canvas frame takes the
 * focus (a click inside an iframe never reaches this document).
 */
function useFloatingDismiss(open: boolean, onClose: () => void) {
  const [floating, setFloating] = useState<HTMLElement>();
  // The button toggles by itself: a mousedown on it must not close first and reopen on click.
  const [trigger, setTrigger] = useState<HTMLElement>();
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!(e.target instanceof Node)) return;
      if (floating?.contains(e.target) === true || trigger?.contains(e.target) === true) return;
      onClose();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('mousedown', onDown);
    window.addEventListener('keydown', onKey);
    window.addEventListener('blur', onClose);
    return () => {
      window.removeEventListener('mousedown', onDown);
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('blur', onClose);
    };
  }, [open, onClose, floating, trigger]);
  return { setFloating, setTrigger };
}

type Anchor = { readonly left: number; readonly top: number };

/** Drawn on document.body at a fixed place under the button, so no toolbar or Canvas clips it. */
function Floating({
  anchor,
  children,
}: {
  readonly anchor: Anchor;
  readonly children: React.ReactNode;
}) {
  return createPortal(
    <div
      className="fixed z-50"
      style={{ left: `${String(anchor.left)}px`, top: `${String(anchor.top)}px` }}
    >
      {children}
    </div>,
    document.body,
  );
}

function SessionTrigger({
  label,
  onToggle,
}: {
  readonly label: string;
  readonly onToggle: (anchor: Anchor) => void;
}) {
  const { t } = useTranslation();
  return (
    <button
      type="button"
      data-testid="session-select-trigger"
      title={t('sessions.explain')}
      onClick={(e) => {
        const rect = e.currentTarget.getBoundingClientRect();
        onToggle({ left: rect.left, top: rect.bottom + 4 });
      }}
      className="rounded border border-border bg-field px-2.5 py-1 text-xs font-medium text-ink hover:bg-field-hover"
    >
      {t('sessions.button', { label })}
    </button>
  );
}

function SessionError({ anchor, message }: { readonly anchor: Anchor; readonly message: string }) {
  return (
    <Floating anchor={anchor}>
      <div
        role="alert"
        data-testid="session-error"
        className="w-72 rounded border border-amber-500/40 bg-card-solid p-2 text-xs text-amber-600 shadow-lg dark:text-amber-300"
      >
        {message}
      </div>
    </Floating>
  );
}

export function SessionSelect(props: SessionSelectProps) {
  const { t } = useTranslation();
  const { sessions, activeSessionId } = props;
  const actions = useSessionActions(props);
  const [anchor, setAnchor] = useState<Anchor>({ left: 0, top: 0 });
  const { setOpen } = actions;
  const close = useCallback(() => {
    setOpen(false);
  }, [setOpen]);
  const dismiss = useFloatingDismiss(actions.open, close);
  const activeSession = sessions.find((s) => s.id === activeSessionId) ??
    sessions[0] ?? { id: 1, label: '1' };

  return (
    <div
      ref={(el) => {
        dismiss.setTrigger(el ?? undefined);
      }}
    >
      <SessionTrigger
        label={sessionLabel(t, activeSession)}
        onToggle={(next) => {
          setAnchor(next);
          actions.setOpen((v) => !v);
        }}
      />
      {actions.errorMsg !== undefined ? (
        <SessionError anchor={anchor} message={actions.errorMsg} />
      ) : undefined}
      {actions.open ? (
        <Floating anchor={anchor}>
          <div
            ref={(el) => {
              dismiss.setFloating(el ?? undefined);
            }}
          >
            <SessionPopover
              sessions={sessions}
              activeSessionId={activeSessionId}
              busy={actions.busy}
              onSelect={actions.select}
              onSaveSessions={actions.save}
            />
          </div>
        </Floating>
      ) : undefined}
    </div>
  );
}
