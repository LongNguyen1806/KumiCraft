// Main AI chat panel assembling onboarding, locks, thread, context, docs, backends, and input (WP-3.05a, R-AG-21).
import type { AgentStatus } from '@reactcraft/shared';
import { Plus } from 'lucide-react';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';

import { useAgentsStore } from '../../store/agents-store.ts';
import { useSettingsStore } from '../../store/settings-store.ts';
import { AgentBadge } from '../agents/agent-badge.tsx';
import { AgentLoginCard } from '../agents/agent-login-card.tsx';
import { AgentOnboarding } from '../agents/agent-onboarding.tsx';
import { onboardingStep, selectedAgent } from '../agents/agent-select.ts';
import { useLoginWatcher } from '../agents/use-login-watcher.ts';
import { ChatBackends } from './chat-backends.tsx';
import { ChatContext } from './chat-context.tsx';
import { ChatDocs } from './chat-docs.tsx';
import { ChatInput } from './chat-input.tsx';
import { ChatLock } from './chat-lock.tsx';
import { useChatStore } from './chat-store.ts';
import { ChatThread } from './chat-thread.tsx';
import { useChatEvents } from './use-chat-events.ts';
import { useChatHistory } from './use-chat-history.ts';

export type ChatPanelProps = {
  readonly trusted: boolean;
};

function LockedChatView({ reason }: { readonly reason: 'untrusted' }) {
  return (
    <div className="flex flex-col gap-3 min-h-0 flex-1">
      <ChatLock reason={reason} />
      <div className="pt-2">
        <ChatBackends />
      </div>
      <div className="mt-auto">
        <ChatInput disabled />
      </div>
    </div>
  );
}

function NewConversationBar({ disabled }: { readonly disabled: boolean }) {
  const { t } = useTranslation('chat');

  return (
    <button
      type="button"
      data-testid="chat-new-conversation"
      disabled={disabled}
      onClick={() => {
        useChatStore.getState().newConversation();
      }}
      className="flex items-center gap-1.5 rounded px-2 py-1 text-xs text-ink-soft hover:bg-field hover:text-ink disabled:opacity-40 disabled:pointer-events-none cursor-pointer"
    >
      <Plus className="size-3.5" />
      <span>{t('newConversation')}</span>
    </button>
  );
}

function ActiveChatView({
  hasRunningTurn,
  activeAgent,
}: {
  readonly hasRunningTurn: boolean;
  readonly activeAgent?: AgentStatus | undefined;
}) {
  const turns = useChatStore((s) => s.turns);
  return (
    <div className="flex flex-col gap-3 min-h-0 flex-1 justify-between">
      <div className="flex items-center justify-between pb-1 border-b border-border/40">
        <NewConversationBar disabled={hasRunningTurn} />
        {activeAgent !== undefined && <AgentBadge agent={activeAgent} />}
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto">
        <ChatThread turns={turns} />
      </div>
      <div className="flex flex-col gap-2 shrink-0">
        <ChatBackends />
        <ChatDocs />
        <ChatContext />
        <AgentLoginCard />
        <ChatInput disabled={hasRunningTurn} />
      </div>
    </div>
  );
}

function OnboardingChatView({
  step,
  agents,
}: {
  readonly step: 'install' | 'choose';
  readonly agents: readonly AgentStatus[];
}) {
  return (
    <div className="flex flex-col gap-3 min-h-0 flex-1 justify-between">
      <div className="min-h-0 flex-1 overflow-y-auto">
        <AgentOnboarding step={step} agents={agents} />
      </div>
      <div className="flex flex-col gap-2 shrink-0">
        <ChatBackends />
        <ChatInput disabled />
      </div>
    </div>
  );
}

export function ChatPanel({ trusted }: ChatPanelProps) {
  const { t } = useTranslation('chat');
  useChatEvents();
  useLoginWatcher();

  const agents = useAgentsStore((s) => s.agents);
  const checking = useAgentsStore((s) => s.checking);
  const refresh = useAgentsStore((s) => s.refresh);
  const preferred = useSettingsStore((s) => s.settings?.agent.preferred ?? 'auto');

  useEffect(() => {
    if (trusted && agents === undefined) {
      void refresh();
    }
  }, [trusted, agents, refresh]);

  const step = onboardingStep(agents, preferred);
  const activeAgentId = selectedAgent(agents, preferred);
  const activeAgent = agents?.find((a) => a.id === activeAgentId);

  const turns = useChatStore((s) => s.turns);
  const hasRunningTurn = turns.some((tView) => tView.state === 'running');

  useChatHistory(trusted && step === 'ready' && activeAgent !== undefined);

  if (!trusted) {
    return (
      <div data-testid="chat-panel" className="flex h-full min-h-0 flex-col">
        <LockedChatView reason="untrusted" />
      </div>
    );
  }

  if (checking && agents === undefined) {
    return (
      <div
        data-testid="chat-panel"
        className="flex h-full min-h-0 flex-col items-center justify-center p-4"
      >
        <span className="text-xs text-ink-soft animate-pulse">{t('checkingAgents')}</span>
      </div>
    );
  }

  if (step === 'install' || step === 'choose') {
    return (
      <div data-testid="chat-panel" className="flex h-full min-h-0 flex-col">
        <OnboardingChatView step={step} agents={agents ?? []} />
      </div>
    );
  }

  return (
    <div data-testid="chat-panel" className="flex h-full min-h-0 flex-col">
      <ActiveChatView hasRunningTurn={hasRunningTurn} activeAgent={activeAgent} />
    </div>
  );
}
