// Login session selector on the Canvas toolbar (Phase 4 K3d-B Part D).
import {
  DEFAULT_LOGIN_SESSIONS,
  type LoginSession,
  type ProjectInfo,
  sessionOrigin,
} from '@kumicraft/shared';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import {
  patchProject,
  probeSessionOrigin,
  resetSessionProbeCache,
  SESSION_PROBE_TIMEOUT_MS,
} from '../../api/project-client.ts';
import { errorText, toErrorInfo } from '../../routes/error-text.ts';
import { useProjectStore } from '../project/project-store.ts';

export { probeSessionOrigin, resetSessionProbeCache, SESSION_PROBE_TIMEOUT_MS };

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

export function nextFreeSessionId(sessions: readonly LoginSession[]): number | undefined {
  for (let id = 2; id <= 8; id += 1) {
    if (!sessions.some((s) => s.id === id)) return id;
  }
  return undefined;
}

export function useCanvasSession(projectInfo?: ProjectInfo, runnerOrigin?: string) {
  const storeProject = useProjectStore((s) => s.project);
  const project = storeProject ?? projectInfo;
  const projectId = project?.id;
  const [overriddenSessions, setLocalSessions] = useState<readonly LoginSession[] | undefined>();
  const sessions = overriddenSessions ?? project?.sessions ?? DEFAULT_LOGIN_SESSIONS;

  const [selectedId, setSelectedId] = useState<number | undefined>();
  const candidateId = selectedId ?? readStoredSessionId(projectId, sessions);
  const effectiveActiveId = sessions.some((s) => s.id === candidateId) ? candidateId : 1;
  const effectiveOrigin =
    runnerOrigin !== undefined ? sessionOrigin(runnerOrigin, effectiveActiveId) : undefined;

  const selectSession = (id: number) => {
    setSelectedId(id);
    writeStoredSessionId(projectId, id);
  };

  return {
    projectId,
    sessions,
    setLocalSessions,
    activeSessionId: effectiveActiveId,
    effectiveOrigin,
    selectSession,
  };
}

type SessionRowProps = {
  readonly session: LoginSession;
  readonly isActive: boolean;
  readonly busy: boolean;
  readonly onSelect: (id: number) => void;
  readonly onRename: (id: number, label: string) => void;
  readonly onDelete: (id: number) => void;
};

function SessionRenameEditor({
  sessionId,
  initialLabel,
  busy,
  onSave,
}: {
  readonly sessionId: number;
  readonly initialLabel: string;
  readonly busy: boolean;
  readonly onSave: (label: string) => void;
}) {
  const [draft, setDraft] = useState(initialLabel);
  return (
    <div className="flex items-center gap-1 py-0.5">
      <input
        type="text"
        value={draft}
        data-testid={`session-rename-input-${String(sessionId)}`}
        onChange={(e) => {
          setDraft(e.target.value);
        }}
        className="min-w-0 flex-1 rounded border border-border bg-field px-1.5 py-0.5 text-xs text-ink"
      />
      <button
        type="button"
        data-testid={`session-rename-save-${String(sessionId)}`}
        disabled={busy || draft.trim().length === 0}
        onClick={() => {
          onSave(draft.trim());
        }}
        className="rounded bg-accent px-1.5 py-0.5 text-[11px] text-white"
      >
        OK
      </button>
    </div>
  );
}

function SessionRowButtons({
  sessionId,
  busy,
  onStartEdit,
  onDelete,
}: {
  readonly sessionId: number;
  readonly busy: boolean;
  readonly onStartEdit: () => void;
  readonly onDelete: (id: number) => void;
}) {
  const { t } = useTranslation();
  return (
    <div className="flex shrink-0 items-center gap-1">
      <button
        type="button"
        data-testid={`session-rename-btn-${String(sessionId)}`}
        disabled={busy}
        onClick={onStartEdit}
        className="rounded border border-border px-1.5 py-0.5 text-[10px] text-ink-soft hover:text-ink"
      >
        {t('sessions.rename')}
      </button>
      {sessionId !== 1 ? (
        <button
          type="button"
          data-testid={`session-delete-btn-${String(sessionId)}`}
          disabled={busy}
          onClick={() => {
            onDelete(sessionId);
          }}
          className="rounded border border-border px-1.5 py-0.5 text-[10px] text-rose-600 hover:bg-rose-50"
        >
          {t('sessions.delete')}
        </button>
      ) : undefined}
    </div>
  );
}

