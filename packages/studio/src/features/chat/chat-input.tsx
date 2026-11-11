// Multi-line prompt input with keyboard submit (Ctrl+Enter / Cmd+Enter) and error notice (WP-3.05a, R-CH-01, R-CH-02).
import type { AgentId, AgentStatus, TurnContext } from '@kumicraft/shared';
import type { TFunction } from 'i18next';
import { ArrowUp } from 'lucide-react';
import {
  type ClipboardEvent,
  type DragEvent,
  type KeyboardEvent,
  useEffect,
  useRef,
  useState,
} from 'react';
import { useTranslation } from 'react-i18next';

import { startTurn } from '../../api/agent-client.ts';
import { type ErrorInfo, errorText, toErrorInfo } from '../../routes/error-text.ts';
import { type LoginFlow, useAgentsStore } from '../../store/agents-store.ts';
import { useCanvasViewStore } from '../editor/canvas-view-store.ts';
import { useSelectionStore } from '../selection/selection-store.ts';
import { resolveTargetTag } from '../structure/structure-commands.ts';
import { AgentSettings } from './agent-settings.tsx';
import { type ChatImageAttachment, useChatStore } from './chat-store.ts';
import { useChatImages } from './use-chat-images.ts';

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

function handleStartTurnError(
  info: ErrorInfo,
  promptToSend: string,
  docsToSend: readonly string[],
  imagesToSend: readonly ChatImageAttachment[],
  setSendError: (err: string | undefined) => void,
  tError: TFunction<'errors'>,
): void {
  // The refused request goes back into the input, attached images included.
  useChatStore.setState((s) => ({
    turns: s.turns.filter((t) => t.state !== 'running'),
    draft: promptToSend,
    docs: docsToSend,
    images: imagesToSend,
  }));

  if (info.code === 'E026') {
    const rawAgent = info.params?.agent;
    const agentId: AgentId = rawAgent === 'claude' ? 'claude' : 'agy';
    if (info.params?.reason === 'notLoggedIn') {
      void useAgentsStore.getState().startLogin(agentId, true);
      return;
    }
    if (info.params?.reason === 'notInstalled') {
      void useAgentsStore.getState().refresh();
      return;
    }
  }

  setSendError(errorText(tError, info.code, info.params));
}

function useSendTurn() {
  const { t: tError } = useTranslation('errors');
  const [sendError, setSendError] = useState<string>();

  const send = async (
    promptToSend: string,
    docsToSend: readonly string[],
    imageIds?: readonly string[],
    previewUrls?: readonly string[],
  ) => {
    setSendError(undefined);
    const context = buildTurnContext();
    const conversation = useChatStore.getState().hasConversation ? 'continue' : 'new';
    const pendingImages = useChatStore.getState().images;
    useChatStore.getState().startLocal(promptToSend, '', previewUrls);
    try {
      const res = await startTurn({
        prompt: promptToSend,
        context,
        conversation,
        docs: [...docsToSend],
        ...(imageIds !== undefined && imageIds.length > 0 ? { images: [...imageIds] } : {}),
      });
      useChatStore.getState().setRunningJobId(res.jobId);
    } catch (err) {
      handleStartTurnError(
        toErrorInfo(err),
        promptToSend,
        docsToSend,
        pendingImages,
        setSendError,
        tError,
      );
    }
  };

  return { sendError, send };
}

type ChatSendButtonProps = {
  readonly canSend: boolean;
  readonly agent?: AgentStatus | undefined;
  readonly onSend: () => void;
};

function ChatSendButton({ canSend, agent, onSend }: ChatSendButtonProps) {
  const { t } = useTranslation('chat');
  return (
    <div className="flex min-w-0 items-center justify-end gap-1.5 pt-1">
      {agent !== undefined && <AgentSettings agent={agent} />}
      <button
        type="button"
        data-testid="chat-send"
        disabled={!canSend}
        title={t('send')}
        aria-label={t('send')}
        onClick={onSend}
        className="flex size-7 shrink-0 items-center justify-center rounded-md bg-charcoal text-on-charcoal hover:bg-primary-hover disabled:opacity-40 font-medium"
      >
        <ArrowUp className="size-4" />
      </button>
    </div>
  );
}

export type ChatInputProps = {
  readonly disabled?: boolean;
  /** The agent the chat talks to: shows its model, effort and limits by Send. */
  readonly agent?: AgentStatus | undefined;
};

function collectReadyImages(images: readonly ChatImageAttachment[]): {
  readonly ids: readonly string[];
  readonly urls: readonly string[];
} {
  const ids: string[] = [];
  const urls: string[] = [];
  for (const img of images) {
    if (img.state === 'ready' && typeof img.id === 'string') {
      ids.push(img.id);
      urls.push(img.previewUrl);
    }
  }
  return { ids, urls };
}

type SendTurn = (
  prompt: string,
  docs: readonly string[],
  imageIds?: readonly string[],
  previewUrls?: readonly string[],
) => Promise<void>;

/** Sends what the input holds: text, documents and the images that finished uploading. */
function sendFromStore(send: SendTurn): void {
  const state = useChatStore.getState();
  const currentDraft = state.draft.trim();
  if (!currentDraft || state.images.some((img) => img.state === 'uploading')) return;
  const { ids, urls } = collectReadyImages(state.images);
  void send(currentDraft, state.docs, ids, urls);
}

