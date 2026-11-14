// Zustand store for AI chat panel state and turns (WP-3.05a, WP-3.05b, R-CH-01, R-CH-02, R-CH-03, R-CH-05).
import type { AgentEvent, TurnSummary } from '@kumicraft/shared';
import { create, type StateCreator } from 'zustand';

import type { ErrorInfo } from '../../routes/error-text.ts';

export type ChatItem =
  | {
      readonly kind: 'user';
      readonly text: string;
      readonly images?: readonly string[] | undefined;
    }
  | { readonly kind: 'message'; readonly text: string }
  | { readonly kind: 'tool'; readonly name: string; readonly target?: string | undefined }
  | { readonly kind: 'error'; readonly message: string };

export type ChatImageAttachment = {
  readonly localId: string;
  readonly previewUrl: string;
  readonly state: 'uploading' | 'ready';
  readonly id?: string | undefined;
};

export type ChatTurnView = {
  readonly jobId: string;
  readonly turnId?: string | undefined;
  readonly state: 'running' | 'completed' | 'failed' | 'cancelled';
  readonly items: readonly ChatItem[];
  readonly summary?: TurnSummary | undefined;
  readonly history?: boolean | undefined;
  readonly error?: ErrorInfo | undefined;
};

export type ChatHiddenContext = {
  readonly element: boolean;
  readonly page: boolean;
  readonly frame: boolean;
};

/** How a turn ended, as the server reported it. */
type TurnOutcome = Pick<ChatTurnView, 'state' | 'summary' | 'error'>;

export type ChatState = {
  readonly turns: readonly ChatTurnView[];
  /**
   * Outcomes that arrived before `startTurn` returned the job id (a turn can fail at once, e.g. a
   * project too large): applied when the id is known, so the turn never stays "running".
   */
  readonly earlyOutcomes: Readonly<Record<string, TurnOutcome>>;
  readonly draft: string;
  readonly docs: readonly string[];
  readonly images: readonly ChatImageAttachment[];
  readonly imageError?: string | undefined;
  readonly hidden: ChatHiddenContext;
  readonly hasConversation: boolean;
  /** A message was sent since the Studio opened (the model chip stops glowing). */
  readonly sentThisVisit: boolean;
  /** The agent conversation the chat shows; absent: a new one or turns saved before sessions. */
  readonly sessionId?: string | undefined;

  readonly setDraft: (draft: string) => void;
  readonly addDoc: (path: string) => void;
  readonly removeDoc: (path: string) => void;
  readonly addImage: (image: ChatImageAttachment) => void;
  readonly updateImage: (localId: string, patch: Partial<ChatImageAttachment>) => void;
  readonly removeImage: (localId: string) => void;
  readonly clearImages: () => void;
  readonly setImageError: (err?: string) => void;
  readonly setHidden: (key: keyof ChatHiddenContext, value: boolean) => void;
  readonly clearHidden: () => void;
  readonly startLocal: (prompt: string, initialJobId?: string, images?: readonly string[]) => void;
  readonly setRunningJobId: (jobId: string) => void;
  readonly applyAgentEvent: (turnId: string, event: AgentEvent) => void;
  readonly finishJobCompleted: (jobId: string, summary?: TurnSummary) => void;
  readonly finishJobFailed: (jobId: string, error: ErrorInfo) => void;
  readonly finishJobCancelled: (jobId: string) => void;
  readonly loadHistory: (summaries: readonly TurnSummary[]) => void;
  readonly markReverted: (turnId: string, summary: TurnSummary) => void;
  readonly newConversation: () => void;
  /** Shows one session's turns (oldest first); with an id, the next turn continues it. */
  readonly showSession: (turns: readonly TurnSummary[], id: string | undefined) => void;
  readonly reset: () => void;
};

const INITIAL_HIDDEN: ChatHiddenContext = {
  element: false,
  page: false,
  frame: false,
};

