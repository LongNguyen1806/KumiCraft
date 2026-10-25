// Tests for changed files, diff view, revert turn, history, and new conversation (WP-3.05b, Situations 1-12).
import type { ProjectInfo, TurnFile, TurnSummary } from '@kumicraft/shared';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import i18next from 'i18next';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import * as agentClient from '../../api/agent-client.ts';
import * as editorClient from '../../api/editor-client.ts';
import { ApiError } from '../../api/http.ts';
import * as projectClient from '../../api/project-client.ts';
import { ChatDiff } from './chat-diff.tsx';
import { ChatFiles } from './chat-files.tsx';
import { ChatPanel } from './chat-panel.tsx';
import { ChatRevert } from './chat-revert.tsx';
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

function serverSends(type: string, payload: unknown): void {
  const data = JSON.stringify({ v: 1, type, at: '2026-10-22T00:00:00.000Z', payload });
  for (const socket of sockets) {
    socket.onmessage?.({ data });
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

const SUMMARY_3_FILES: TurnSummary = {
  id: 'turn000001',
  agent: 'agy',
  startedAt: '2026-10-22T00:00:00.000Z',
  prompt: 'Change 3 files',
  state: 'completed',
  files: [
    { path: 'src/App.tsx', change: 'modified' },
    { path: 'src/pages/New.tsx', change: 'created' },
    { path: 'public/old.png', change: 'deleted' },
  ],
  revertible: true,
  notices: [],
};

describe('Chat files, diff, revert, history, and new conversation [WP-3.05b]', () => {
  beforeAll(async () => {
    const { initI18n } = await import('../../i18n/i18n.ts');
    await initI18n();
  });

  beforeEach(async () => {
    sockets = [];
    vi.stubGlobal('WebSocket', FakeSocket);
    sessionStorage.setItem('kumicraft.sessionToken', 'tok-chat');
    localStorage.clear();
    await i18next.changeLanguage('vi');
    useChatStore.getState().reset();
    vi.spyOn(projectClient, 'fetchProject').mockResolvedValue(MOCK_PROJECT);
    vi.spyOn(agentClient, 'fetchAgents').mockResolvedValue([
      { id: 'agy', installed: true, login: 'unknown', loginAvailable: false },
    ]);
    vi.spyOn(agentClient, 'fetchTurns').mockResolvedValue([]);
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('Sit 1 [R-CH-04]: job.completed with 3 files renders rows and open buttons', async () => {
    vi.spyOn(agentClient, 'startTurn').mockResolvedValue({ jobId: 'job0001' });

    render(<ChatPanel trusted />);
    const input = await screen.findByTestId('chat-input');
    fireEvent.change(input, { target: { value: 'Sửa 3 file' } });
    fireEvent.keyDown(input, { key: 'Enter', ctrlKey: true });
    await screen.findByTestId('chat-cancel');

    serverSends('job.completed', {
      jobId: 'job0001',
      kind: 'agent.turn',
      result: SUMMARY_3_FILES,
    });

    const fileContainer = await screen.findByTestId('chat-files');
    expect(fileContainer).toBeDefined();

    const row0 = screen.getByTestId('chat-file-0');
    expect(row0.getAttribute('data-change')).toBe('modified');
    expect(row0.textContent).toContain('src/App.tsx');
    expect(screen.getByTestId('chat-file-open-0')).toBeDefined();

    const row1 = screen.getByTestId('chat-file-1');
    expect(row1.getAttribute('data-change')).toBe('created');
    expect(row1.textContent).toContain('src/pages/New.tsx');
    expect(screen.getByTestId('chat-file-open-1')).toBeDefined();

    const row2 = screen.getByTestId('chat-file-2');
    expect(row2.getAttribute('data-change')).toBe('deleted');
    expect(row2.textContent).toContain('public/old.png');
    expect(screen.queryByTestId('chat-file-open-2')).toBeNull();
  });

  it('Sit 2 [R-CH-04, S-16]: clicking file toggles diff with correct line kinds', async () => {
    const diffSpy = vi
      .spyOn(agentClient, 'fetchTurnDiff')
      .mockResolvedValue(
        '--- a/src/App.tsx\n+++ b/src/App.tsx\n@@ -1,3 +1,3 @@\n-old\n+new\n context 1\n context 2',
      );

    render(<ChatFiles turnId="turn000001" files={SUMMARY_3_FILES.files} />);
    fireEvent.click(screen.getByTestId('chat-file-0'));
    await screen.findByTestId('chat-diff');

    expect(diffSpy).toHaveBeenCalledWith('turn000001', 'src/App.tsx');

    const lines = screen.getAllByTestId('chat-diff-line');
    expect(lines[0]?.getAttribute('data-kind')).toBe('ctx');
    expect(lines[1]?.getAttribute('data-kind')).toBe('ctx');
    expect(lines[2]?.getAttribute('data-kind')).toBe('hunk');
    expect(lines[3]?.getAttribute('data-kind')).toBe('del');
    expect(lines[4]?.getAttribute('data-kind')).toBe('add');
    expect(lines[5]?.getAttribute('data-kind')).toBe('ctx');
    expect(lines[6]?.getAttribute('data-kind')).toBe('ctx');

    fireEvent.click(screen.getByTestId('chat-file-0'));
    expect(screen.queryByTestId('chat-diff')).toBeNull();
  });

  it('Sit 3 [S-16]: diff escapes script and img tags into text without DOM elements', async () => {
    vi.spyOn(agentClient, 'fetchTurnDiff').mockResolvedValue(
      '+<script>alert(1)</script>\n+<img src=x onerror=alert(1)>',
    );

    const { container } = render(<ChatDiff turnId="turn000001" path="src/App.tsx" />);
    await screen.findByTestId('chat-diff');

    expect(container.textContent).toContain('<script>alert(1)</script>');
    expect(container.textContent).toContain('<img src=x onerror=alert(1)>');
    expect(container.querySelector('script')).toBeNull();
    expect(container.querySelector('img')).toBeNull();
  });

  it('Sit 4 [R-CH-04]: clicking open editor calls openInEditor and displays E021 error', async () => {
    const openSpy = vi
      .spyOn(editorClient, 'openInEditor')
      .mockRejectedValue(new ApiError(400, 'E021'));

    render(<ChatFiles turnId="turn000001" files={SUMMARY_3_FILES.files} />);
    fireEvent.click(screen.getByTestId('chat-file-open-0'));

    expect(openSpy).toHaveBeenCalledWith('src/App.tsx:1:1');
    const errText = await screen.findByText(/E021/);
    expect(errText).toBeDefined();
  });

  it('Sit 5 [R-CH-04]: chat-revert shows dialog with file count and cancel does not call revert', () => {
    const revertSpy = vi.spyOn(agentClient, 'revertTurn');

    render(<ChatRevert turnId="turn000001" summary={SUMMARY_3_FILES} />);
    fireEvent.click(screen.getByTestId('chat-revert'));

    const dialog = screen.getByTestId('chat-revert-dialog');
    expect(dialog.textContent).toContain('3 file');

    fireEvent.click(screen.getByTestId('chat-revert-cancel'));
    expect(revertSpy).not.toHaveBeenCalled();
    expect(screen.queryByTestId('chat-revert-dialog')).toBeNull();
  });

  it('Sit 6 [R-CH-04]: chat-revert confirm calls revertTurn and shows reverted label', async () => {
    const revertSpy = vi
      .spyOn(agentClient, 'revertTurn')
      .mockResolvedValue({ ...SUMMARY_3_FILES, revertible: false });

    render(<ChatRevert turnId="turn000001" summary={SUMMARY_3_FILES} />);
    fireEvent.click(screen.getByTestId('chat-revert'));
    fireEvent.click(screen.getByTestId('chat-revert-confirm'));

    await screen.findByTestId('chat-reverted');
    expect(revertSpy).toHaveBeenCalledTimes(1);
    expect(screen.queryByTestId('chat-revert')).toBeNull();
  });

  it('Sit 7 [R-CH-04]: revertTurn rejected with E017 displays file name and translated error', async () => {
    vi.spyOn(agentClient, 'revertTurn').mockRejectedValue(
      new ApiError(409, 'E017', { file: 'src/App.tsx', reason: 'fileChanged' }),
    );

    render(<ChatRevert turnId="turn000001" summary={SUMMARY_3_FILES} />);
    fireEvent.click(screen.getByTestId('chat-revert'));
    fireEvent.click(screen.getByTestId('chat-revert-confirm'));

    const err = await screen.findByTestId('chat-revert-error');
    expect(err.textContent).toContain('src/App.tsx');
    expect(err.textContent).toContain('E017');
    expect(screen.getByTestId('chat-revert')).toBeDefined();
  });

  it('Sit 8 [R-CH-04]: virtualizes list with 120 files rendering fewer in DOM until scroll', async () => {
    vi.spyOn(HTMLElement.prototype, 'offsetHeight', 'get').mockReturnValue(200);
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({
      width: 300,
      height: 200,
      top: 0,
      left: 0,
      bottom: 200,
      right: 300,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    });

    const manyFiles: TurnFile[] = Array.from({ length: 120 }, (_, i) => ({
      path: `src/components/Comp${String(i)}.tsx`,
      change: 'modified',
    }));

    const { container } = render(<ChatFiles turnId="turn000001" files={manyFiles} />);
    const renderedBefore = screen.getAllByTestId(/^chat-file-\d+$/);
    expect(renderedBefore.length).toBeLessThan(120);

    const scrollContainer = container.querySelector('.max-h-64');
    expect(scrollContainer).not.toBeNull();
    if (scrollContainer) {
      fireEvent.scroll(scrollContainer, { target: { scrollTop: 120 * 28 } });
      expect(await screen.findByTestId('chat-file-119')).toBeDefined();
    }
  });

  it('Sit 9 [R-CH-05]: loads history turns chronologically and shows revert for completed', async () => {
    const turnOld: TurnSummary = {
      id: 'turn000000',
      agent: 'agy',
      startedAt: '2026-10-21T10:00:00.000Z',
      prompt: 'Cũ hơn',
      state: 'failed',
      files: [],
      revertible: false,
      notices: [],
    };
    const turnNew: TurnSummary = {
      id: 'turn000001',
      agent: 'agy',
      startedAt: '2026-10-22T10:00:00.000Z',
      prompt: 'Mới hơn',
      state: 'completed',
      files: [{ path: 'src/App.tsx', change: 'modified' }],
      revertible: true,
      notices: [],
    };

    vi.spyOn(agentClient, 'fetchTurns').mockResolvedValue([turnNew, turnOld]);
    render(<ChatPanel trusted />);

    await screen.findByText('Cũ hơn');
    await screen.findByText('Mới hơn');

    const prompts = screen.getAllByText(/Cũ hơn|Mới hơn/);
    expect(prompts[0]?.textContent).toBe('Cũ hơn');
    expect(prompts[1]?.textContent).toBe('Mới hơn');
    expect(screen.getByTestId('chat-revert')).toBeDefined();
  });

  it('Sit 10 [R-CH-05]: live turn is not duplicated when fetchTurns returns the same turnId', async () => {
    vi.spyOn(agentClient, 'startTurn').mockResolvedValue({ jobId: 'job0001' });

    render(<ChatPanel trusted />);
    const input = await screen.findByTestId('chat-input');
    fireEvent.change(input, { target: { value: 'Lượt của phiên' } });
    fireEvent.keyDown(input, { key: 'Enter', ctrlKey: true });
    await screen.findByTestId('chat-cancel');

    serverSends('agent.event', { turnId: 'turn0000t1', event: { kind: 'conversation', id: 'c1' } });
    serverSends('job.completed', {
      jobId: 'job0001',
      kind: 'agent.turn',
      result: { ...SUMMARY_3_FILES, id: 'turn0000t1', prompt: 'Lượt của phiên' },
    });

    await screen.findByTestId('chat-files');

    useChatStore
      .getState()
      .loadHistory([{ ...SUMMARY_3_FILES, id: 'turn0000t1', prompt: 'Lượt của phiên' }]);

    const prompts = screen.getAllByText('Lượt của phiên');
    expect(prompts.length).toBe(1);
  });

  it('Sit 11 [R-CH-05]: new conversation sends conversation: new and shows divider after turn 2', async () => {
    const startSpy = vi
      .spyOn(agentClient, 'startTurn')
      .mockResolvedValueOnce({ jobId: 'job0001' })
      .mockResolvedValueOnce({ jobId: 'job0002' })
      .mockResolvedValueOnce({ jobId: 'job0003' });

    render(<ChatPanel trusted />);
    const input = await screen.findByTestId('chat-input');

    // Turn 1
    fireEvent.change(input, { target: { value: 'Turn 1' } });
    fireEvent.keyDown(input, { key: 'Enter', ctrlKey: true });
    await screen.findByTestId('chat-cancel');
    expect(startSpy).toHaveBeenLastCalledWith(expect.objectContaining({ conversation: 'new' }));
    serverSends('job.completed', {
      jobId: 'job0001',
      kind: 'agent.turn',
      result: { ...SUMMARY_3_FILES, id: 'turn000001', prompt: 'Turn 1' },
    });
    await vi.waitFor(() => {
      expect(screen.queryByTestId('chat-cancel')).toBeNull();
    });

    // Turn 2
    fireEvent.change(input, { target: { value: 'Turn 2' } });
    fireEvent.keyDown(input, { key: 'Enter', ctrlKey: true });
    await screen.findByTestId('chat-cancel');
    expect(startSpy).toHaveBeenLastCalledWith(
      expect.objectContaining({ conversation: 'continue' }),
    );
    serverSends('job.completed', {
      jobId: 'job0002',
      kind: 'agent.turn',
      result: { ...SUMMARY_3_FILES, id: 'turn000002', prompt: 'Turn 2' },
    });
    await vi.waitFor(() => {
      expect(screen.queryByTestId('chat-cancel')).toBeNull();
    });

    // Click new conversation
    fireEvent.click(screen.getByTestId('chat-new-conversation'));
    expect(screen.getByTestId('chat-divider')).toBeDefined();

    // Turn 3
    fireEvent.change(input, { target: { value: 'Turn 3' } });
    fireEvent.keyDown(input, { key: 'Enter', ctrlKey: true });
    await screen.findByTestId('chat-cancel');
    expect(startSpy).toHaveBeenLastCalledWith(expect.objectContaining({ conversation: 'new' }));
  });

  it('Sit 12 [R-CH-05]: chat-new-conversation is disabled while a turn is running', async () => {
    vi.spyOn(agentClient, 'startTurn').mockResolvedValue({ jobId: 'job0001' });

    render(<ChatPanel trusted />);
    const input = await screen.findByTestId('chat-input');

    const newConvBtn = screen.getByTestId('chat-new-conversation');
    expect(newConvBtn).toHaveProperty('disabled', false);

    fireEvent.change(input, { target: { value: 'Đang chạy' } });
    fireEvent.keyDown(input, { key: 'Enter', ctrlKey: true });

    await screen.findByTestId('chat-cancel');
    expect(newConvBtn).toHaveProperty('disabled', true);
  });
});
