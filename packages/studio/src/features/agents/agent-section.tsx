// Agent section for the Settings dialog (R-AG-10, R-AG-21).
import { AGENT_CHOICES, type AgentChoice, type AgentId, type AgentStatus } from '@kumicraft/shared';
import { useTranslation } from 'react-i18next';

import { ChoicePill } from '../../components/ui/choice-pill.tsx';
import { useAgentsStore } from '../../store/agents-store.ts';
import { useSettingsStore } from '../../store/settings-store.ts';
import { AgentCard } from './agent-card.tsx';
import { AgentInstallDialog } from './agent-install-dialog.tsx';
import { useAgentInstall } from './use-agent-install.ts';

function defaultAgent(id: AgentId): AgentStatus {
  return {
    id,
    installed: false,
    login: 'unknown',
    loginAvailable: false,
  };
}

function PreferredChoiceField({
  preferred,
  onSelect,
}: {
  readonly preferred: AgentChoice;
  readonly onSelect: (choice: AgentChoice) => void;
}) {
  const { t } = useTranslation();
  return (
    <fieldset data-testid="settings-agent-preferred" className="grid min-w-0 gap-2 py-2.5">
      <legend className="pb-2 font-medium">{t('settings.agentPreferred')}</legend>
      <div className="flex flex-wrap gap-1 justify-self-start rounded-full bg-field p-1">
        {AGENT_CHOICES.map((choice) => (
          <ChoicePill
            key={choice}
            name="agent-preferred"
            value={choice}
            checked={preferred === choice}
            onChange={() => {
              onSelect(choice);
            }}
          >
            {t(`settings.agents.${choice}`)}
          </ChoicePill>
        ))}
      </div>
      <span className="text-xs text-ink-soft">{t('settings.agentPreferredHelp')}</span>
    </fieldset>
  );
}

function SettingsCardsList({
  agy,
  claude,
  onInstall,
  onLogin,
  onRecheck,
}: {
  readonly agy: AgentStatus;
  readonly claude: AgentStatus;
  readonly onInstall: (agent: AgentStatus) => void;
  readonly onLogin: (id: AgentId) => void;
  readonly onRecheck: () => void;
}) {
  return (
    <div className="flex flex-col gap-2.5 pt-1">
      <AgentCard
        agent={agy}
        variant="settings"
        onInstall={onInstall}
        onLogin={onLogin}
        onRecheck={onRecheck}
      />
      <AgentCard
        agent={claude}
        variant="settings"
        onInstall={onInstall}
        onLogin={onLogin}
        onRecheck={onRecheck}
      />
    </div>
  );
}

export function AgentSection() {
  const settings = useSettingsStore((s) => s.settings);
  const updateSettings = useSettingsStore((s) => s.update);
  const agents = useAgentsStore((s) => s.agents);
  const startLogin = useAgentsStore((s) => s.startLogin);
  const refresh = useAgentsStore((s) => s.refresh);
  const install = useAgentInstall();

  const preferred: AgentChoice = settings?.agent.preferred ?? 'auto';
  const agy = agents?.find((a) => a.id === 'agy') ?? defaultAgent('agy');
  const claude = agents?.find((a) => a.id === 'claude') ?? defaultAgent('claude');

  return (
    <div className="flex flex-col gap-2">
      <PreferredChoiceField
        preferred={preferred}
        onSelect={(c) => {
          void updateSettings({ agent: { preferred: c } });
        }}
      />
      <SettingsCardsList
        agy={agy}
        claude={claude}
        onInstall={install.ask}
        onLogin={(id) => {
          void startLogin(id, false);
        }}
        onRecheck={() => {
          void refresh();
        }}
      />
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
