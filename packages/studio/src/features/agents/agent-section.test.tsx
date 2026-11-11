// Tests for SettingsDialog agent section and cross-component reactivity (R-AG-10, R-AG-21, R-CH-06).
import type { AgentStatus, JobStatus, ProjectInfo } from '@kumicraft/shared';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import i18next from 'i18next';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import * as agentClient from '../../api/agent-client.ts';
import * as jobsClient from '../../api/jobs-client.ts';
import * as projectClient from '../../api/project-client.ts';
import * as settingsClient from '../../api/settings-client.ts';
import { initI18n } from '../../i18n/i18n.ts';
import { useAgentsStore } from '../../store/agents-store.ts';
import { useSettingsStore } from '../../store/settings-store.ts';
import { ChatPanel } from '../chat/chat-panel.tsx';
import { useChatStore } from '../chat/chat-store.ts';
import { DEFAULT_THEME } from '../inspector/use-project-theme.ts';
import { SettingsDialog } from '../settings/settings-dialog.tsx';

let sockets: FakeSocket[] = [];

class FakeSocket {
  onopen: (() => void) | undefined = undefined;
  onmessage: ((event: { data: string }) => void) | undefined = undefined;
  onclose: (() => void) | undefined = undefined;
  onerror: (() => void) | undefined = undefined;

  constructor() {
    sockets.push(this);
    setTimeout(() => {
      this.onopen?.();
    }, 0);
  }

  close(): void {
    this.onclose?.();
  }
}

function serverSends(type: string, payload: unknown): void {
  const data = JSON.stringify({ v: 1, type, at: '2026-10-22T08:00:01.000Z', payload });
  for (const socket of sockets) socket.onmessage?.({ data });
}

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

const AGENTS_LIST: AgentStatus[] = [
  {
    id: 'agy',
    installed: true,
    version: '1.4.3',
    login: 'loggedIn',
    loginAvailable: true,
  },
  {
    id: 'claude',
    installed: false,
    login: 'unknown',
    loginAvailable: false,
  },
];

