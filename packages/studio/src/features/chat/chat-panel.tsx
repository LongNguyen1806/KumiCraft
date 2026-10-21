// Main AI chat panel assembling lock states, thread, context, docs, backends, and input (WP-3.05a, R-CH-01, R-CH-06).
import type { AgentStatus } from '@reactcraft/shared';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { fetchAgents } from '../../api/agent-client.ts';
import { ChatBackends } from './chat-backends.tsx';
import { ChatContext } from './chat-context.tsx';
import { ChatDocs } from './chat-docs.tsx';
import { ChatInput } from './chat-input.tsx';
import { ChatLock } from './chat-lock.tsx';
import { useChatStore } from './chat-store.ts';
import { ChatThread } from './chat-thread.tsx';
import { useChatEvents } from './use-chat-events.ts';

export type ChatPanelProps = {
  readonly trusted: boolean;
};

function useAgentDiscovery(trusted: boolean) {
  const [agents, setAgents] = useState<readonly AgentStatus[]>();
  const [checking, setChecking] = useState(trusted);

  useEffect(() => {
    if (!trusted) return;
    let active = true;
    const discover = async () => {
      setChecking(true);
      try {
        const statuses = await fetchAgents();
        if (active) setAgents(statuses);
      } catch {
        if (active) setAgents([]);
      } finally {
        if (active) setChecking(false);
      }
    };
    void discover();
    return () => {
      active = false;
    };
  }, [trusted]);

  return { agents, checking };
}

function LockedChatView({ reason }: { readonly reason: 'untrusted' | 'no-agent' }) {
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

function ActiveChatView({ hasRunningTurn }: { readonly hasRunningTurn: boolean }) {
  const turns = useChatStore((s) => s.turns);
  return (
    <div className="flex flex-col gap-3 min-h-0 flex-1 justify-between">
      <div className="min-h-0 flex-1 overflow-y-auto">
        <ChatThread turns={turns} />
      </div>
      <div className="flex flex-col gap-2 shrink-0">
        <ChatBackends />
        <ChatDocs />
        <ChatContext />
        <ChatInput disabled={hasRunningTurn} />
      </div>
    </div>
  );
}

export function ChatPanel({ trusted }: ChatPanelProps) {
  const { t } = useTranslation('chat');
  useChatEvents();
  const { agents, checking } = useAgentDiscovery(trusted);
  const turns = useChatStore((s) => s.turns);
  const hasRunningTurn = turns.some((tView) => tView.state === 'running');

  if (!trusted) {
    return (
      <div data-testid="chat-panel" className="flex h-full min-h-0 flex-col">
        <LockedChatView reason="untrusted" />
      </div>
    );
  }

  if (checking) {
    return (
      <div
        data-testid="chat-panel"
        className="flex h-full min-h-0 flex-col items-center justify-center p-4"
      >
        <span className="text-xs text-ink-soft animate-pulse">{t('checkingAgents')}</span>
      </div>
    );
  }

  const hasInstalledAgent = agents !== undefined && agents.some((a) => a.installed);
  if (!hasInstalledAgent) {
    return (
      <div data-testid="chat-panel" className="flex h-full min-h-0 flex-col">
        <LockedChatView reason="no-agent" />
      </div>
    );
  }

  return (
    <div data-testid="chat-panel" className="flex h-full min-h-0 flex-col">
      <ActiveChatView hasRunningTurn={hasRunningTurn} />
    </div>
  );
}
