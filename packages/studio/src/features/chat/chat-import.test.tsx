// Tests for chat import folder/doc functionality (R-CH-02, R-MR-01, R-AG-21).
import type { BackendInfo, ProjectInfo } from '@kumicraft/shared';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import i18next from 'i18next';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import * as agentClient from '../../api/agent-client.ts';
import { ApiError } from '../../api/http.ts';
import * as projectClient from '../../api/project-client.ts';
import { useAgentsStore } from '../../store/agents-store.ts';
import { RightPanel } from '../editor/side-panels.tsx';
import { DEFAULT_THEME } from '../inspector/use-project-theme.ts';
import { ChatPanel } from './chat-panel.tsx';
import { useChatStore } from './chat-store.ts';

const MOCK_PROJECT: ProjectInfo = {
  id: 'proj000001',
  name: 'Test Project',
  root: 'D:\\proj',
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
    pages: 'src/pages',
    layouts: 'src/layouts',
    components: 'src/components',
    drafts: 'src/drafts',
  },
  trusted: true,
};

describe('Chat Import Part A [R-CH-02, R-MR-01, R-AG-21]', () => {
  beforeAll(async () => {
    const { initI18n } = await import('../../i18n/i18n.ts');
    await initI18n();
  });

  beforeEach(async () => {
    sessionStorage.setItem('kumicraft.sessionToken', 'tok-import');
    localStorage.clear();
    await i18next.changeLanguage('vi');
    useAgentsStore.getState().reset();
    useChatStore.getState().reset();
    vi.spyOn(projectClient, 'fetchProject').mockResolvedValue(MOCK_PROJECT);
    vi.spyOn(agentClient, 'fetchTurns').mockResolvedValue([]);
    vi.spyOn(projectClient, 'fetchProjectTheme').mockResolvedValue(DEFAULT_THEME);
    vi.spyOn(agentClient, 'fetchAgents').mockResolvedValue([
      { id: 'agy', installed: true, login: 'loggedIn', loginAvailable: true },
    ]);
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('Situation 3: ready chat has toolbar with import, add-image and badge [R-CH-02]', async () => {
    render(<ChatPanel trusted />);
    const toolbar = await screen.findByTestId('chat-toolbar');
    expect(toolbar).toBeDefined();

    expect(screen.getByTestId('chat-new-conversation')).toBeDefined();
    const importBtn = screen.getByTestId('chat-import');
    expect(importBtn.getAttribute('title')).toBe('Nhập thư mục');
    expect(importBtn.getAttribute('aria-label')).toBe('Nhập thư mục');
    expect(screen.getByTestId('chat-add-image')).toBeDefined();
    expect(screen.getByTestId('agent-badge')).toBeDefined();

    expect(screen.queryByTestId('chat-add-backend')).toBeNull();
    expect(screen.queryByTestId('chat-attach')).toBeNull();
  });

  it('Situation 4: imports doc in project, updates hint, adds doc chip without calling addBackend [R-CH-02]', async () => {
    const addSpy = vi.spyOn(projectClient, 'addProjectBackend');
    render(<ChatPanel trusted />);

    const importBtn = await screen.findByTestId('chat-import');
    fireEvent.click(importBtn);

    const pathInput = await screen.findByTestId('chat-import-path');
    fireEvent.change(pathInput, { target: { value: 'src/pages' } });

    const hint = screen.getByTestId('chat-import-hint');
    expect(hint.textContent).toContain('AI sẽ đọc src/pages');

    fireEvent.click(screen.getByTestId('chat-import-confirm'));
    expect(addSpy).not.toHaveBeenCalled();

    const docChip = await screen.findByTestId('chat-doc-0');
    expect(docChip.textContent).toContain('src/pages');
  });

  it('Situation 5: imports folder outside project calls addBackend and shows backend chip [R-MR-01]', async () => {
    const b1: BackendInfo = {
      id: 'be_api',
      label: 'api',
      path: 'D:\\work\\api',
      status: 'ok',
      resolvedPath: 'D:\\work\\api',
      outsideParent: true,
    };
    const addSpy = vi.spyOn(projectClient, 'addProjectBackend').mockResolvedValue(b1);
    vi.spyOn(projectClient, 'fetchProject').mockResolvedValue({
      ...MOCK_PROJECT,
      backends: [b1],
    });

    render(<ChatPanel trusted />);
    const importBtn = await screen.findByTestId('chat-import');
    fireEvent.click(importBtn);

    const pathInput = await screen.findByTestId('chat-import-path');
    fireEvent.change(pathInput, { target: { value: 'D:\\work\\api' } });
    fireEvent.click(screen.getByTestId('chat-import-confirm'));

    await waitFor(() => {
      expect(addSpy).toHaveBeenCalledWith('D:\\work\\api');
    });
    expect(screen.queryByTestId('chat-import-dialog')).toBeNull();
    const chip = await screen.findByTestId('chat-backend-be_api');
    expect(chip.textContent).toContain('api');
  });

  it('Situation 6: addBackend rejects with maxBackendsExceeded keeps dialog open with error [R-MR-01]', async () => {
    vi.spyOn(projectClient, 'addProjectBackend').mockRejectedValue(
      new ApiError(400, 'E016', { reason: 'maxBackendsExceeded' }),
    );

    render(<ChatPanel trusted />);
    fireEvent.click(await screen.findByTestId('chat-import'));

    const pathInput = await screen.findByTestId('chat-import-path');
    fireEvent.change(pathInput, { target: { value: 'D:\\work\\extra' } });
    fireEvent.click(screen.getByTestId('chat-import-confirm'));

    const errorEl = await screen.findByTestId('chat-import-error');
    expect(errorEl.textContent).toContain('quá số lượng');
    expect(screen.getByTestId('chat-import-dialog')).toBeDefined();
  });

  it('Situation 7: typing project root shows hintRoot and disables confirm [R-CH-02]', async () => {
    render(<ChatPanel trusted />);
    fireEvent.click(await screen.findByTestId('chat-import'));

    const pathInput = await screen.findByTestId('chat-import-path');
    fireEvent.change(pathInput, { target: { value: 'D:\\proj' } });

    const hint = screen.getByTestId('chat-import-hint');
    expect(hint.textContent).toContain('thư mục dự án, AI đã đọc sẵn');
    expect(screen.getByTestId('chat-import-confirm')).toHaveProperty('disabled', true);
  });

  it('Situation 8: adding same doc path twice only creates one chip [R-CH-02]', async () => {
    render(<ChatPanel trusted />);
    const importBtn = await screen.findByTestId('chat-import');

    fireEvent.click(importBtn);
    fireEvent.change(await screen.findByTestId('chat-import-path'), {
      target: { value: 'src/pages' },
    });
    fireEvent.click(screen.getByTestId('chat-import-confirm'));

    fireEvent.click(screen.getByTestId('chat-import'));
    fireEvent.change(await screen.findByTestId('chat-import-path'), {
      target: { value: 'src/pages' },
    });
    fireEvent.click(screen.getByTestId('chat-import-confirm'));

    expect(screen.getByTestId('chat-doc-0').textContent).toContain('src/pages');
    expect(screen.queryByTestId('chat-doc-1')).toBeNull();
  });

  it('Situation 9: removing both backend and doc chips hides attachments bar [R-CH-02, R-MR-01]', async () => {
    const b1: BackendInfo = {
      id: 'be01',
      label: 'backend',
      path: 'D:\\api',
      status: 'ok',
      resolvedPath: 'D:\\api',
      outsideParent: true,
    };
    vi.spyOn(projectClient, 'fetchProject').mockResolvedValue({
      ...MOCK_PROJECT,
      backends: [b1],
    });
    const removeSpy = vi.spyOn(projectClient, 'removeProjectBackend').mockResolvedValue(undefined);

    render(<ChatPanel trusted />);
    fireEvent.click(await screen.findByTestId('chat-import'));
    fireEvent.change(await screen.findByTestId('chat-import-path'), {
      target: { value: 'src/pages' },
    });
    fireEvent.click(screen.getByTestId('chat-import-confirm'));

    expect(await screen.findByTestId('chat-attachments')).toBeDefined();

    const beChip = screen.getByTestId('chat-backend-be01');
    const beRemove = beChip.querySelector('button');
    if (beRemove) fireEvent.click(beRemove);
    expect(removeSpy).toHaveBeenCalledWith('be01');

    vi.spyOn(projectClient, 'fetchProject').mockResolvedValue(MOCK_PROJECT);

    const docChip = screen.getByTestId('chat-doc-0');
    const docRemove = docChip.querySelector('button');
    if (docRemove) fireEvent.click(docRemove);

    await waitFor(() => {
      expect(screen.queryByTestId('chat-attachments')).toBeNull();
    });
  });

  it('Situation 10: sending two consecutive turns preserves doc chip [R-CH-02]', async () => {
    const startTurnSpy = vi.spyOn(agentClient, 'startTurn').mockResolvedValue({ jobId: 'j1' });

    render(<ChatPanel trusted />);
    fireEvent.click(await screen.findByTestId('chat-import'));
    fireEvent.change(await screen.findByTestId('chat-import-path'), {
      target: { value: 'src/pages' },
    });
    fireEvent.click(screen.getByTestId('chat-import-confirm'));

    const input = await screen.findByTestId('chat-input');
    fireEvent.change(input, { target: { value: 'Tin 1' } });
    fireEvent.keyDown(input, { key: 'Enter', ctrlKey: true });

    expect(startTurnSpy).toHaveBeenCalledWith(expect.objectContaining({ docs: ['src/pages'] }));
    useChatStore.getState().finishJobCompleted('j1');

    fireEvent.change(input, { target: { value: 'Tin 2' } });
    fireEvent.keyDown(input, { key: 'Enter', ctrlKey: true });

    expect(startTurnSpy).toHaveBeenCalledWith(expect.objectContaining({ docs: ['src/pages'] }));
    expect(screen.getByTestId('chat-doc-0').textContent).toContain('src/pages');
  });

  it('Situation 11: selecting folder in DirectoryBrowser updates path input [R-CH-02]', async () => {
    vi.spyOn(projectClient, 'fetchDirectories').mockResolvedValue({
      parent: 'D:\\',
      path: 'D:\\proj',
      entries: [{ name: 'sub', path: 'D:\\proj\\sub', isProject: false }],
      roots: [],
    });

    render(<ChatPanel trusted />);
    fireEvent.click(await screen.findByTestId('chat-import'));

    const entry = await screen.findByTestId('dir-entry-sub');
    fireEvent.click(entry);

    const pathInput = screen.getByTestId('chat-import-path');
    expect(pathInput).toHaveProperty('value', 'D:\\proj\\sub');
  });

  it('Situation 12: onboarding step does not render chat-import or chat-add-image [R-AG-21]', async () => {
    vi.spyOn(agentClient, 'fetchAgents').mockResolvedValue([
      { id: 'agy', installed: false, login: 'unknown', loginAvailable: false },
      { id: 'claude', installed: false, login: 'unknown', loginAvailable: false },
    ]);

    render(<ChatPanel trusted />);
    await screen.findByTestId('agent-onboarding-install');

    expect(screen.queryByTestId('chat-import')).toBeNull();
    expect(screen.queryByTestId('chat-add-image')).toBeNull();
  });

  it('places chat-import and chat-add-image in panel header when rendered in RightPanel [R-CH-02]', async () => {
    localStorage.setItem('kumicraft.rightPanelTab', 'chat');
    render(<RightPanel trusted />);
    const headerActions = await screen.findByTestId('panel-header-actions');
    const importBtn = await screen.findByTestId('chat-import');
    const addImageBtn = await screen.findByTestId('chat-add-image');
    expect(headerActions.contains(importBtn)).toBe(true);
    expect(headerActions.contains(addImageBtn)).toBe(true);
  });
});