function appendAgentEvent(items: readonly ChatItem[], event: AgentEvent): readonly ChatItem[] {
  // Usage goes to the usage store, not the thread.
  if (event.kind === 'conversation' || event.kind === 'usage') return items;
  if (event.kind === 'tool') {
    return [...items, { kind: 'tool', name: event.name, target: event.target }];
  }
  if (event.kind === 'error') {
    return [...items, { kind: 'error', message: event.message }];
  }
  const lastIndex = items.length - 1;
  const last = items[lastIndex];
  if (last !== undefined && last.kind === 'message') {
    const updated: ChatItem = { kind: 'message', text: last.text + event.text };
    return [...items.slice(0, lastIndex), updated];
  }
  return [...items, { kind: 'message', text: event.text }];
}

function updateTurnWithEvent(turn: ChatTurnView, turnId: string, event: AgentEvent): ChatTurnView {
  if (turn.state !== 'running') return turn;
  if (turn.turnId !== undefined && turn.turnId !== turnId) return turn;
  const actualTurnId = turn.turnId ?? turnId;
  const items = appendAgentEvent(turn.items, event);
  return { ...turn, turnId: actualTurnId, items };
}

type SetState = Parameters<StateCreator<ChatState>>[0];

function createInputActions(set: SetState) {
  return {
    setDraft: (draft: string) => {
      set({ draft });
    },
    addDoc: (path: string) => {
      set((state) => {
        const trimmed = path.trim();
        if (!trimmed || state.docs.includes(trimmed) || state.docs.length >= 10) return state;
        return { docs: [...state.docs, trimmed] };
      });
    },
    removeDoc: (path: string) => {
      set((state) => ({ docs: state.docs.filter((d) => d !== path) }));
    },
    addImage: (image: ChatImageAttachment) => {
      set((state) => {
        if (state.images.length >= 5) return state;
        return { images: [...state.images, image] };
      });
    },
    updateImage: (localId: string, patch: Partial<ChatImageAttachment>) => {
      set((state) => ({
        images: state.images.map((img) => (img.localId === localId ? { ...img, ...patch } : img)),
      }));
    },
    removeImage: (localId: string) => {
      set((state) => ({
        images: state.images.filter((img) => img.localId !== localId),
      }));
    },
    clearImages: () => {
      set({ images: [], imageError: undefined });
    },
    setImageError: (imageError?: string) => {
      set({ imageError });
    },
    setHidden: (key: keyof ChatHiddenContext, value: boolean) => {
      set((state) => ({ hidden: { ...state.hidden, [key]: value } }));
    },
    clearHidden: () => {
      set({ hidden: INITIAL_HIDDEN });
    },
  };
}

function toHistoryTurn(summary: TurnSummary): ChatTurnView {
  return {
    jobId: '',
    turnId: summary.id,
    state: summary.state,
    items: [
      { kind: 'user', text: summary.prompt },
      ...(summary.reply === undefined ? [] : [{ kind: 'message' as const, text: summary.reply }]),
    ],
    summary,
    history: true,
  };
}

function mergeHistory(
  existingTurns: readonly ChatTurnView[],
  summaries: readonly TurnSummary[],
): readonly ChatTurnView[] {
  const liveTurns = existingTurns.filter((t) => !t.history);
  const liveTurnIds = new Set(
    liveTurns
      .map((t) => t.turnId)
      .filter((id): id is string => typeof id === 'string' && id.length > 0),
  );

  const updatedLiveTurns = liveTurns.map((t) => {
    if (t.turnId !== undefined && t.summary === undefined) {
      const match = summaries.find((s) => s.id === t.turnId);
      if (match !== undefined) return { ...t, summary: match };
    }
    return t;
  });

  const historyTurns = summaries.filter((s) => !liveTurnIds.has(s.id)).map(toHistoryTurn);

  historyTurns.sort((a, b) => {
    const aTime = a.summary?.startedAt ?? '';
    const bTime = b.summary?.startedAt ?? '';
    return aTime.localeCompare(bTime);
  });

  return [...historyTurns, ...updatedLiveTurns];
}

