// Multi-line chat input with Ctrl+Enter send and context payload construction (WP-3.05a, R-CH-01, R-CH-02, R-CH-03).
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
  const hidden = useChatStore.getState().hidden;
  const context: {
    element?: { loc: string; tag: string };
    route?: string;
    frame?: { id: string; width: number };
  } = {};

  if (!hidden.element) {
    const selectedRefs = useSelectionStore.getState().selectedRefs;
    const lastRef = selectedRefs[selectedRefs.length - 1];
    if (lastRef !== undefined) {
      const tag = resolveTargetTag(lastRef);
      if (tag !== undefined) {
        context.element = { loc: lastRef.loc, tag };
      }
    }
  }

  if (!hidden.page) {
    const currentRoute = useSelectionStore.getState().currentRoute;
    if (currentRoute) context.route = currentRoute;
  }

  if (!hidden.frame) {
    const activeFrameId = useCanvasViewStore.getState().activeFrameId;
    const frames = useCanvasViewStore.getState().frames;
    const activeFrame = frames.find((f) => f.id === activeFrameId);
    if (activeFrame !== undefined) {
      context.frame = { id: activeFrame.id, width: activeFrame.width };
    }
  }

  return context;
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
  const docs = useChatStore((s) => s.docs);
  const { sendError, send } = useSendTurn();

  const trimmed = draft.trim();
  const canSend = !disabled && Boolean(trimmed);

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      if (canSend) void send(trimmed, docs);
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
        <ChatSendButton
          canSend={canSend}
          onSend={() => {
            void send(trimmed, docs);
          }}
        />
      </div>
    </div>
  );
}
