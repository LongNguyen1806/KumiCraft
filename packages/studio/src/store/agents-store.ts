// Store for AI agents discovery, status, and login flow (R-AG-10, R-AG-21, R-CH-06).
import type { AgentId, AgentStatus } from '@reactcraft/shared';
import { create } from 'zustand';

import { fetchAgents, openAgentLogin } from '../api/agent-client.ts';
import { type ErrorInfo, toErrorInfo } from '../routes/error-text.ts';

export type LoginFlowPhase = 'opening' | 'waiting' | 'done' | 'timedOut' | 'failed';

export type LoginFlow = {
  readonly agent: AgentId;
  readonly phase: LoginFlowPhase;
  readonly manual: boolean;
  readonly error?: ErrorInfo | undefined;
  readonly resend: boolean;
};

export type AgentsState = {
  readonly agents?: readonly AgentStatus[] | undefined;
  readonly checking: boolean;
  readonly loginFlow?: LoginFlow | undefined;
  readonly refresh: () => Promise<void>;
  readonly startLogin: (agent: AgentId, resend: boolean) => Promise<void>;
  readonly cancelLogin: () => void;
  readonly finishLogin: () => void;
  readonly setLoginPhase: (phase: LoginFlowPhase, error?: ErrorInfo) => void;
  readonly reset: () => void;
};

let refreshPromise: Promise<void> | undefined;

function isManualAgent(agents: readonly AgentStatus[] | undefined, id: AgentId): boolean {
  const found = agents?.find((a) => a.id === id);
  return found?.login === 'unknown' || id === 'claude';
}

function resolveNextFlow(
  flow: LoginFlow | undefined,
  agents: readonly AgentStatus[],
): LoginFlow | undefined {
  if (flow === undefined || flow.phase !== 'waiting' || flow.manual) return flow;
  const target = agents.find((a) => a.id === flow.agent);
  if (target?.login === 'loggedIn') {
    return { ...flow, phase: 'done', error: undefined };
  }
  return flow;
}

async function executeRefresh(
  set: (fn: (state: AgentsState) => Partial<AgentsState>) => void,
): Promise<void> {
  try {
    const agents = await fetchAgents();
    set((state) => ({
      agents,
      checking: false,
      loginFlow: resolveNextFlow(state.loginFlow, agents),
    }));
  } catch {
    // A failed poll keeps what is known, so the chat does not fall back to the install step.
    set((state) => ({ agents: state.agents ?? [], checking: false }));
  } finally {
    refreshPromise = undefined;
  }
}

async function executeStartLogin(
  agent: AgentId,
  resend: boolean,
  set: (fn: (state: AgentsState) => Partial<AgentsState>) => void,
  get: () => AgentsState,
): Promise<void> {
  const manual = isManualAgent(get().agents, agent);
  set(() => ({ loginFlow: { agent, phase: 'opening', manual, resend } }));
  try {
    await openAgentLogin(agent);
    set((state) =>
      state.loginFlow === undefined
        ? {}
        : {
            loginFlow: { ...state.loginFlow, phase: 'waiting', error: undefined },
          },
    );
  } catch (err) {
    const error = toErrorInfo(err);
    set((state) =>
      state.loginFlow === undefined
        ? {}
        : {
            loginFlow: { ...state.loginFlow, phase: 'failed', error },
          },
    );
  }
}

export const useAgentsStore = create<AgentsState>((set, get) => ({
  agents: undefined,
  checking: false,
  loginFlow: undefined,
  refresh: async () => {
    if (refreshPromise !== undefined) return refreshPromise;
    set(() => ({ checking: true }));
    refreshPromise = executeRefresh(set);
    return refreshPromise;
  },
  startLogin: async (agent, resend) => executeStartLogin(agent, resend, set, get),
  cancelLogin: () => {
    set(() => ({ loginFlow: undefined }));
  },
  finishLogin: () => {
    set(() => ({ loginFlow: undefined }));
  },
  setLoginPhase: (phase, error) => {
    set((state) => {
      if (state.loginFlow === undefined) return {};
      return {
        loginFlow: {
          ...state.loginFlow,
          phase,
          error: error ?? state.loginFlow.error,
        },
      };
    });
  },
  reset: () => {
    refreshPromise = undefined;
    set(() => ({ agents: undefined, checking: false, loginFlow: undefined }));
  },
}));
