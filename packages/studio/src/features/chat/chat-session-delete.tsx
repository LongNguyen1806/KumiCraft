// Delete button of a chat session (owner, 2026-11-15): removes the session from KumiCraft's own
// list after a confirm; the agent's own session files (Antigravity, Claude) are not touched.
import { Trash2 } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { forgetConversation } from '../../api/agent-client.ts';
import { type ChatSession } from './chat-sessions-model.ts';
import { useChatStore } from './chat-store.ts';

/** Removes the session; a chat showing it starts a new conversation. */
function useForget(session: ChatSession, onDeleted: () => void) {
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const remove = async (): Promise<boolean> => {
    setBusy(true);
    setFailed(false);
    try {
      await forgetConversation(session.id);
      if (useChatStore.getState().sessionId === session.id) {
        useChatStore.getState().newConversation();
      }
      onDeleted();
      return true;
    } catch {
      setFailed(true);
      return false;
    } finally {
      setBusy(false);
    }
  };
  return { busy, failed, remove };
}

function ConfirmBox({
  busy,
  failed,
  onCancel,
  onConfirm,
}: {
  readonly busy: boolean;
  readonly failed: boolean;
  readonly onCancel: () => void;
  readonly onConfirm: () => void;
}) {
  const { t } = useTranslation('chat');
  return (
    <div className="flex shrink-0 flex-col items-end gap-1 py-1" data-testid="chat-session-confirm">
      <span className="text-[10px] text-ink-soft">
        {failed ? t('sessions.deleteFailed') : t('sessions.deleteConfirm')}
      </span>
      <span className="flex gap-1">
        <button
          type="button"
          onClick={onCancel}
          className="h-6 rounded-md border border-line px-2 text-[11px] text-ink hover:bg-field"
        >
          {t('sessions.cancel')}
        </button>
        <button
          type="button"
          data-testid="chat-session-delete-confirm"
          disabled={busy}
          onClick={onConfirm}
          className="h-6 rounded-md bg-danger px-2 text-[11px] font-medium text-on-danger hover:opacity-90 disabled:opacity-50"
        >
          {t('sessions.deleteYes')}
        </button>
      </span>
    </div>
  );
}

export function SessionDeleteButton({
  session,
  onDeleted,
}: {
  readonly session: ChatSession;
  readonly onDeleted: () => void;
}) {
  const { t } = useTranslation('chat');
  const [confirming, setConfirming] = useState(false);
  const { busy, failed, remove } = useForget(session, onDeleted);

  if (confirming) {
    return (
      <ConfirmBox
        busy={busy}
        failed={failed}
        onCancel={() => {
          setConfirming(false);
        }}
        onConfirm={() => {
          void (async () => {
            if (await remove()) setConfirming(false);
          })();
        }}
      />
    );
  }
  return (
    <button
      type="button"
      data-testid="chat-session-delete"
      aria-label={t('sessions.delete')}
      title={t('sessions.delete')}
      onClick={() => {
        setConfirming(true);
      }}
      className="grid size-7 shrink-0 place-items-center rounded-md text-ink-soft hover:bg-danger/10 hover:text-danger"
    >
      <Trash2 className="size-3.5" aria-hidden />
    </button>
  );
}
