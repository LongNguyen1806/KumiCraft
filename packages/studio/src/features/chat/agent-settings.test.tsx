// Tests for the model chip by Send: model, effort, edit/ask and plan limits (K9.5).
import type { AgentStatus, ProjectInfo, WorkspaceAi } from '@kumicraft/shared';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import i18next from 'i18next';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import * as agentClient from '../../api/agent-client.ts';
import * as projectClient from '../../api/project-client.ts';
import { useProjectStore } from '../../core/project-store.ts';
import { AgentSettings } from './agent-settings.tsx';
import { useChatStore } from './chat-store.ts';
import { useUsageStore } from './usage-store.ts';

const CLAUDE: AgentStatus = {
  id: 'claude',
  installed: true,
  login: 'loggedIn',
  loginAvailable: true,
};
const AGY: AgentStatus = { id: 'agy', installed: true, login: 'loggedIn', loginAvailable: true };

const PROJECT: ProjectInfo = {
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

/** The server answers with the `ai` it saved, as the real PATCH does. */
function mockPatch() {
  return vi
    .spyOn(projectClient, 'patchProject')
    .mockImplementation((payload) =>
      Promise.resolve({ ...PROJECT, ...(payload.ai === undefined ? {} : { ai: payload.ai }) }),
    );
}

function setAi(ai: WorkspaceAi): void {
  useProjectStore.getState().setProject({ ...PROJECT, ai });
}

describe('AgentSettings chip [K9.5]', () => {
  beforeAll(async () => {
    const { initI18n } = await import('../../i18n/i18n.ts');
    await initI18n();
  });

  beforeEach(async () => {
    localStorage.clear();
    await i18next.changeLanguage('vi');
    useUsageStore.setState({ byAgent: {}, current: undefined });
    useProjectStore.getState().setProject(PROJECT);
    vi.spyOn(agentClient, 'fetchAgentModels').mockResolvedValue([
      { id: 'opus', label: 'Opus' },
      { id: 'sonnet', label: 'Sonnet' },
    ]);
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('saves the model, then the effort, keeping each other and Edit mode', async () => {
    const patchSpy = mockPatch();
    render(<AgentSettings agent={CLAUDE} />);
    const chip = screen.getByTestId('agent-settings-chip');
    expect(chip.textContent).toContain('Mặc định');

    fireEvent.click(chip);
    await screen.findByRole('option', { name: 'Sonnet' });
    fireEvent.change(screen.getByTestId('agent-settings-model'), { target: { value: 'sonnet' } });
    await vi.waitFor(() => {
      expect(patchSpy).toHaveBeenCalledWith({
        ai: { allowEdits: true, agents: { claude: { model: 'sonnet' } } },
      });
    });

    fireEvent.click(await screen.findByTestId('agent-settings-effort-high'));
    await vi.waitFor(() => {
      expect(patchSpy).toHaveBeenLastCalledWith({
        ai: { allowEdits: true, agents: { claude: { model: 'sonnet', effort: 'high' } } },
      });
    });
    await vi.waitFor(() => {
      expect(chip.textContent).toContain('Sonnet · Cao');
    });
  });

  it('switching to Ask keeps the picked model of every agent', async () => {
    setAi({ allowEdits: true, agents: { claude: { model: 'opus' }, agy: { effort: 'low' } } });
    const patchSpy = mockPatch();
    render(<AgentSettings agent={CLAUDE} />);
    fireEvent.click(screen.getByTestId('agent-settings-chip'));
    fireEvent.click(screen.getByTestId('chat-ask-only'));
    await vi.waitFor(() => {
      expect(patchSpy).toHaveBeenCalledWith({
        ai: { allowEdits: false, agents: { claude: { model: 'opus' }, agy: { effort: 'low' } } },
      });
    });
    await screen.findByTestId('agent-settings-ask');
  });

  it('shows the plan limits the agent reported and warns on the chip past 80%', () => {
    render(<AgentSettings agent={CLAUDE} />);
    act(() => {
      useUsageStore.getState().record({
        fiveHour: { used: 0.85, resetsAt: '2026-11-07T20:00:00.000Z' },
        week: { used: 0.3 },
      });
      useUsageStore.getState().record({ model: 'claude-sonnet-5-5', tokens: 1234, costUsd: 0.05 });
    });

    const chip = screen.getByTestId('agent-settings-chip');
    expect(chip.className).toContain('border-sun');
    fireEvent.click(chip);
    const meters = screen.getAllByRole('meter');
    expect(meters.map((m) => m.getAttribute('aria-valuenow'))).toEqual(['85', '30']);
    const usage = screen.getByTestId('agent-settings-usage').textContent;
    expect(usage).toContain('5 giờ');
    expect(usage).toContain('$0.05');

    // Kept for the next visit, by agent.
    const stored: unknown = JSON.parse(localStorage.getItem('kumicraft.agentUsage') ?? '{}');
    expect(stored).toMatchObject({ claude: { fiveHour: { used: 0.85 }, tokens: 1234 } });
  });

  it('says Antigravity CLI reports no limits', () => {
    render(<AgentSettings agent={AGY} />);
    fireEvent.click(screen.getByTestId('agent-settings-chip'));
    expect(screen.getByTestId('agent-settings-usage').textContent).toContain(
      'Antigravity CLI không gửi hạn mức',
    );
    expect(screen.queryByRole('meter')).toBeNull();
  });

  it('closes with Escape', () => {
    render(<AgentSettings agent={CLAUDE} />);
    fireEvent.click(screen.getByTestId('agent-settings-chip'));
    expect(screen.getByTestId('agent-settings-popover')).toBeDefined();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByTestId('agent-settings-popover')).toBeNull();
  });

  it('glows around "Default" each visit, old chats included, until a message is sent', () => {
    useChatStore.setState({ hasConversation: true, sentThisVisit: false });
    render(<AgentSettings agent={CLAUDE} />);
    const chip = screen.getByTestId('agent-settings-chip');
    expect(chip.getAttribute('data-glow')).toBe('true');

    act(() => {
      useChatStore.getState().startLocal('Hello');
    });
    expect(chip.getAttribute('data-glow')).toBeNull();
    cleanup();

    act(() => {
      useChatStore.setState({ turns: [], hasConversation: false, sentThisVisit: false });
    });
    setAi({ allowEdits: true, agents: { claude: { model: 'sonnet' } } });
    render(<AgentSettings agent={CLAUDE} />);
    expect(screen.getByTestId('agent-settings-chip').getAttribute('data-glow')).toBeNull();
  });
});
