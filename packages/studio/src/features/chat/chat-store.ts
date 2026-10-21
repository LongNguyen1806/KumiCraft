// Zustand store for AI chat panel state and turns (WP-3.05a, R-CH-01, R-CH-02, R-CH-03).
import type { AgentEvent } from '@reactcraft/shared';
import { create, type StateCreator } from 'zustand';

import type { ErrorInfo } from '../../routes/error-text.ts';

export type ChatItem =
  | { readonly kind: 'user'; readonly text: string }
  | { readonly kind: 'message'; readonly text: string }
  | { readonly kind: 'tool'; readonly name: string; readonly target?: string | undefined }
  | { readonly kind: 'error'; readonly message: string };

export type ChatTurnView = {
  readonly jobId: string;
  readonly turnId?: string | undefined;
  readonly state: 'running' | 'completed' | 'failed' | 'cancelled';
  readonly items: readonly ChatItem[];
  readonly fileCount?: number | undefined;
  readonly error?: ErrorInfo | undefined;
};

export type ChatHiddenContext = {
  readonly element: boolean;
  readonly page: boolean;
  readonly frame: boolean;
};

/** How a turn ended, as the server reported it. */
type TurnOutcome = Pick<ChatTurnView, 'state' | 'fileCount' | 'error'>;

export type ChatState = {
  readonly turns: readonly ChatTurnView[];
  /**
   * Outcomes that arrived before `startTurn` returned the job id (a turn can fail at once, e.g. a
   * project too large): applied when the id is known, so the turn never stays "running".
   */
  readonly earlyOutcomes: Readonly<Record<string, TurnOutcome>>;
  readonly draft: string;
  readonly docs: readonly string[];
  readonly hidden: ChatHiddenContext;
  readonly hasConversation: boolean;

  readonly setDraft: (draft: string) => void;
  readonly addDoc: (path: string) => void;
  readonly removeDoc: (path: string) => void;
  readonly setHidden: (key: keyof ChatHiddenContext, value: boolean) => void;
  readonly clearHidden: () => void;
  readonly startLocal: (prompt: string, initialJobId?: string) => void;
  readonly setRunningJobId: (jobId: string) => void;
  readonly applyAgentEvent: (turnId: string, event: AgentEvent) => void;
  readonly finishJobCompleted: (jobId: string, fileCount?: number) => void;
  readonly finishJobFailed: (jobId: string, error: ErrorInfo) => void;
  readonly finishJobCancelled: (jobId: string) => void;
  readonly reset: () => void;
};

const INITIAL_HIDDEN: ChatHiddenContext = {
  element: false,
  page: false,
  frame: false,
};

function appendAgentEvent(items: readonly ChatItem[], event: AgentEvent): readonly ChatItem[] {
  if (event.kind === 'conversation') return items;
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
    setHidden: (key: keyof ChatHiddenContext, value: boolean) => {
      set((state) => ({ hidden: { ...state.hidden, [key]: value } }));
    },
    clearHidden: () => {
      set({ hidden: INITIAL_HIDDEN });
    },
  };
}

function createTurnLifecycleActions(set: SetState) {
  return {
    startLocal: (prompt: string, initialJobId = '') => {
      set((state) => ({
        turns: [
          ...state.turns,
          {
            jobId: initialJobId,
            turnId: undefined,
            state: 'running',
            items: [{ kind: 'user', text: prompt }],
          },
        ],
        draft: '',
        docs: [],
        hidden: INITIAL_HIDDEN,
        hasConversation: true,
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
    finishJobCompleted: (jobId: string, fileCount?: number) => {
      set((state) => settle(state, jobId, { state: 'completed', fileCount }));
    },
    finishJobFailed: (jobId: string, error: ErrorInfo) => {
      set((state) => settle(state, jobId, { state: 'failed', error }));
    },
    finishJobCancelled: (jobId: string) => {
      set((state) => settle(state, jobId, { state: 'cancelled' }));
    },
    reset: () => {
      set({
        turns: [],
        earlyOutcomes: {},
        draft: '',
        docs: [],
        hidden: INITIAL_HIDDEN,
        hasConversation: false,
      });
    },
  };
}

export const useChatStore = create<ChatState>((set) => ({
  turns: [],
  earlyOutcomes: {},
  draft: '',
  docs: [],
  hidden: INITIAL_HIDDEN,
  hasConversation: false,
  ...createInputActions(set),
  ...createTurnLifecycleActions(set),
  ...createJobOutcomeActions(set),
}));
