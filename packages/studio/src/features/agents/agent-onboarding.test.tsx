// Tests for Agent Onboarding flows and install job integration (R-AG-10, R-AG-21, R-CH-06, S-54).
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
import { ChatPanel } from '../chat/chat-panel.tsx';
import { useChatStore } from '../chat/chat-store.ts';
import { DEFAULT_THEME } from '../inspector/use-project-theme.ts';

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

const UNINSTALLED_AGENTS: AgentStatus[] = [
  {
    id: 'agy',
    installed: false,
    login: 'unknown',
    loginAvailable: false,
    installCommand: ['npm', 'install', '-g', '@google/antigravity'],
    docsUrl: 'https://antigravity.google/docs',
  },
  {
    id: 'claude',
    installed: false,
    login: 'unknown',
    loginAvailable: false,
    installCommand: ['npm', 'install', '-g', '@anthropic-ai/claude-code'],
    docsUrl: 'https://docs.anthropic.com/claude-code',
  },
];

const JOB_ID = 'job_agent_install_001';

const RUNNING_STATUS: JobStatus = {
  id: JOB_ID,
  kind: 'agent.install',
  state: 'running',
  startedAt: '2026-10-22T08:00:00.000Z',
};

describe('Agent Onboarding and Installation [R-AG-10, R-AG-21, R-CH-06, S-54]', () => {
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
    vi.spyOn(jobsClient, 'fetchJob').mockResolvedValue(RUNNING_STATUS);
    vi.spyOn(jobsClient, 'cancelJob').mockResolvedValue(undefined);
  });

  afterEach(() => {
    cleanup();
    sessionStorage.clear();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('Scenario 2: displays onboarding install screen when no agents installed [R-AG-21, R-CH-06]', async () => {
    vi.spyOn(agentClient, 'fetchAgents').mockResolvedValue(UNINSTALLED_AGENTS);

    render(<ChatPanel trusted />);

    const onboarding = await screen.findByTestId('agent-onboarding-install');
    expect(onboarding).toBeDefined();

    const agyCard = screen.getByTestId('agent-card-agy');
    const claudeCard = screen.getByTestId('agent-card-claude');
    expect(agyCard).toBeDefined();
    expect(claudeCard).toBeDefined();

    expect(screen.getByTestId('agent-install-agy')).toBeDefined();
    expect(screen.getByTestId('agent-install-claude')).toBeDefined();

    const agyDocs = agyCard.querySelector('a');
    expect(agyDocs?.getAttribute('href')).toBe('https://antigravity.google/docs');
    expect(agyDocs?.getAttribute('rel')).toContain('noreferrer');

    const claudeDocs = claudeCard.querySelector('a');
    expect(claudeDocs?.getAttribute('href')).toBe('https://docs.anthropic.com/claude-code');
    expect(claudeDocs?.getAttribute('rel')).toContain('noreferrer');
  });

  it('Scenario 3: shows exact install command and cancels without calling installAgent [R-AG-21, S-54]', async () => {
    vi.spyOn(agentClient, 'fetchAgents').mockResolvedValue(UNINSTALLED_AGENTS);
    const installSpy = vi.spyOn(agentClient, 'installAgent');

    render(<ChatPanel trusted />);

    const installBtn = await screen.findByTestId('agent-install-agy');
    fireEvent.click(installBtn);

    const dialog = await screen.findByTestId('agent-install-dialog');
    expect(dialog).toBeDefined();

    const cmd = screen.getByTestId('agent-install-command');
    expect(cmd.textContent).toBe('npm install -g @google/antigravity');

    const cancelBtn = screen.getByTestId('agent-install-cancel');
    fireEvent.click(cancelBtn);

    expect(installSpy).not.toHaveBeenCalled();
    expect(screen.queryByTestId('agent-install-dialog')).toBeNull();
  });

  it('Scenario 4: runs install, follows progress, and moves to ready state [R-AG-21]', async () => {
    vi.spyOn(agentClient, 'fetchAgents').mockResolvedValueOnce(UNINSTALLED_AGENTS);
    const installSpy = vi.spyOn(agentClient, 'installAgent').mockResolvedValue({ jobId: JOB_ID });

    render(<ChatPanel trusted />);

    const installBtn = await screen.findByTestId('agent-install-agy');
    fireEvent.click(installBtn);

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
      expect(jobsClient.fetchJob).toHaveBeenCalledWith(JOB_ID);
    });

    serverSends('job.progress', {
      jobId: JOB_ID,
      kind: 'agent.install',
      done: 1,
      total: 2,
      lines: ['Fetching package…', 'Installed binary'],
    });

    await vi.waitFor(() => {
      const linesView = screen.getByTestId('agent-install-lines');
      expect(linesView.textContent).toContain('Fetching package…');
      expect(linesView.textContent).toContain('Installed binary');
    });

    // Next fetchAgents returns agy installed
    vi.spyOn(agentClient, 'fetchAgents').mockResolvedValue([
      { id: 'agy', installed: true, login: 'unknown', loginAvailable: false },
      { id: 'claude', installed: false, login: 'unknown', loginAvailable: false },
    ]);

    serverSends('job.completed', { jobId: JOB_ID, kind: 'agent.install' });

    await vi.waitFor(() => {
      expect(screen.getByTestId('chat-input')).not.toHaveProperty('disabled', true);
    });
  });

  it('Scenario 5: shows translated error on failed job, and cancels when stop is clicked [R-AG-21]', async () => {
    vi.spyOn(agentClient, 'fetchAgents').mockResolvedValueOnce(UNINSTALLED_AGENTS);
    vi.spyOn(agentClient, 'installAgent').mockResolvedValue({ jobId: JOB_ID });
    const cancelSpy = vi.spyOn(jobsClient, 'cancelJob');

    render(<ChatPanel trusted />);

    const installBtn = await screen.findByTestId('agent-install-agy');
    fireEvent.click(installBtn);

    fireEvent.click(await screen.findByTestId('agent-install-confirm'));

    await vi.waitFor(() => {
      expect(jobsClient.fetchJob).toHaveBeenCalledWith(JOB_ID);
    });

    // Test stop button calls cancelJob
    fireEvent.click(screen.getByTestId('agent-install-stop'));
    expect(cancelSpy).toHaveBeenCalledWith(JOB_ID);

    // Test failed job E028 with 3 lines
    serverSends('job.failed', {
      jobId: JOB_ID,
      kind: 'agent.install',
      error: {
        code: 'E028',
        params: { command: 'npm install' },
        details: [{ message: 'Err line 1' }, { message: 'Err line 2' }, { message: 'Err line 3' }],
      },
    });

    const errorView = await screen.findByTestId('agent-install-error');
    expect(errorView.textContent).toContain('Err line 3');
  });

  it('Scenario 6: choose agent when both installed and auto preferred [R-AG-10]', async () => {
    const bothInstalled: AgentStatus[] = [
      { id: 'agy', installed: true, login: 'unknown', loginAvailable: false },
      { id: 'claude', installed: true, login: 'unknown', loginAvailable: false },
    ];
    vi.spyOn(agentClient, 'fetchAgents').mockResolvedValue(bothInstalled);
    const updateSpy = vi.spyOn(settingsClient, 'updateSettings').mockResolvedValue({
      editor: 'vscode',
      packageManager: 'pnpm',
      language: 'vi',
      agent: { preferred: 'claude' },
    });

    render(<ChatPanel trusted />);

    const chooseView = await screen.findByTestId('agent-onboarding-choose');
    expect(chooseView).toBeDefined();

    const useClaudeBtn = screen.getByTestId('agent-use-claude');
    fireEvent.click(useClaudeBtn);

    await vi.waitFor(() => {
      expect(updateSpy).toHaveBeenCalledWith({ agent: { preferred: 'claude' } });
    });

    await vi.waitFor(() => {
      expect(screen.getByTestId('chat-input')).not.toHaveProperty('disabled', true);
    });
  });
});
