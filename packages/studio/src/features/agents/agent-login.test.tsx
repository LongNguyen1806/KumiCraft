// Component tests for Agent login flows, auto-polling, timeout, and resend (R-AG-21).
import type { AgentStatus, ProjectInfo } from '@kumicraft/shared';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import i18next from 'i18next';
import { StrictMode } from 'react';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import * as agentClient from '../../api/agent-client.ts';
import { ApiError } from '../../api/http.ts';
import * as projectClient from '../../api/project-client.ts';
import { initI18n } from '../../i18n/i18n.ts';
import { useAgentsStore } from '../../store/agents-store.ts';
import { ChatPanel } from '../chat/chat-panel.tsx';
import { useChatStore } from '../chat/chat-store.ts';
import { DEFAULT_THEME } from '../inspector/use-project-theme.ts';

const MOCK_PROJECT: ProjectInfo = {
  id: 'proj000001',
  name: 'Test Project',
  root: '/test',
  sourceDir: 'src',
  support: { supported: true, reasons: [], framework: 'vite-react', versions: {}, language: 'ts' },
  needsInstall: false,
  responsiveMode: 'desktop-first',
  frames: [{ id: 'desktop', label: 'Desktop', width: 1440, height: 900 }],
  primaryFrameId: 'desktop',
  backends: [],
  designDirs: {
    pages: ['src/pages'],
    layouts: ['src/layouts'],
    components: ['src/components'],
    drafts: 'src/drafts',
  },
  trusted: true,
};

const AGY_INSTALLED_LOGGED_OUT: AgentStatus = {
  id: 'agy',
  installed: true,
  login: 'loggedOut',
  loginAvailable: true,
};

const CLAUDE_INSTALLED_UNKNOWN: AgentStatus = {
  id: 'claude',
  installed: true,
  login: 'unknown',
  loginAvailable: true,
};

