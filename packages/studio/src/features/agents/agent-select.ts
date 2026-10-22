// Pure helpers for agent selection and onboarding progression (R-AG-10, R-AG-21).
import type { AgentChoice, AgentId, AgentStatus } from '@reactcraft/shared';

export type AgentPreferred = AgentChoice;

export type OnboardingStep = 'install' | 'choose' | 'ready';

export function selectedAgent(
  agents: readonly AgentStatus[] | undefined,
  preferred: AgentPreferred,
): AgentId | undefined {
  if (agents === undefined) return undefined;
  if (preferred === 'agy' || preferred === 'claude') {
    const found = agents.find((a) => a.id === preferred && a.installed);
    return found?.id;
  }
  const installed = agents.filter((a) => a.installed);
  if (installed.length === 0) return undefined;
  const ready = installed.find((a) => a.login !== 'loggedOut');
  return ready?.id ?? installed[0]?.id;
}

export function onboardingStep(
  agents: readonly AgentStatus[] | undefined,
  preferred: AgentPreferred,
): OnboardingStep {
  if (agents === undefined) return 'ready';
  const installed = agents.filter((a) => a.installed);
  if (installed.length === 0) return 'install';

  if (preferred !== 'auto') {
    const isPreferredInstalled = installed.some((a) => a.id === preferred);
    return isPreferredInstalled ? 'ready' : 'choose';
  }

  if (installed.length >= 2) {
    const usable = installed.filter((a) => a.login !== 'loggedOut');
    if (usable.length === 1) return 'ready';
    return 'choose';
  }

  return 'ready';
}