function createTurnLifecycleActions(set: SetState) {
  return {
    startLocal: (prompt: string, initialJobId = '', images?: readonly string[]) => {
      set((state) => ({
        turns: [
          ...state.turns,
          {
            jobId: initialJobId,
            turnId: undefined,
            state: 'running',
            items: [
              {
                kind: 'user',
                text: prompt,
                ...(images !== undefined && images.length > 0 ? { images } : {}),
              },
            ],
          },
        ],
        draft: '',
        images: [],
        hidden: INITIAL_HIDDEN,
        hasConversation: true,
        sentThisVisit: true,
      }));
    },
    setRunningJobId: (jobId: string) => {
      set((state) => {
        const { [jobId]: early, ...earlyOutcomes } = state.earlyOutcomes;
        return {
          earlyOutcomes,
          turns: state.turns.map((t) =>
            t.state === 'running' ? { ...t, jobId, ...(early ?? {}) } : t,
          ),
        };
      });
    },
    applyAgentEvent: (turnId: string, event: AgentEvent) => {
      set((state) => ({
        turns: state.turns.map((t) => updateTurnWithEvent(t, turnId, event)),
      }));
    },
  };
}

function settle(state: ChatState, jobId: string, outcome: TurnOutcome): Partial<ChatState> {
  if (!state.turns.some((t) => t.jobId === jobId)) {
    return { earlyOutcomes: { ...state.earlyOutcomes, [jobId]: outcome } };
  }
  return { turns: state.turns.map((t) => (t.jobId === jobId ? { ...t, ...outcome } : t)) };
}

function createJobOutcomeActions(set: SetState) {
  return {
    finishJobCompleted: (jobId: string, summary?: TurnSummary) => {
      set((state) => settle(state, jobId, { state: 'completed', summary }));
    },
    finishJobFailed: (jobId: string, error: ErrorInfo) => {
      set((state) => settle(state, jobId, { state: 'failed', error }));
    },
    finishJobCancelled: (jobId: string) => {
      set((state) => settle(state, jobId, { state: 'cancelled' }));
    },
    loadHistory: (summaries: readonly TurnSummary[]) => {
      set((state) => {
        const liveIds = new Set(state.turns.filter((t) => !t.history).map((t) => t.turnId));
        const shownIds = new Set(state.turns.map((t) => t.turnId));
        // A new session gets its id when its first turn ends.
        const sessionId =
          state.sessionId ??
          summaries.find((s) => liveIds.has(s.id) && s.conversation !== undefined)?.conversation;
        const picked = summaries.filter(
          (s) => shownIds.has(s.id) || (sessionId !== undefined && s.conversation === sessionId),
        );
        return { turns: mergeHistory(state.turns, picked), sessionId };
      });
    },
    markReverted: (turnId: string, summary: TurnSummary) => {
      set((state) => ({
        turns: state.turns.map((t) => (t.turnId === turnId ? { ...t, summary } : t)),
      }));
    },
  };
}

function createConversationActions(set: SetState) {
  return {
    newConversation: () => {
      // Like Claude and Antigravity: a new conversation starts on an empty chat (K9.5).
      set({ turns: [], hasConversation: false, sessionId: undefined });
    },
    showSession: (turns: readonly TurnSummary[], id: string | undefined) => {
      set({
        turns: mergeHistory([], turns),
        hasConversation: id !== undefined,
        sessionId: id,
      });
    },
    reset: () => {
      set({
        turns: [],
        earlyOutcomes: {},
        draft: '',
        docs: [],
        images: [],
        imageError: undefined,
        hidden: INITIAL_HIDDEN,
        hasConversation: false,
        sessionId: undefined,
      });
    },
  };
}

export const useChatStore = create<ChatState>((set) => ({
  turns: [],
  earlyOutcomes: {},
  draft: '',
  docs: [],
  images: [],
  imageError: undefined,
  hidden: INITIAL_HIDDEN,
  hasConversation: false,
  sentThisVisit: false,
  ...createInputActions(set),
  ...createTurnLifecycleActions(set),
  ...createJobOutcomeActions(set),
  ...createConversationActions(set),
}));