/** How long "Signed in" stays on screen once the request is sent again. */
const LOGIN_DONE_VISIBLE_MS = 1000;

function useAutoResend(send: SendTurn) {
  const loginFlow = useAgentsStore((s) => s.loginFlow);
  const sentFlowRef = useRef<LoginFlow | undefined>(undefined);

  useEffect(() => {
    if (loginFlow?.phase !== 'done' || !loginFlow.resend || sentFlowRef.current === loginFlow) {
      return;
    }
    // The ref survives StrictMode's second effect run, so the request goes out once.
    sentFlowRef.current = loginFlow;
    sendFromStore(send);
    // Not cleared on cleanup: a re-render must not keep the card open. Only this flow is closed.
    setTimeout(() => {
      if (useAgentsStore.getState().loginFlow === loginFlow) {
        useAgentsStore.getState().finishLogin();
      }
    }, LOGIN_DONE_VISIBLE_MS);
  }, [loginFlow, send]);
}

function extractPastedImages(files?: FileList | readonly File[]): readonly File[] {
  if (!files || files.length === 0) return [];
  const result: File[] = [];
  for (let i = 0; i < files.length; i += 1) {
    const item = files[i];
    if (item && item.type.startsWith('image/')) {
      result.push(item);
    }
  }
  return result;
}

type ChatInputFieldProps = {
  readonly disabled: boolean;
  readonly draft: string;
  readonly canSend: boolean;
  readonly agent?: AgentStatus | undefined;
  readonly onDraftChange: (text: string) => void;
  readonly onSend: () => void;
  readonly onAddFiles: (files: FileList | readonly File[]) => Promise<void>;
  readonly onDropPath: (path: string) => void;
};

function onPasteImages(
  e: ClipboardEvent<HTMLTextAreaElement>,
  onAddFiles: (files: FileList | readonly File[]) => Promise<void>,
) {
  const pasted = extractPastedImages(e.clipboardData.files);
  if (pasted.length > 0) {
    e.preventDefault();
    void onAddFiles(pasted);
  }
}

function handleInputDrop(
  e: DragEvent<HTMLDivElement>,
  onDropPath: (path: string) => void,
  onAddFiles: (files: FileList | readonly File[]) => Promise<void>,
) {
  e.preventDefault();
  const customPath = e.dataTransfer.getData('application/x-kumicraft-path');
  if (customPath) {
    onDropPath(customPath);
    return;
  }
  if (e.dataTransfer.files.length > 0) {
    void onAddFiles(e.dataTransfer.files);
  }
}

function ChatInputField({
  disabled,
  draft,
  canSend,
  agent,
  onDraftChange,
  onSend,
  onAddFiles,
  onDropPath,
}: ChatInputFieldProps) {
  const { t } = useTranslation('chat');

  // Enter sends, Shift+Enter starts a new line, as in other chat apps. Enter that confirms a word
  // of an input method (IME) is left to it.
  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key !== 'Enter' || e.shiftKey || e.altKey || e.nativeEvent.isComposing) return;
    e.preventDefault();
    if (canSend) onSend();
  };

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
      }}
      onDrop={(e) => {
        handleInputDrop(e, onDropPath, onAddFiles);
      }}
      className="relative rounded-lg border border-line bg-card-solid p-2 focus-within:border-accent focus-within:shadow-[0_0_0_3px_rgb(42_98_217/0.18)]"
    >
      <textarea
        data-testid="chat-input"
        disabled={disabled}
        placeholder={t('inputPlaceholder')}
        value={draft}
        rows={3}
        onChange={(e) => {
          onDraftChange(e.target.value);
        }}
        onKeyDown={handleKeyDown}
        onPaste={(e) => {
          onPasteImages(e, onAddFiles);
        }}
        className="w-full resize-none border-0 bg-transparent text-xs text-ink placeholder:text-ink-faint focus:outline-none disabled:opacity-50"
      />
      <ChatSendButton canSend={canSend} agent={agent} onSend={onSend} />
    </div>
  );
}

export function ChatInput({ disabled = false, agent }: ChatInputProps) {
  const { t: tCommon } = useTranslation();
  const draft = useChatStore((s) => s.draft);
  const setDraft = useChatStore((s) => s.setDraft);
  const { isUploading, addFiles } = useChatImages();
  const { sendError, send } = useSendTurn();
  const [docError, setDocError] = useState<string | undefined>();
  useAutoResend(send);

  const canSend = !disabled && Boolean(draft.trim()) && !isUploading;
  const handleDropPath = (path: string) => {
    if (useChatStore.getState().docs.length >= 10) {
      setDocError(tCommon('files.maxDocsError'));
      return;
    }
    setDocError(undefined);
    useChatStore.getState().addDoc(path);
  };

  return (
    <div className="flex flex-col gap-2 border-t border-line pt-2">
      {sendError !== undefined && (
        <p data-testid="chat-send-error" className="text-xs text-danger">
          {sendError}
        </p>
      )}
      {docError !== undefined && (
        <p data-testid="chat-doc-error" className="text-xs text-danger">
          {docError}
        </p>
      )}
      <ChatInputField
        disabled={disabled}
        draft={draft}
        canSend={canSend}
        agent={agent}
        onDraftChange={setDraft}
        onSend={() => {
          if (!disabled) sendFromStore(send);
        }}
        onAddFiles={addFiles}
        onDropPath={handleDropPath}
      />
    </div>
  );
}
