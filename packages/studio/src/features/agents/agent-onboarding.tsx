// Onboarding screens guiding user to install or choose an AI agent (R-AG-10, R-AG-21).
import type { AgentId, AgentStatus } from '@kumicraft/shared';
import { useTranslation } from 'react-i18next';

import { useSettingsStore } from '../../store/settings-store.ts';
import { AgentCard } from './agent-card.tsx';
import { AgentInstallDialog } from './agent-install-dialog.tsx';
import { useAgentInstall } from './use-agent-install.ts';

export type AgentOnboardingProps = {
  readonly step: 'install' | 'choose';
  readonly agents: readonly AgentStatus[];
};

function defaultAgentStatus(id: AgentId): AgentStatus {
  return {
    id,
    installed: false,
    login: 'unknown',
    loginAvailable: false,
  };
}

function OnboardingHeader({ isInstall }: { readonly isInstall: boolean }) {
  const { t } = useTranslation('chat');
  return (
    <div className="flex flex-col gap-1">
      <h3 className="text-sm font-semibold text-ink">
        {isInstall ? t('onboardingInstallTitle') : t('onboardingChooseTitle')}
      </h3>
      <p className="text-xs text-ink-soft">
        {isInstall ? t('onboardingInstallDesc') : t('onboardingChooseDesc')}
      </p>
    </div>
  );
}

export function AgentOnboarding({ step, agents }: AgentOnboardingProps) {
  const updateSettings = useSettingsStore((s) => s.update);
  const install = useAgentInstall();

  const agy = agents.find((a) => a.id === 'agy') ?? defaultAgentStatus('agy');
  const claude = agents.find((a) => a.id === 'claude') ?? defaultAgentStatus('claude');

  const handleUse = (id: AgentId) => {
    void updateSettings({ agent: { preferred: id } });
  };

  const isInstall = step === 'install';

  return (
    <div
      data-testid={isInstall ? 'agent-onboarding-install' : 'agent-onboarding-choose'}
      className="flex flex-col gap-4 p-4 rounded-lg border border-border bg-field/20"
    >
      <OnboardingHeader isInstall={isInstall} />
      <div className="flex flex-col gap-2.5">
        <AgentCard agent={agy} variant="onboarding" onInstall={install.ask} onUse={handleUse} />
        <AgentCard agent={claude} variant="onboarding" onInstall={install.ask} onUse={handleUse} />
      </div>

      <AgentInstallDialog
        phase={install.phase}
        agent={install.targetAgent}
        lines={install.lines}
        failure={install.failure}
        onConfirm={() => {
          void install.confirm();
        }}
        onStop={install.stop}
        onClose={install.close}
      />
    </div>
  );
}
