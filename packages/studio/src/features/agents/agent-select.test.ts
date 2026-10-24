// Tests for agent selection and onboarding step logic (R-AG-10, R-AG-21).
import type { AgentStatus } from '@kumicraft/shared';
import { describe, expect, it } from 'vitest';

import { onboardingStep, selectedAgent } from './agent-select.ts';

const AGY_UNINSTALLED: AgentStatus = {
  id: 'agy',
  installed: false,
  login: 'unknown',
  loginAvailable: false,
};

const CLAUDE_UNINSTALLED: AgentStatus = {
  id: 'claude',
  installed: false,
  login: 'unknown',
  loginAvailable: false,
};

const AGY_INSTALLED: AgentStatus = {
  id: 'agy',
  installed: true,
  login: 'loggedIn',
  loginAvailable: true,
};

const AGY_LOGGED_OUT: AgentStatus = {
  id: 'agy',
  installed: true,
  login: 'loggedOut',
  loginAvailable: true,
};

const CLAUDE_INSTALLED: AgentStatus = {
  id: 'claude',
  installed: true,
  login: 'unknown',
  loginAvailable: false,
};

describe('agent selection and onboarding step [R-AG-10, R-AG-21]', () => {
  it('Scenario 1: determines onboardingStep and selectedAgent across combinations [R-AG-10, R-AG-21]', () => {
    // 1. none installed
    const none = [AGY_UNINSTALLED, CLAUDE_UNINSTALLED];
    expect(onboardingStep(none, 'auto')).toBe('install');
    expect(selectedAgent(none, 'auto')).toBeUndefined();

    // 2. only agy installed
    const onlyAgy = [AGY_INSTALLED, CLAUDE_UNINSTALLED];
    expect(onboardingStep(onlyAgy, 'auto')).toBe('ready');
    expect(selectedAgent(onlyAgy, 'auto')).toBe('agy');

    // 3. both installed + auto
    const both = [AGY_INSTALLED, CLAUDE_INSTALLED];
    expect(onboardingStep(both, 'auto')).toBe('choose');
    expect(selectedAgent(both, 'auto')).toBe('agy');

    // 4. both installed + claude preferred
    expect(onboardingStep(both, 'claude')).toBe('ready');
    expect(selectedAgent(both, 'claude')).toBe('claude');

    // 5. claude preferred but uninstalled, agy installed
    expect(onboardingStep(onlyAgy, 'claude')).toBe('choose');
    expect(selectedAgent(onlyAgy, 'claude')).toBeUndefined();

    // 6. auto with agy loggedOut + claude installed
    const agyOutClaudeIn = [AGY_LOGGED_OUT, CLAUDE_INSTALLED];
    expect(onboardingStep(agyOutClaudeIn, 'auto')).toBe('ready');
    expect(selectedAgent(agyOutClaudeIn, 'auto')).toBe('claude');
  });
});