describe('Settings AgentSection [R-AG-10, R-AG-21, R-CH-06]', () => {
  beforeAll(async () => {
    await initI18n();
  });

  beforeEach(async () => {
    sockets = [];
    sessionStorage.setItem('kumicraft.sessionToken', 'token-test');
    vi.stubGlobal('WebSocket', FakeSocket);
    await i18next.changeLanguage('vi');
    useAgentsStore.getState().reset();
    useChatStore.getState().reset();
    vi.spyOn(projectClient, 'fetchProject').mockResolvedValue(MOCK_PROJECT);
    vi.spyOn(agentClient, 'fetchTurns').mockResolvedValue([]);
    vi.spyOn(projectClient, 'fetchProjectTheme').mockResolvedValue(DEFAULT_THEME);
    vi.spyOn(settingsClient, 'fetchSettings').mockResolvedValue({
      editor: 'vscode',
      packageManager: 'pnpm',
      language: 'vi',
      agent: { preferred: 'auto' },
    });
    await useSettingsStore.getState().load();
  });

  afterEach(() => {
    cleanup();
    sessionStorage.clear();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('Scenario 16: opens settings dialog, calls fetchAgents, displays 3 choice pills and 2 cards [R-AG-21]', async () => {
    const fetchSpy = vi.spyOn(agentClient, 'fetchAgents').mockResolvedValue(AGENTS_LIST);

    render(<SettingsDialog open onClose={vi.fn()} />);
    fireEvent.click(screen.getByTestId('settings-section-agent'));

    await vi.waitFor(() => {
      expect(fetchSpy).toHaveBeenCalled();
    });

    const fieldset = await screen.findByTestId('settings-agent-preferred');
    expect(fieldset).toBeDefined();

    const pills = fieldset.querySelectorAll('input[type="radio"]');
    expect(pills.length).toBe(3);

    expect(screen.getByTestId('agent-card-agy')).toBeDefined();
    expect(screen.getByTestId('agent-card-claude')).toBeDefined();
  });

  it('Scenario 17: selects preferred pill and opens login [R-AG-10, R-AG-21]', async () => {
    vi.spyOn(agentClient, 'fetchAgents').mockResolvedValue(AGENTS_LIST);
    const updateSpy = vi.spyOn(settingsClient, 'updateSettings').mockResolvedValue({
      editor: 'vscode',
      packageManager: 'pnpm',
      language: 'vi',
      agent: { preferred: 'agy' },
    });
    const openLoginSpy = vi.spyOn(agentClient, 'openAgentLogin').mockResolvedValue(undefined);

    render(<SettingsDialog open onClose={vi.fn()} />);
    fireEvent.click(screen.getByTestId('settings-section-agent'));

    const fieldset = await screen.findByTestId('settings-agent-preferred');
    const agyRadio = fieldset.querySelector('input[value="agy"]');
    expect(agyRadio).toBeDefined();
    if (agyRadio) fireEvent.click(agyRadio);

    await vi.waitFor(() => {
      expect(updateSpy).toHaveBeenCalledWith({ agent: { preferred: 'agy' } });
    });

    const loginBtn = await screen.findByTestId('agent-login-agy');
    fireEvent.click(loginBtn);

    await vi.waitFor(() => {
      expect(openLoginSpy).toHaveBeenCalledWith('agy');
    });
  });

  it('Scenario 18: installed agent with loginAvailable false does not show login button [R-AG-21]', async () => {
    const agentsNoLogin: AgentStatus[] = [
      {
        id: 'agy',
        installed: true,
        login: 'unknown',
        loginAvailable: false,
      },
    ];
    vi.spyOn(agentClient, 'fetchAgents').mockResolvedValue(agentsNoLogin);

    render(<SettingsDialog open onClose={vi.fn()} />);
    fireEvent.click(screen.getByTestId('settings-section-agent'));

    await screen.findByTestId('agent-card-agy');
    expect(screen.queryByTestId('agent-login-agy')).toBeNull();
  });

  it('Scenario 19: chat and settings both open, install in settings makes chat ready without page reload [R-AG-21, R-CH-06]', async () => {
    const uninstalled: AgentStatus[] = [
      {
        id: 'agy',
        installed: false,
        login: 'unknown',
        loginAvailable: false,
        installCommand: ['npm', 'install', '-g', '@google/antigravity'],
      },
    ];
    vi.spyOn(agentClient, 'fetchAgents').mockResolvedValueOnce(uninstalled);
    const installSpy = vi
      .spyOn(agentClient, 'installAgent')
      .mockResolvedValue({ jobId: 'job_cross_001' });
    const runningStatus: JobStatus = {
      id: 'job_cross_001',
      kind: 'agent.install',
      state: 'running',
      startedAt: '2026-10-22T08:00:00.000Z',
    };
    vi.spyOn(jobsClient, 'fetchJob').mockResolvedValue(runningStatus);

    render(
      <div>
        <ChatPanel trusted />
        <SettingsDialog open onClose={vi.fn()} />
      </div>,
    );
    fireEvent.click(screen.getByTestId('settings-section-agent'));

    // Chat is currently in onboarding install step
    expect(await screen.findByTestId('agent-onboarding-install')).toBeDefined();

    // Click install in settings
    const installBtns = screen.getAllByTestId('agent-install-agy');
    const targetBtn = installBtns[installBtns.length - 1];
    expect(targetBtn).toBeDefined();
    if (targetBtn !== undefined) fireEvent.click(targetBtn);

    const confirmBtn = await screen.findByTestId('agent-install-confirm');
    fireEvent.click(confirmBtn);

    await vi.waitFor(() => {
      expect(installSpy).toHaveBeenCalledWith('agy', [
        'npm',
        'install',
        '-g',
        '@google/antigravity',
      ]);
    });
    await vi.waitFor(() => {
      expect(jobsClient.fetchJob).toHaveBeenCalledWith('job_cross_001');
    });

    // When install finishes, fetchAgents returns installed agy
    vi.spyOn(agentClient, 'fetchAgents').mockResolvedValue([
      { id: 'agy', installed: true, login: 'unknown', loginAvailable: false },
    ]);

    serverSends('job.completed', { jobId: 'job_cross_001', kind: 'agent.install' });

    // Chat automatically progresses to ready state (chat-input is active)
    await vi.waitFor(() => {
      expect(screen.queryByTestId('agent-onboarding-install')).toBeNull();
      expect(screen.getByTestId('chat-input')).not.toHaveProperty('disabled', true);
    });
  });
});
