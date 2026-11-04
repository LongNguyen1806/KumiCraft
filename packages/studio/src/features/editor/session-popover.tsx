// Rows, add row and the list of login sessions shown by the session selector (K3d-B Part D).
import type { LoginSession } from '@kumicraft/shared';
import type { TFunction } from 'i18next';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

/** A name KumiCraft gave (`Phiên 2`, `Session 2`, `2`) shows in the Studio language. */
export function sessionLabel(t: TFunction, session: LoginSession): string {
  const id = String(session.id);
  const generated = new RegExp(`^((Phiên|Session) )?${id}$`, 'i').test(session.label.trim());
  return generated ? t('sessions.defaultLabel', { id }) : session.label;
}

export function nextFreeSessionId(sessions: readonly LoginSession[]): number | undefined {
  for (let id = 2; id <= 8; id += 1) {
    if (!sessions.some((s) => s.id === id)) return id;
  }
  return undefined;
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
  const { t } = useTranslation();
  const [editing, setEditing] = useState(false);

  if (editing) {
    return (
      <SessionRenameEditor
        sessionId={session.id}
        initialLabel={sessionLabel(t, session)}
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
        {sessionLabel(t, session)}
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

export type SessionPopoverProps = {
  readonly sessions: readonly LoginSession[];
  readonly activeSessionId: number;
  readonly busy: boolean;
  readonly onSelect: (id: number) => void;
  readonly onSaveSessions: (next: readonly LoginSession[], fallbackToFirst?: boolean) => void;
};

export function SessionPopover({
  sessions,
  activeSessionId,
  busy,
  onSelect,
  onSaveSessions,
}: SessionPopoverProps) {
  const { t } = useTranslation();
  const nextId = nextFreeSessionId(sessions);
  return (
    <div
      data-testid="session-select-popover"
      className="w-80 rounded-lg border border-border bg-card-solid p-2.5 shadow-xl"
    >
      <div className="px-1 pb-1.5 text-xs font-semibold text-ink">{t('sessions.title')}</div>
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
