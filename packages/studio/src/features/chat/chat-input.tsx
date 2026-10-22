// Multi-line prompt input with keyboard submit (Ctrl+Enter / Cmd+Enter) and error notice (WP-3.05a, R-CH-01).
import type { TurnContext } from '@reactcraft/shared';
import { ArrowUp } from 'lucide-react';
import { type KeyboardEvent, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { startTurn } from '../../api/agent-client.ts';
import { errorText, toErrorInfo } from '../../routes/error-text.ts';
import { useCanvasViewStore } from '../editor/canvas-view-store.ts';
import { useSelectionStore } from '../selection/selection-store.ts';
import { resolveTargetTag } from '../structure/structure-commands.ts';
import { useChatStore } from './chat-store.ts';

function buildTurnContext(): TurnContext {
  const selection = useSelectionStore.getState();
  const canvas = useCanvasViewStore.getState();
  const hidden = useChatStore.getState().hidden;

  const firstRef = selection.selectedRefs[0];
  const tag = firstRef !== undefined ? resolveTargetTag(firstRef) : undefined;

  const element =
    !hidden.element && firstRef !== undefined && tag !== undefined
      ? { loc: firstRef.loc, tag }
      : undefined;

  const route = !hidden.page && selection.currentRoute ? selection.currentRoute : undefined;

  const activeFrame = canvas.frames.find((f) => f.id === canvas.activeFrameId);
  const frame =
    !hidden.frame && activeFrame !== undefined
      ? { id: activeFrame.id, width: activeFrame.width }
      : undefined;

  return {
    ...(element !== undefined ? { element } : {}),
    ...(route !== undefined ? { route } : {}),
    ...(frame !== undefined ? { frame } : {}),
  };
}

function useSendTurn() {
  const { t: tError } = useTranslation('errors');
  const [sendError, setSendError] = useState<string>();

  const send = async (promptToSend: string, docsToSend: readonly string[]) => {
    setSendError(undefined);
    const context = buildTurnContext();
    const conversation = useChatStore.getState().hasConversation ? 'continue' : 'new';
    useChatStore.getState().startLocal(promptToSend);
    try {
      const res = await startTurn({
        prompt: promptToSend,
        context,
        conversation,
        docs: [...docsToSend],
      });
      useChatStore.getState().setRunningJobId(res.jobId);
    } catch (err) {
      const info = toErrorInfo(err);
      setSendError(errorText(tError, info.code, info.params));
      useChatStore.setState((s) => ({
        turns: s.turns.filter((t) => t.state !== 'running'),
        draft: promptToSend,
        docs: docsToSend,
      }));
    }
  };

  return { sendError, send };
}

type ChatSendButtonProps = {
  readonly canSend: boolean;
  readonly onSend: () => void;
};

function ChatSendButton({ canSend, onSend }: ChatSendButtonProps) {
  const { t } = useTranslation('chat');
  return (
    <div className="flex justify-end pt-1">
      <button
        type="button"
        data-testid="chat-send"
        disabled={!canSend}
        title={t('send')}
        aria-label={t('send')}
        onClick={onSend}
        className="flex size-7 items-center justify-center rounded-full bg-brand text-white hover:bg-brand-hover disabled:opacity-40 cursor-pointer"
      >
        <ArrowUp className="size-4" />
      </button>
    </div>
  );
}

export type ChatInputProps = {
  readonly disabled?: boolean;
};

export function ChatInput({ disabled = false }: ChatInputProps) {
  const { t } = useTranslation('chat');
  const draft = useChatStore((s) => s.draft);
  const setDraft = useChatStore((s) => s.setDraft);
  const { sendError, send } = useSendTurn();

  const trimmed = draft.trim();
  const canSend = !disabled && Boolean(trimmed);

  const handleSend = () => {
    const currentDraft = useChatStore.getState().draft.trim();
    const currentDocs = useChatStore.getState().docs;
    if (!disabled && currentDraft) {
      void send(currentDraft, currentDocs);
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="flex flex-col gap-2 pt-2 border-t border-border/50">
      {sendError !== undefined && (
        <p data-testid="chat-send-error" className="text-xs text-rose-600">
          {sendError}
        </p>
      )}
      <div className="relative rounded-xl border border-border bg-card p-2 shadow-xs focus-within:border-brand focus-within:ring-1 focus-within:ring-brand">
        <textarea
          data-testid="chat-input"
          disabled={disabled}
          placeholder={t('inputPlaceholder')}
          value={draft}
          rows={3}
          onChange={(e) => {
            setDraft(e.target.value);
          }}
          onKeyDown={handleKeyDown}
          className="w-full resize-none border-0 bg-transparent text-xs text-ink placeholder:text-ink-faint focus:outline-none disabled:opacity-50"
        />
        <ChatSendButton canSend={canSend} onSend={handleSend} />
      </div>
    </div>
  );
}
