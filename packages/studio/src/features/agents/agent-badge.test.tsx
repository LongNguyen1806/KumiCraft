// Component tests for AgentBadge (R-AG-21).
import type { AgentStatus } from '@reactcraft/shared';
import { cleanup, render, screen } from '@testing-library/react';
import i18next from 'i18next';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';

import { initI18n } from '../../i18n/i18n.ts';
import { AgentBadge } from './agent-badge.tsx';

describe('AgentBadge status display [R-AG-21]', () => {
  beforeAll(async () => {
    await initI18n();
    await i18next.changeLanguage('vi');
  });

  afterEach(() => {
    cleanup();
  });

  it('Scenario 7: renders name and status indicator across login states [R-AG-21]', () => {
    // 1. agy loggedIn
    const agyLoggedIn: AgentStatus = {
      id: 'agy',
      installed: true,
      login: 'loggedIn',
      loginAvailable: true,
    };
    const { rerender } = render(<AgentBadge agent={agyLoggedIn} />);
    const badge1 = screen.getByTestId('agent-badge');
    expect(badge1.textContent).toContain('Antigravity CLI');
    expect(badge1.textContent).toContain('Đã đăng nhập');
    expect(badge1.querySelector('span.bg-leaf')).toBeDefined();

    // 2. claude unknown
    const claudeUnknown: AgentStatus = {
      id: 'claude',
      installed: true,
      login: 'unknown',
      loginAvailable: false,
    };
    rerender(<AgentBadge agent={claudeUnknown} />);
    const badge2 = screen.getByTestId('agent-badge');
    expect(badge2.textContent).toContain('Claude Code');
    expect(badge2.textContent).toContain('Chưa rõ đăng nhập');
    expect(badge2.querySelector('span.bg-charcoal\\/40')).toBeDefined();

    // 3. agy loggedOut
    const agyLoggedOut: AgentStatus = {
      id: 'agy',
      installed: true,
      login: 'loggedOut',
      loginAvailable: true,
    };
    rerender(<AgentBadge agent={agyLoggedOut} />);
    const badge3 = screen.getByTestId('agent-badge');
    expect(badge3.textContent).toContain('Antigravity CLI');
    expect(badge3.textContent).toContain('Chưa đăng nhập');
    expect(badge3.querySelector('span.bg-sun')).toBeDefined();
  });
});
