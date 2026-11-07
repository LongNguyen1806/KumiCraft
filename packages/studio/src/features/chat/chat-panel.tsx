// Main AI chat panel assembling onboarding, locks, thread, context, docs, backends, and input (WP-3.05a, R-AG-21).
import type { AgentStatus, BackendInfo } from '@kumicraft/shared';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { removeProjectBackend } from '../../api/project-client.ts';
import { errorText, toErrorInfo } from '../../routes/error-text.ts';
import { useAgentsStore } from '../../store/agents-store.ts';
import { useSettingsStore } from '../../store/settings-store.ts';
import { AgentLoginCard } from '../agents/agent-login-card.tsx';
import { AgentOnboarding } from '../agents/agent-onboarding.tsx';
import { onboardingStep, selectedAgent } from '../agents/agent-select.ts';
import { useLoginWatcher } from '../agents/use-login-watcher.ts';
import { ChatAttachments } from './chat-attachments.tsx';
import { useProjectBackends } from './chat-backends.tsx';
import { ChatContext } from './chat-context.tsx';
import { ChatInput } from './chat-input.tsx';
import { ChatLock } from './chat-lock.tsx';
import { useChatStore } from './chat-store.ts';
import { ChatThread } from './chat-thread.tsx';
import { ChatToolbar } from './chat-toolbar.tsx';
import { ImportDialog } from './import-dialog.tsx';
import { useChatEvents } from './use-chat-events.ts';
import { useChatHistory } from './use-chat-history.ts';
import { useChatImages } from './use-chat-images.ts';

export type ChatPanelProps = {
  readonly trusted: boolean;
};

function LockedChatView({ reason }: { readonly reason: 'untrusted' }) {
  return (
    <div className="flex flex-col gap-3 min-h-0 flex-1">
      <ChatLock reason={reason} />
      <div className="mt-auto">
        <ChatInput disabled />
      </div>
    </div>
  );
}

function CheckingAgentsView() {
  const { t } = useTranslation('chat');
  return (
    <div
      data-testid="chat-panel"
      className="flex h-full min-h-0 flex-col items-center justify-center p-4"
    >
      <span className="text-xs text-ink-soft animate-pulse">{t('checkingAgents')}</span>
    </div>
  );
}

function useBackendRemover(reloadBackends: () => Promise<void>) {
  const { t: tError } = useTranslation('errors');
  const [backendError, setBackendError] = useState<string>();

  const remove = async (id: string) => {
    setBackendError(undefined);
    try {
      await removeProjectBackend(id);
      await reloadBackends();
    } catch (err) {
      const info = toErrorInfo(err);
      setBackendError(errorText(tError, info.code, info.params));
    }
  };

  return { backendError, remove };
}

type ActiveChatViewProps = {
  readonly hasRunningTurn: boolean;
  readonly activeAgent?: AgentStatus | undefined;
  readonly backends: readonly BackendInfo[];
  readonly reloadBackends: () => Promise<void>;
  readonly onOpenImport: () => void;
};

function ActiveChatView({
  hasRunningTurn,
  activeAgent,
  backends,
  reloadBackends,
  onOpenImport,
}: ActiveChatViewProps) {
  const turns = useChatStore((s) => s.turns);
  const docs = useChatStore((s) => s.docs);
  const removeDoc = useChatStore((s) => s.removeDoc);
  const { images, imageError, addFiles, removeAttachment } = useChatImages();
  const { backendError, remove: handleRemoveBackend } = useBackendRemover(reloadBackends);

  return (
    <div className="flex flex-col gap-2 min-h-0 flex-1 justify-between">
      <ChatToolbar
        disabled={hasRunningTurn}
        onOpenImport={onOpenImport}
        onPickImages={(files) => {
          void addFiles(files);
        }}
      />
      <ChatAttachments
        backends={backends}
        docs={docs}
        images={images}
        backendError={backendError}
        imageError={imageError}
        onRemoveBackend={(id) => {
          void handleRemoveBackend(id);
        }}
        onRemoveDoc={removeDoc}
        onRemoveImage={removeAttachment}
      />
      <div className="min-h-0 flex-1 overflow-y-auto">
        <ChatThread turns={turns} />
      </div>
      <div className="flex flex-col gap-2 shrink-0">
        <ChatContext />
        <AgentLoginCard />
        <ChatInput disabled={hasRunningTurn} agent={activeAgent} />
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
        <ChatInput disabled />
      </div>
    </div>
  );
}

function useActiveAgentState(trusted: boolean) {
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

  return { agents, checking, step, activeAgent };
}

type ChatPanelContentProps = {
  readonly hasRunningTurn: boolean;
  readonly activeAgent?: AgentStatus | undefined;
  readonly backends: readonly BackendInfo[];
  readonly reloadBackends: () => Promise<void>;
};

function ChatPanelContent({
  hasRunningTurn,
  activeAgent,
  backends,
  reloadBackends,
}: ChatPanelContentProps) {
  const [importOpen, setImportOpen] = useState(false);
  return (
    <div data-testid="chat-panel" className="flex h-full min-h-0 flex-col">
      <ActiveChatView
        hasRunningTurn={hasRunningTurn}
        activeAgent={activeAgent}
        backends={backends}
        reloadBackends={reloadBackends}
        onOpenImport={() => {
          setImportOpen(true);
        }}
      />
      {importOpen && (
        <ImportDialog
          onClose={() => {
            setImportOpen(false);
          }}
          onBackendAdded={() => {
            void reloadBackends();
          }}
        />
      )}
    </div>
  );
}

export function ChatPanel({ trusted }: ChatPanelProps) {
  useChatEvents();
  useLoginWatcher();

  const { backends, reload: reloadBackends } = useProjectBackends();
  const { agents, checking, step, activeAgent } = useActiveAgentState(trusted);

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
    return <CheckingAgentsView />;
  }

  if (step === 'install' || step === 'choose') {
    return (
      <div data-testid="chat-panel" className="flex h-full min-h-0 flex-col">
        <OnboardingChatView step={step} agents={agents ?? []} />
      </div>
    );
  }

  return (
    <ChatPanelContent
      hasRunningTurn={hasRunningTurn}
      activeAgent={activeAgent}
      backends={backends}
      reloadBackends={reloadBackends}
    />
  );
}
