// Displays one AI agent status, docs link, and context actions (R-AG-10, R-AG-21).
import type { AgentId, AgentStatus } from '@kumicraft/shared';
import type { TFunction } from 'i18next';
import { useTranslation } from 'react-i18next';

export type AgentCardVariant = 'onboarding' | 'settings';

export type AgentCardProps = {
  readonly agent: AgentStatus;
  readonly variant: AgentCardVariant;
  readonly onInstall?: (agent: AgentStatus) => void;
  readonly onUse?: (id: AgentId) => void;
  readonly onLogin?: (id: AgentId) => void;
  readonly onRecheck?: () => void;
};

export function agentDisplayName(id: AgentId): string {
  return id === 'agy' ? 'Antigravity CLI' : 'Claude Code';
}

function resolveStatusText(agent: AgentStatus, t: TFunction<'chat'>): string {
  if (!agent.installed) return t('statusUninstalled');
  const parts: string[] = [t('statusInstalled')];
  if (agent.version !== undefined && agent.version.length > 0) {
    parts.push(agent.version);
  }
  if (agent.login === 'loggedIn') parts.push(t('loginStatusLoggedIn'));
  else if (agent.login === 'loggedOut') parts.push(t('loginStatusLoggedOut'));
  else parts.push(t('loginStatusUnknown'));
  return parts.join(' · ');
}

function OnboardingActions({
  agent,
  onInstall,
  onUse,
}: {
  readonly agent: AgentStatus;
  readonly onInstall?: ((agent: AgentStatus) => void) | undefined;
  readonly onUse?: ((id: AgentId) => void) | undefined;
}) {
  const { t } = useTranslation('chat');
  if (!agent.installed) {
    return (
      <div className="flex items-center gap-3">
        {agent.docsUrl !== undefined && (
          <a
            href={agent.docsUrl}
            target="_blank"
            rel="noreferrer noopener"
            className="text-xs text-accent hover:underline cursor-pointer"
          >
            {t('officialDocs')}
          </a>
        )}
        <button
          type="button"
          data-testid={`agent-install-${agent.id}`}
          onClick={() => {
            onInstall?.(agent);
          }}
          className="rounded-full bg-primary px-3 py-1 text-xs font-medium text-white hover:bg-primary-hover cursor-pointer"
        >
          {t('install')}
        </button>
      </div>
    );
  }
  return (
    <button
      type="button"
      data-testid={`agent-use-${agent.id}`}
      onClick={() => {
        onUse?.(agent.id);
      }}
      className="rounded-full bg-primary px-3 py-1 text-xs font-medium text-white hover:bg-primary-hover cursor-pointer"
    >
      {t('useThisAgent')}
    </button>
  );
}

function SettingsInstalledActions({
  agent,
  onLogin,
  onRecheck,
}: {
  readonly agent: AgentStatus;
  readonly onLogin?: ((id: AgentId) => void) | undefined;
  readonly onRecheck?: (() => void) | undefined;
}) {
  const { t } = useTranslation('chat');
  return (
    <>
      {agent.loginAvailable && (
        <button
          type="button"
          data-testid={`agent-login-${agent.id}`}
          onClick={() => {
            onLogin?.(agent.id);
          }}
          className="rounded-full bg-field px-3 py-1 text-xs text-ink hover:bg-field-hover cursor-pointer"
        >
          {t('login')}
        </button>
      )}
      <button
        type="button"
        data-testid={`agent-recheck-${agent.id}`}
        onClick={() => {
          onRecheck?.();
        }}
        className="rounded-full bg-field px-3 py-1 text-xs text-ink hover:bg-field-hover cursor-pointer"
      >
        {t('recheck')}
      </button>
    </>
  );
}

function SettingsActions({
  agent,
  onInstall,
  onLogin,
  onRecheck,
}: {
  readonly agent: AgentStatus;
  readonly onInstall?: ((agent: AgentStatus) => void) | undefined;
  readonly onLogin?: ((id: AgentId) => void) | undefined;
  readonly onRecheck?: (() => void) | undefined;
}) {
  const { t } = useTranslation('chat');
  return (
    <div className="flex items-center gap-2">
      {!agent.installed ? (
        <button
          type="button"
          data-testid={`agent-install-${agent.id}`}
          onClick={() => {
            onInstall?.(agent);
          }}
          className="rounded-full bg-primary px-3 py-1 text-xs font-medium text-white hover:bg-primary-hover cursor-pointer"
        >
          {t('install')}
        </button>
      ) : (
        <SettingsInstalledActions agent={agent} onLogin={onLogin} onRecheck={onRecheck} />
      )}
    </div>
  );
}

export function AgentCard({
  agent,
  variant,
  onInstall,
  onUse,
  onLogin,
  onRecheck,
}: AgentCardProps) {
  const { t } = useTranslation('chat');
  const name = agentDisplayName(agent.id);
  const status = resolveStatusText(agent, t);

  return (
    <div
      data-testid={`agent-card-${agent.id}`}
      className="flex items-center justify-between gap-3 rounded-lg border border-border bg-field/30 p-3"
    >
      <div className="flex flex-col gap-0.5 min-w-0">
        <span className="text-xs font-medium text-ink truncate">{name}</span>
        <span data-testid={`agent-status-${agent.id}`} className="text-[11px] text-ink-soft">
          {status}
        </span>
      </div>
      {variant === 'onboarding' ? (
        <OnboardingActions agent={agent} onInstall={onInstall} onUse={onUse} />
      ) : (
        <SettingsActions
          agent={agent}
          onInstall={onInstall}
          onLogin={onLogin}
          onRecheck={onRecheck}
        />
      )}
    </div>
  );
}