describe('Agent Login Flow [R-AG-21]', () => {
  beforeAll(async () => {
    await initI18n();
  });

  beforeEach(async () => {
    sessionStorage.setItem('kumicraft.sessionToken', 'token-test');
    await i18next.changeLanguage('vi');
    useAgentsStore.getState().reset();
    useChatStore.getState().reset();
    vi.spyOn(projectClient, 'fetchProject').mockResolvedValue(MOCK_PROJECT);
    vi.spyOn(agentClient, 'fetchTurns').mockResolvedValue([]);
    vi.spyOn(projectClient, 'fetchProjectTheme').mockResolvedValue(DEFAULT_THEME);
  });

  afterEach(() => {
    cleanup();
    sessionStorage.clear();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('Scenario 8: auto-opens login on E026 notLoggedIn without send error and keeps prompt [R-AG-21]', async () => {
    vi.spyOn(agentClient, 'fetchAgents').mockResolvedValue([AGY_INSTALLED_LOGGED_OUT]);
    const openLoginSpy = vi.spyOn(agentClient, 'openAgentLogin').mockResolvedValue(undefined);
    vi.spyOn(agentClient, 'startTurn').mockRejectedValue(
      new ApiError(400, 'E026', { agent: 'agy', reason: 'notLoggedIn' }),
    );

    render(<ChatPanel trusted />);

    const input = await screen.findByTestId('chat-input');
    fireEvent.change(input, { target: { value: 'Tạo form đăng nhập' } });

    fireEvent.click(screen.getByTestId('chat-send'));

    await vi.waitFor(() => {
      expect(openLoginSpy).toHaveBeenCalledTimes(1);
      expect(openLoginSpy).toHaveBeenCalledWith('agy');
    });

    const loginCard = await screen.findByTestId('agent-login-card');
    expect(loginCard).toBeDefined();
    expect(screen.getByTestId('agent-login-steps')).toBeDefined();
    expect(screen.getByTestId('agent-login-waiting')).toBeDefined();
    expect(screen.queryByTestId('chat-send-error')).toBeNull();

    expect(screen.getByTestId('chat-input')).toHaveProperty('value', 'Tạo form đăng nhập');
  });

  it('Scenario 9: polls every 3s, detects login, shows done, and auto-resends prompt [R-AG-21]', async () => {
    const fetchAgentsMock = vi
      .spyOn(agentClient, 'fetchAgents')
      .mockResolvedValue([AGY_INSTALLED_LOGGED_OUT]);
    vi.spyOn(agentClient, 'openAgentLogin').mockImplementation(() => {
      vi.useFakeTimers({ shouldAdvanceTime: true });
      return Promise.resolve();
    });
    const startTurnSpy = vi
      .spyOn(agentClient, 'startTurn')
      .mockRejectedValueOnce(new ApiError(400, 'E026', { agent: 'agy', reason: 'notLoggedIn' }))
      .mockResolvedValueOnce({ jobId: 'job_auto_resend_1' });

    render(<ChatPanel trusted />);

    const input = await screen.findByTestId('chat-input');
    fireEvent.change(input, { target: { value: 'Tạo nút bấm' } });
    fireEvent.click(screen.getByTestId('chat-send'));

    await vi.waitFor(() => {
      expect(screen.getByTestId('agent-login-card')).toBeDefined();
    });

    // Advance 3 seconds: still loggedOut
    fetchAgentsMock.mockClear();
    await vi.advanceTimersByTimeAsync(3000);
    expect(fetchAgentsMock).toHaveBeenCalledTimes(1);

    // Next 3 seconds: now loggedIn
    fetchAgentsMock.mockResolvedValueOnce([{ ...AGY_INSTALLED_LOGGED_OUT, login: 'loggedIn' }]);
    await vi.advanceTimersByTimeAsync(3000);
    expect(fetchAgentsMock).toHaveBeenCalledTimes(2);

    await vi.waitFor(() => {
      expect(screen.getByTestId('agent-login-done')).toBeDefined();
    });

    await vi.waitFor(() => {
      expect(startTurnSpy).toHaveBeenCalledTimes(2);
      expect(startTurnSpy).toHaveBeenLastCalledWith(
        expect.objectContaining({ prompt: 'Tạo nút bấm' }),
      );
    });
  });

  it('resends once and closes the login card under StrictMode [R-AG-21]', async () => {
    const fetchAgentsMock = vi
      .spyOn(agentClient, 'fetchAgents')
      .mockResolvedValue([AGY_INSTALLED_LOGGED_OUT]);
    vi.spyOn(agentClient, 'openAgentLogin').mockImplementation(() => {
      vi.useFakeTimers({ shouldAdvanceTime: true });
      return Promise.resolve();
    });
    const startTurnSpy = vi
      .spyOn(agentClient, 'startTurn')
      .mockRejectedValueOnce(new ApiError(400, 'E026', { agent: 'agy', reason: 'notLoggedIn' }))
      .mockResolvedValueOnce({ jobId: 'job_strict_1' });

    render(
      <StrictMode>
        <ChatPanel trusted />
      </StrictMode>,
    );

    const input = await screen.findByTestId('chat-input');
    fireEvent.change(input, { target: { value: 'Đổi màu nút' } });
    fireEvent.click(screen.getByTestId('chat-send'));
    await vi.waitFor(() => {
      expect(screen.getByTestId('agent-login-card')).toBeDefined();
    });

    fetchAgentsMock.mockResolvedValue([{ ...AGY_INSTALLED_LOGGED_OUT, login: 'loggedIn' }]);
    await vi.advanceTimersByTimeAsync(3000);
    await vi.waitFor(() => {
      expect(startTurnSpy).toHaveBeenCalledTimes(2);
    });

    await vi.advanceTimersByTimeAsync(1500);
    expect(screen.queryByTestId('agent-login-card')).toBeNull();
    expect(startTurnSpy).toHaveBeenCalledTimes(2);
  });

  it('keeps the known agents when one poll fails [R-AG-21]', async () => {
    const fetchAgentsMock = vi
      .spyOn(agentClient, 'fetchAgents')
      .mockResolvedValue([AGY_INSTALLED_LOGGED_OUT]);
    render(<ChatPanel trusted />);
    await screen.findByTestId('chat-input');

    fetchAgentsMock.mockRejectedValueOnce(new TypeError('network failed'));
    await useAgentsStore.getState().refresh();

    expect(useAgentsStore.getState().agents).toEqual([AGY_INSTALLED_LOGGED_OUT]);
    expect(screen.getByTestId('chat-input')).toBeDefined();
  });

  it('Scenario 10: times out after 10 minutes and stops polling [R-AG-21]', async () => {
    const fetchAgentsMock = vi
      .spyOn(agentClient, 'fetchAgents')
      .mockResolvedValue([AGY_INSTALLED_LOGGED_OUT]);
    vi.spyOn(agentClient, 'openAgentLogin').mockImplementation(() => {
      vi.useFakeTimers({ shouldAdvanceTime: true });
      return Promise.resolve();
    });
    vi.spyOn(agentClient, 'startTurn').mockRejectedValue(
      new ApiError(400, 'E026', { agent: 'agy', reason: 'notLoggedIn' }),
    );

    render(<ChatPanel trusted />);

    const input = await screen.findByTestId('chat-input');
    fireEvent.change(input, { target: { value: 'Tạo navbar' } });
    fireEvent.click(screen.getByTestId('chat-send'));

    await vi.waitFor(() => {
      expect(screen.getByTestId('agent-login-card')).toBeDefined();
    });

    // Advance past 10 minutes (600,000 ms) in one jump
    vi.setSystemTime(Date.now() + 600_000);
    await vi.advanceTimersByTimeAsync(3000);

    await vi.waitFor(() => {
      expect(screen.getByTestId('agent-login-timeout')).toBeDefined();
      expect(screen.getByTestId('agent-login-recheck')).toBeDefined();
    });

    fetchAgentsMock.mockClear();
    // Advance another 30 seconds: polling stopped, no calls
    await vi.advanceTimersByTimeAsync(30_000);
    expect(fetchAgentsMock).not.toHaveBeenCalled();
  });

  it('Scenario 11: reopens window, and cancels login without resend [R-AG-21]', async () => {
    vi.spyOn(agentClient, 'fetchAgents').mockResolvedValue([AGY_INSTALLED_LOGGED_OUT]);
    const openLoginSpy = vi.spyOn(agentClient, 'openAgentLogin').mockResolvedValue(undefined);
    const startTurnSpy = vi
      .spyOn(agentClient, 'startTurn')
      .mockRejectedValue(new ApiError(400, 'E026', { agent: 'agy', reason: 'notLoggedIn' }));

    render(<ChatPanel trusted />);

    const input = await screen.findByTestId('chat-input');
    fireEvent.change(input, { target: { value: 'Tạo footer' } });
    fireEvent.click(screen.getByTestId('chat-send'));

    await vi.waitFor(() => {
      expect(openLoginSpy).toHaveBeenCalledTimes(1);
    });

    const reopenBtn = await screen.findByTestId('agent-login-reopen');
    fireEvent.click(reopenBtn);

    await vi.waitFor(() => {
      expect(openLoginSpy).toHaveBeenCalledTimes(2);
    });

    const cancelBtn = screen.getByTestId('agent-login-cancel');
    fireEvent.click(cancelBtn);

    expect(screen.queryByTestId('agent-login-card')).toBeNull();
    expect(startTurnSpy).toHaveBeenCalledTimes(1);
  });

  it('Scenario 12: displays error when openAgentLogin fails with E021 [R-AG-21]', async () => {
    vi.spyOn(agentClient, 'fetchAgents').mockResolvedValue([AGY_INSTALLED_LOGGED_OUT]);
    vi.spyOn(agentClient, 'openAgentLogin').mockRejectedValue(
      new ApiError(500, 'E021', { missing: 'terminal' }),
    );
    vi.spyOn(agentClient, 'startTurn').mockRejectedValue(
      new ApiError(400, 'E026', { agent: 'agy', reason: 'notLoggedIn' }),
    );

    render(<ChatPanel trusted />);

    const input = await screen.findByTestId('chat-input');
    fireEvent.change(input, { target: { value: 'Yêu cầu lỗi' } });
    fireEvent.click(screen.getByTestId('chat-send'));

    const errorEl = await screen.findByTestId('agent-login-error');
    expect(errorEl.textContent).toContain('terminal');
  });

  it('Scenario 13 & 14: claude E027 failure shows login hint, manual done button, and resends [R-AG-21]', async () => {
    vi.spyOn(agentClient, 'fetchAgents').mockResolvedValue([CLAUDE_INSTALLED_UNKNOWN]);
    const openLoginSpy = vi.spyOn(agentClient, 'openAgentLogin').mockResolvedValue(undefined);
    const startTurnSpy = vi
      .spyOn(agentClient, 'startTurn')
      .mockResolvedValueOnce({ jobId: 'job_claude_1' })
      .mockResolvedValueOnce({ jobId: 'job_claude_2' });

    render(<ChatPanel trusted />);

    const input = await screen.findByTestId('chat-input');
    fireEvent.change(input, { target: { value: 'Dùng Claude tạo bảng' } });
    fireEvent.click(screen.getByTestId('chat-send'));

    await vi.waitFor(() => {
      expect(startTurnSpy).toHaveBeenCalledTimes(1);
    });

    // Simulate job failed with E027 for claude
    useChatStore.getState().finishJobFailed('job_claude_1', {
      code: 'E027',
      params: { agent: 'claude', exitCode: 1 },
    });

    const hint = await screen.findByTestId('chat-login-hint');
    expect(hint.textContent).toContain('Có thể Claude Code chưa đăng nhập');

    // Click login in hint
    const loginInHintBtn = hint.querySelector('button');
    expect(loginInHintBtn).toBeDefined();
    if (loginInHintBtn) fireEvent.click(loginInHintBtn);

    await vi.waitFor(() => {
      expect(openLoginSpy).toHaveBeenCalledWith('claude');
      expect(screen.getByTestId('agent-login-manual-done')).toBeDefined();
    });

    // Scenario 14: Click manual done -> calls startTurn again with original prompt
    fireEvent.click(screen.getByTestId('agent-login-manual-done'));

    await vi.waitFor(() => {
      expect(startTurnSpy).toHaveBeenCalledTimes(2);
      expect(startTurnSpy).toHaveBeenLastCalledWith(
        expect.objectContaining({ prompt: 'Dùng Claude tạo bảng' }),
      );
    });
  });

  it('Scenario 15: startTurn rejects with E026 notInstalled -> refetches agents and moves to onboarding [R-AG-21]', async () => {
    vi.spyOn(agentClient, 'fetchAgents')
      .mockResolvedValueOnce([AGY_INSTALLED_LOGGED_OUT])
      .mockResolvedValueOnce([
        { id: 'agy', installed: false, login: 'unknown', loginAvailable: false },
        { id: 'claude', installed: false, login: 'unknown', loginAvailable: false },
      ]);
    vi.spyOn(agentClient, 'startTurn').mockRejectedValue(
      new ApiError(400, 'E026', { agent: 'agy', reason: 'notInstalled' }),
    );

    render(<ChatPanel trusted />);

    const input = await screen.findByTestId('chat-input');
    fireEvent.change(input, { target: { value: 'Chạy thử khi chưa cài' } });
    fireEvent.click(screen.getByTestId('chat-send'));

    const onboarding = await screen.findByTestId('agent-onboarding-install');
    expect(onboarding).toBeDefined();
  });
});
