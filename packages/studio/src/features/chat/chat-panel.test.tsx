// Tests for Chat panel tabs, lock states, and backends (WP-3.05a, Scenarios 2, 3, 4, 14).
import type { BackendInfo, ProjectInfo } from '@kumicraft/shared';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import i18next from 'i18next';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import * as agentClient from '../../api/agent-client.ts';
import { ApiError } from '../../api/http.ts';
import * as projectClient from '../../api/project-client.ts';
import { useProjectStore } from '../../core/project-store.ts';
import { useAgentsStore } from '../../store/agents-store.ts';
import { RightPanel } from '../editor/side-panels.tsx';
import { DEFAULT_THEME } from '../inspector/use-project-theme.ts';
import { ChatPanel } from './chat-panel.tsx';
import { useChatStore } from './chat-store.ts';

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

const MOCK_PROJECT: ProjectInfo = {
  id: 'proj000001',
  name: 'Test Project',
  root: '/test',
  sourceDir: 'src',
  support: {
    supported: true,
    reasons: [],
    framework: 'vite-react',
    versions: {},
    language: 'ts',
  },
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

describe('ChatPanel tabs and locks [R-CH-01, R-CH-06, R-CH-07]', () => {
  beforeAll(async () => {
    const { initI18n } = await import('../../i18n/i18n.ts');
    await initI18n();
  });

  beforeEach(async () => {
    sockets = [];
    vi.stubGlobal('WebSocket', FakeSocket);
    sessionStorage.setItem('kumicraft.sessionToken', 'tok-panel');
    localStorage.clear();
    await i18next.changeLanguage('vi');
    useAgentsStore.getState().reset();
    useChatStore.getState().reset();
    useProjectStore.getState().setProject(MOCK_PROJECT);
    vi.spyOn(projectClient, 'fetchProject').mockResolvedValue(MOCK_PROJECT);
    vi.spyOn(agentClient, 'fetchTurns').mockResolvedValue([]);
    vi.spyOn(projectClient, 'fetchProjectTheme').mockResolvedValue(DEFAULT_THEME);
    vi.spyOn(agentClient, 'fetchAgents').mockResolvedValue([
      { id: 'agy', installed: true, login: 'unknown', loginAvailable: false },
    ]);
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('Scenario 2: opens chat tab and remembers tab on next render [R-CH-01]', async () => {
    const { unmount } = render(<RightPanel trusted />);
    const chatTab = screen.getByTestId('right-tab-chat');
    fireEvent.click(chatTab);

    expect(await screen.findByTestId('chat-panel')).toBeDefined();
    unmount();

    render(<RightPanel trusted />);
    expect(screen.getByTestId('chat-panel')).toBeDefined();
  });

  it('Scenario 3: locks chat when untrusted [R-CH-06]', () => {
    render(<ChatPanel trusted={false} />);
    const lock = screen.getByTestId('chat-locked-untrusted');
    expect(lock.textContent).toContain(
      'Dự án chưa được tin cậy. Mở hộp Project và chọn Tin cậy để dùng AI.',
    );
    expect(screen.getByTestId('chat-input')).toHaveProperty('disabled', true);
    expect(screen.getByTestId('chat-send')).toHaveProperty('disabled', true);
  });

  it('Scenario 4: shows onboarding install when no agents installed [R-CH-06]', async () => {
    vi.spyOn(agentClient, 'fetchAgents').mockResolvedValue([
      { id: 'agy', installed: false, login: 'unknown', loginAvailable: false },
      { id: 'claude', installed: false, login: 'unknown', loginAvailable: false },
    ]);

    render(<ChatPanel trusted />);
    const onboarding = await screen.findByTestId('agent-onboarding-install');
    expect(onboarding).toBeDefined();
    expect(screen.getByTestId('chat-input')).toHaveProperty('disabled', true);
  });

  it('Scenario 14: manages project backends and displays errors [R-CH-07]', async () => {
    const b1: BackendInfo = {
      id: 'be00000001',
      label: 'API Gateway',
      path: '/srv/api',
      status: 'ok',
      resolvedPath: '/srv/api',
      outsideParent: true,
    };
    vi.spyOn(projectClient, 'fetchProject').mockResolvedValue({
      ...MOCK_PROJECT,
      backends: [b1],
    });
    const removeSpy = vi.spyOn(projectClient, 'removeProjectBackend').mockResolvedValue(undefined);
    const addSpy = vi
      .spyOn(projectClient, 'addProjectBackend')
      .mockRejectedValue(new ApiError(400, 'E016'));
    vi.spyOn(projectClient, 'fetchDirectories').mockResolvedValue({
      parent: '/',
      path: '/srv',
      entries: [{ name: 'backend', path: '/srv/backend', isProject: false }],
      roots: [],
    });

    render(<ChatPanel trusted />);
    const chip = await screen.findByTestId('chat-backend-be00000001');
    expect(chip.textContent).toContain('API Gateway');

    const removeBtn = chip.querySelector('button');
    expect(removeBtn).toBeDefined();
    if (removeBtn) fireEvent.click(removeBtn);
    expect(removeSpy).toHaveBeenCalledWith('be00000001');

    fireEvent.click(screen.getByTestId('chat-import'));
    const dirEntry = await screen.findByTestId('dir-entry-backend');
    fireEvent.click(dirEntry);

    fireEvent.click(screen.getByTestId('chat-import-confirm'));
    await vi.waitFor(() => {
      expect(addSpy).toHaveBeenCalledWith('/srv/backend');
    });

    const errorEl = await screen.findByTestId('chat-import-error');
    expect(errorEl.textContent).toContain('E016');
  });

  it('E4: toggling off AI duoc sua file in Chat calls PATCH /project { ai: { allowEdits: false } } and shows Chi doc: AI khong sua file [WP-4.00]', async () => {
    const patchSpy = vi.spyOn(projectClient, 'patchProject').mockResolvedValue({
      ...MOCK_PROJECT,
      ai: { allowEdits: false },
    });

    vi.spyOn(agentClient, 'fetchAgentModels').mockResolvedValue([]);
    render(<ChatPanel trusted />);
    // The switch sits in the popover of the model chip by Send (K9.5).
    fireEvent.click(await screen.findByTestId('agent-settings-chip'));
    const editBtn = screen.getByTestId('chat-allow-edits');
    expect(editBtn.textContent).toBe('Sửa');
    expect(editBtn.getAttribute('aria-checked')).toBe('true');
    expect(screen.queryByTestId('agent-settings-ask')).toBeNull();

    fireEvent.click(screen.getByTestId('chat-ask-only'));

    await vi.waitFor(() => {
      expect(patchSpy).toHaveBeenCalledWith({ ai: { allowEdits: false } });
    });

    await screen.findByTestId('agent-settings-ask');
    expect(screen.getByTestId('agent-settings-popover').textContent).toContain(
      'Chỉ đọc: AI không sửa file',
    );
    expect(screen.getByTestId('chat-allow-edits').getAttribute('aria-checked')).toBe('false');
  });
});
