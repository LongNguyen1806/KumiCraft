// Status badge at the top of the chat panel showing the active agent (R-AG-21).
import type { AgentLoginState, AgentStatus } from '@kumicraft/shared';
import type { TFunction } from 'i18next';
import { useTranslation } from 'react-i18next';

import { agentDisplayName } from './agent-card.tsx';

export type AgentBadgeProps = {
  readonly agent: AgentStatus;
};

function resolveDotClass(login: AgentLoginState): string {
  if (login === 'loggedIn') return 'bg-leaf';
  if (login === 'loggedOut') return 'bg-sun';
  return 'bg-charcoal/40';
}

function resolveLoginText(login: AgentLoginState, t: TFunction<'chat'>): string {
  if (login === 'loggedIn') return t('loginStatusLoggedIn');
  if (login === 'loggedOut') return t('loginStatusLoggedOut');
  return t('loginStatusUnknown');
}

export function AgentBadge({ agent }: AgentBadgeProps) {
  const { t } = useTranslation('chat');
  const name = agentDisplayName(agent.id);
  const dotClass = resolveDotClass(agent.login);
  const loginText = resolveLoginText(agent.login, t);

  return (
    <div
      data-testid="agent-badge"
      className="flex items-center gap-1.5 text-xs text-ink-soft py-1 px-1"
    >
      <span className={`size-2 shrink-0 rounded-full ${dotClass}`} />
      <span className="font-medium text-ink">{name}</span>
      <span>·</span>
      <span>{loginText}</span>
    </div>
  );
}