function SessionRow({ session, isActive, busy, onSelect, onRename, onDelete }: SessionRowProps) {
  const [editing, setEditing] = useState(false);

  if (editing) {
    return (
      <SessionRenameEditor
        sessionId={session.id}
        initialLabel={session.label}
        busy={busy}
        onSave={(label) => {
          setEditing(false);
          onRename(session.id, label);
        }}
      />
    );
  }

  return (
    <div className="flex items-center justify-between gap-1.5 rounded px-1.5 py-1 hover:bg-field-hover">
      <button
        type="button"
        data-testid={`session-item-${String(session.id)}`}
        disabled={busy}
        onClick={() => {
          onSelect(session.id);
        }}
        className={`min-w-0 flex-1 truncate text-left text-xs ${
          isActive ? 'font-semibold text-accent' : 'text-ink'
        }`}
      >
        {session.label}
      </button>
      <SessionRowButtons
        sessionId={session.id}
        busy={busy}
        onStartEdit={() => {
          setEditing(true);
        }}
        onDelete={onDelete}
      />
    </div>
  );
}

type SessionAddRowProps = {
  readonly nextId: number;
  readonly busy: boolean;
  readonly onAdd: (label: string) => void;
};

function SessionAddRow({ nextId, busy, onAdd }: SessionAddRowProps) {
  const { t } = useTranslation();
  const [label, setLabel] = useState('');
  const defaultLabel = t('sessions.defaultLabel', { id: nextId });

  return (
    <div className="mt-1.5 flex items-center gap-1 border-t border-border pt-1.5">
      <input
        type="text"
        value={label}
        placeholder={defaultLabel}
        data-testid="session-add-input"
        onChange={(e) => {
          setLabel(e.target.value);
        }}
        className="min-w-0 flex-1 rounded border border-border bg-field px-2 py-1 text-xs text-ink"
      />
      <button
        type="button"
        data-testid="session-add-btn"
        disabled={busy}
        onClick={() => {
          const chosen = label.trim() || defaultLabel;
          setLabel('');
          onAdd(chosen);
        }}
        className="shrink-0 rounded border border-border bg-field px-2 py-1 text-xs font-medium text-ink hover:bg-field-hover disabled:opacity-40"
      >
        {t('sessions.add')}
      </button>
    </div>
  );
}

type SessionPopoverProps = {
  readonly sessions: readonly LoginSession[];
  readonly activeSessionId: number;
  readonly busy: boolean;
  readonly onSelect: (id: number) => void;
  readonly onSaveSessions: (next: readonly LoginSession[], fallbackToFirst?: boolean) => void;
};

function SessionPopover({
  sessions,
  activeSessionId,
  busy,
  onSelect,
  onSaveSessions,
}: SessionPopoverProps) {
  const nextId = nextFreeSessionId(sessions);
  return (
    <div
      data-testid="session-select-popover"
      className="absolute top-full left-0 z-30 mt-1 w-64 rounded-lg border border-border bg-card-solid p-2 shadow-xl"
    >
      <div className="flex flex-col gap-0.5">
        {sessions.map((session) => (
          <SessionRow
            key={session.id}
            session={session}
            isActive={session.id === activeSessionId}
            busy={busy}
            onSelect={onSelect}
            onRename={(id, label) => {
              onSaveSessions(sessions.map((s) => (s.id === id ? { ...s, label } : s)));
            }}
            onDelete={(id) => {
              onSaveSessions(
                sessions.filter((s) => s.id !== id),
                id === activeSessionId,
              );
            }}
          />
        ))}
      </div>
      {nextId !== undefined ? (
        <SessionAddRow
          nextId={nextId}
          busy={busy}
          onAdd={(label) => {
            onSaveSessions([...sessions, { id: nextId, label }]);
          }}
        />
      ) : undefined}
    </div>
  );
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

  return { open, setOpen, busy, errorMsg, saveSessions, handleSelect };
}

export function SessionSelect(props: SessionSelectProps) {
  const { t } = useTranslation();
  const { sessions, activeSessionId } = props;
  const actions = useSessionActions(props);
  const activeSession = sessions.find((s) => s.id === activeSessionId) ??
    sessions[0] ?? {
      id: 1,
      label: 'Phiên 1',
    };

  return (
    <div className="relative">
      <button
        type="button"
        data-testid="session-select-trigger"
        onClick={() => {
          actions.setOpen((v) => !v);
        }}
        className="rounded border border-border bg-field px-2.5 py-1 text-xs font-medium text-ink hover:bg-field-hover"
      >
        {t('sessions.button', { label: activeSession.label })}
      </button>
      {actions.errorMsg !== undefined ? (
        <div
          role="alert"
          data-testid="session-error"
          className="absolute top-full left-0 z-40 mt-1 w-72 rounded border border-amber-500/40 bg-card-solid p-2 text-xs text-amber-600 shadow-lg dark:text-amber-300"
        >
          {actions.errorMsg}
        </div>
      ) : undefined}
      {actions.open ? (
        <SessionPopover
          sessions={sessions}
          activeSessionId={activeSessionId}
          busy={actions.busy}
          onSelect={(id) => {
            void actions.handleSelect(id);
          }}
          onSaveSessions={(next, fallback) => {
            void actions.saveSessions(next, fallback);
          }}
        />
      ) : undefined}
    </div>
  );
}
