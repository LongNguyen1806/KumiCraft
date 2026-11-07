// Session list card over the chat (K9.5): pick an earlier conversation to read and continue it.
import type { AgentId, TurnSummary } from '@kumicraft/shared';
import { History, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { fetchTurns, resumeConversation } from '../../api/agent-client.ts';
import { agentDisplayName } from '../agents/agent-card.tsx';
import { type ChatSession, groupSessions, turnsOfSession } from './chat-sessions-model.ts';
import { useChatStore } from './chat-store.ts';

export type ChatSessionsProps = {
  /** The agent the chat talks to: a session of another agent cannot continue here. */
  readonly agent?: AgentId | undefined;
  readonly onClose: () => void;
};

type LoadState =
  | { readonly kind: 'loading' }
  | { readonly kind: 'ready'; readonly turns: readonly TurnSummary[] }
  | { readonly kind: 'failed' };

function useTurns(): LoadState {
  const [state, setState] = useState<LoadState>({ kind: 'loading' });
  useEffect(() => {
    let alive = true;
    const load = async () => {
      try {
        const turns = await fetchTurns();
        if (alive) setState({ kind: 'ready', turns });
      } catch {
        if (alive) setState({ kind: 'failed' });
      }
    };
    void load();
    return () => {
      alive = false;
    };
  }, []);
  return state;
}

type SessionRowProps = {
  readonly session: ChatSession;
  readonly current: boolean;
  readonly otherAgent: boolean;
  readonly busy: boolean;
  readonly onOpen: () => void;
};

function SessionRow({ session, current, otherAgent, busy, onOpen }: SessionRowProps) {
  const { t, i18n } = useTranslation('chat');
  const when =
    session.lastAt === ''
      ? ''
      : new Date(session.lastAt).toLocaleString(i18n.language, {
          day: '2-digit',
          month: '2-digit',
          hour: '2-digit',
          minute: '2-digit',
        });
  const title = session.id === undefined ? t('sessions.legacy') : session.title;
  return (
    <li>
      <button
        type="button"
        data-testid="chat-session"
        aria-current={current ? 'true' : undefined}
        disabled={busy || otherAgent}
        onClick={onOpen}
        className={`flex w-full flex-col gap-0.5 rounded-lg px-2.5 py-2 text-left cursor-pointer disabled:cursor-default ${
          current ? 'bg-accent/10' : 'hover:bg-field'
        } ${otherAgent ? 'opacity-50' : ''}`}
      >
        <span className="line-clamp-2 text-xs text-ink break-words">{title}</span>
        <span className="flex flex-wrap items-center gap-x-1.5 text-[10px] text-ink-faint">
          <span>{agentDisplayName(session.agent)}</span>
          <span>·</span>
          <span>{t('sessions.turns', { count: session.turnCount })}</span>
          {when !== '' && <span>· {when}</span>}
          {current && <span className="font-medium text-accent">· {t('sessions.current')}</span>}
          {otherAgent && <span>· {t('sessions.otherAgent')}</span>}
        </span>
      </button>
    </li>
  );
}

function SessionList({
  turns,
  agent,
  onClose,
}: ChatSessionsProps & { turns: readonly TurnSummary[] }) {
  const { t } = useTranslation('chat');
  const currentId = useChatStore((s) => s.sessionId);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const sessions = groupSessions(turns);

  const open = async (session: ChatSession) => {
    setBusy(true);
    setFailed(false);
    try {
      // Only a session with an id continues; older turns are shown to read.
      if (session.id !== undefined) await resumeConversation(session.id);
      useChatStore.getState().showSession(turnsOfSession(turns, session.id), session.id);
      onClose();
    } catch {
      setFailed(true);
    } finally {
      setBusy(false);
    }
  };

  if (sessions.length === 0) {
    return <p className="px-2.5 py-4 text-xs text-ink-soft">{t('sessions.empty')}</p>;
  }
  return (
    <>
      {failed && <p className="px-2.5 text-xs text-rose-600">{t('sessions.openFailed')}</p>}
      <ul className="flex flex-col gap-0.5">
        {sessions.map((session) => (
          <SessionRow
            key={session.id ?? ''}
            session={session}
            current={session.id !== undefined && session.id === currentId}
            otherAgent={session.id !== undefined && agent !== undefined && session.agent !== agent}
            busy={busy}
            onOpen={() => void open(session)}
          />
        ))}
      </ul>
    </>
  );
}

function useCloseOnEscape(onClose: () => void): void {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
    };
  }, [onClose]);
}

export function ChatSessions({ agent, onClose }: ChatSessionsProps) {
  const { t } = useTranslation('chat');
  const state = useTurns();
  useCloseOnEscape(onClose);

  return (
    <div
      role="dialog"
      aria-label={t('sessions.title')}
      data-testid="chat-sessions"
      className="absolute inset-0 z-20 flex flex-col rounded-xl border border-border bg-card-solid shadow-lg"
    >
      <div className="flex items-center gap-1.5 border-b border-line px-3 py-2">
        <History className="size-3.5 text-ink-soft" />
        <span className="flex-1 text-xs font-medium text-ink">{t('sessions.title')}</span>
        <button
          type="button"
          data-testid="chat-sessions-close"
          title={t('sessions.close')}
          aria-label={t('sessions.close')}
          onClick={onClose}
          className="flex size-6 items-center justify-center rounded-full text-ink-soft hover:bg-field hover:text-ink cursor-pointer"
        >
          <X className="size-3.5" />
        </button>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto p-1.5">
        {state.kind === 'loading' && (
          <p className="px-2.5 py-4 text-xs text-ink-soft">{t('sessions.loading')}</p>
        )}
        {state.kind === 'failed' && (
          <p className="px-2.5 py-4 text-xs text-rose-600">{t('sessions.loadFailed')}</p>
        )}
        {state.kind === 'ready' && (
          <SessionList turns={state.turns} agent={agent} onClose={onClose} />
        )}
      </div>
      <p
        data-testid="chat-sessions-hint"
        className="border-t border-line px-3 py-2 text-[10px] text-ink-faint"
      >
        {t('sessions.deleteHint')}
      </p>
    </div>
  );
}
