// Flow tests for AI chat turns, context, docs, events, and job lifecycle (WP-3.05a, Scenarios 5-9, 11-13).
import type { ProjectInfo } from '@reactcraft/shared';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import i18next from 'i18next';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import * as agentClient from '../../api/agent-client.ts';
import { ApiError } from '../../api/http.ts';
import * as jobsClient from '../../api/jobs-client.ts';
import * as projectClient from '../../api/project-client.ts';
import { useCanvasViewStore } from '../editor/canvas-view-store.ts';
import { useSelectionStore } from '../selection/selection-store.ts';
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
    pages: 'src/pages',
    layouts: 'src/layouts',
    components: 'src/components',
    drafts: 'src/drafts',
  },
  trusted: true,
};

function setupActiveContext() {
  useSelectionStore
    .getState()
    .setSelectedRefs([{ loc: 'src/components/Header.tsx:12:5', index: 0 }]);
  useSelectionStore
    .getState()
    .setTree([
      { ref: { loc: 'src/components/Header.tsx:12:5', index: 0 }, tag: 'header', instances: 1 },
    ]);
  useSelectionStore.getState().setRoute('/about');
  useCanvasViewStore
    .getState()
    .setFrames([{ id: 'desktop', label: 'Desktop', width: 1440, height: 900 }]);
  useCanvasViewStore.getState().setActiveFrameId('desktop');
}

describe('ChatFlow execution [R-CH-01, R-CH-02, R-CH-03]', () => {
  beforeAll(async () => {
    const { initI18n } = await import('../../i18n/i18n.ts');
    await initI18n();
  });

  beforeEach(async () => {
    sockets = [];
    vi.stubGlobal('WebSocket', FakeSocket);
    sessionStorage.setItem('reactcraft.sessionToken', 'tok-chat');
    localStorage.clear();
    await i18next.changeLanguage('vi');
    useChatStore.getState().reset();
    useSelectionStore.getState().clearSelection();
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

  it('Scenario 5: sends prompt with element, route, and frame context [R-CH-01, R-CH-02]', async () => {
    setupActiveContext();
    const startTurnSpy = vi.spyOn(agentClient, 'startTurn').mockResolvedValue({ jobId: 'job0001' });

    render(<ChatPanel trusted />);
    const input = await screen.findByTestId('chat-input');
    fireEvent.change(input, { target: { value: 'Đổi màu' } });
    fireEvent.keyDown(input, { key: 'Enter', ctrlKey: true });

    expect(startTurnSpy).toHaveBeenCalledWith({
      prompt: 'Đổi màu',
      context: {
        element: { loc: 'src/components/Header.tsx:12:5', tag: 'header' },
        route: '/about',
        frame: { id: 'desktop', width: 1440 },
      },
      conversation: 'new',
      docs: [],
    });
  });

  it('Scenario 6: does not send on plain Enter or whitespace-only [R-CH-01]', async () => {
    const startTurnSpy = vi.spyOn(agentClient, 'startTurn').mockResolvedValue({ jobId: 'job0001' });

    render(<ChatPanel trusted />);
    const input = await screen.findByTestId('chat-input');
    const sendBtn = screen.getByTestId('chat-send');
    expect(sendBtn).toHaveProperty('disabled', true);

    fireEvent.change(input, { target: { value: '   ' } });
    expect(sendBtn).toHaveProperty('disabled', true);

    fireEvent.keyDown(input, { key: 'Enter', ctrlKey: false });
    expect(startTurnSpy).not.toHaveBeenCalled();
  });

  it('Scenario 7: allows removing context chip and continues conversation on turn 2 [R-CH-02]', async () => {
    setupActiveContext();
    const startTurnSpy = vi.spyOn(agentClient, 'startTurn').mockResolvedValue({ jobId: 'job0001' });

    render(<ChatPanel trusted />);
    const removeElementBtn = await screen.findByTestId('chat-chip-element-remove');
    fireEvent.click(removeElementBtn);

    const input = screen.getByTestId('chat-input');
    fireEvent.change(input, { target: { value: 'Lượt 1' } });
    fireEvent.keyDown(input, { key: 'Enter', ctrlKey: true });

    expect(startTurnSpy).toHaveBeenLastCalledWith(
      expect.objectContaining({
        prompt: 'Lượt 1',
        context: {
          route: '/about',
          frame: { id: 'desktop', width: 1440 },
        },
        conversation: 'new',
      }),
    );

    await screen.findByTestId('chat-cancel');
    useChatStore.getState().finishJobCompleted('job0001');

    // Chip reappears for turn 2 and conversation is continue
    expect(await screen.findByTestId('chat-chip-element')).toBeDefined();

    fireEvent.change(input, { target: { value: 'Lượt 2' } });
    fireEvent.keyDown(input, { key: 'Enter', ctrlKey: true });

    expect(startTurnSpy).toHaveBeenLastCalledWith(
      expect.objectContaining({
        prompt: 'Lượt 2',
        conversation: 'continue',
      }),
    );
  });

  it('Scenario 8: attaches and removes docs before sending [R-CH-02]', async () => {
    const startTurnSpy = vi.spyOn(agentClient, 'startTurn').mockResolvedValue({ jobId: 'job0001' });

    render(<ChatPanel trusted />);
    const attachBtn = await screen.findByTestId('chat-attach');
    fireEvent.click(attachBtn);

    const docInput = screen.getByTestId('chat-doc-input');
    fireEvent.change(docInput, { target: { value: 'docs/a.md' } });
    fireEvent.keyDown(docInput, { key: 'Enter' });

    fireEvent.click(attachBtn);
    const docInput2 = screen.getByTestId('chat-doc-input');
    fireEvent.change(docInput2, { target: { value: 'docs/b.md' } });
    fireEvent.keyDown(docInput2, { key: 'Enter' });

    expect(screen.getByTestId('chat-doc-0').textContent).toContain('docs/a.md');
    expect(screen.getByTestId('chat-doc-1').textContent).toContain('docs/b.md');

    const removeBtnA = screen.getByTestId('chat-doc-0').querySelector('button');
    if (removeBtnA) fireEvent.click(removeBtnA);

    const input = screen.getByTestId('chat-input');
    fireEvent.change(input, { target: { value: 'Xem docs' } });
    fireEvent.keyDown(input, { key: 'Enter', ctrlKey: true });

    expect(startTurnSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        docs: ['docs/b.md'],
      }),
    );
    expect(screen.queryByTestId('chat-doc-0')).toBeNull();
  });

  it('Scenario 9: streams agent messages and tools, ignoring different turnId [R-CH-03]', async () => {
    vi.spyOn(agentClient, 'startTurn').mockResolvedValue({ jobId: 'job0009' });

    render(<ChatPanel trusted />);
    const input = await screen.findByTestId('chat-input');
    fireEvent.change(input, { target: { value: 'Chạy đi' } });
    fireEvent.keyDown(input, { key: 'Enter', ctrlKey: true });

    await screen.findByTestId('chat-cancel');

    serverSends('agent.event', { turnId: 'turn000001', event: { kind: 'message', text: 'Đang ' } });
    serverSends('agent.event', {
      turnId: 'turn000001',
      event: { kind: 'message', text: 'đọc API' },
    });
    serverSends('agent.event', {
      turnId: 'turn000001',
      event: { kind: 'tool', name: 'read_file', target: 'src/api.ts' },
    });
    serverSends('agent.event', { turnId: 'turn000001', event: { kind: 'message', text: 'Xong' } });
    serverSends('agent.event', {
      turnId: 'turn999999',
      event: { kind: 'message', text: 'Bỏ qua' },
    });

    await vi.waitFor(() => {
      expect(screen.getByText('Đang đọc API')).toBeDefined();
    });
    const toolEl = screen.getByTestId('chat-tool');
    expect(toolEl.textContent).toContain('read_file');
    expect(toolEl.textContent).toContain('src/api.ts');
    expect(screen.getByText('Xong')).toBeDefined();
    expect(screen.queryByText('Bỏ qua')).toBeNull();
  });

  it('Scenario 11: cancels running turn [R-CH-03]', async () => {
    vi.spyOn(agentClient, 'startTurn').mockResolvedValue({ jobId: 'job0011' });
    const cancelSpy = vi.spyOn(jobsClient, 'cancelJob').mockResolvedValue(undefined);

    render(<ChatPanel trusted />);
    const input = await screen.findByTestId('chat-input');
    fireEvent.change(input, { target: { value: 'Lệnh hủy' } });
    fireEvent.keyDown(input, { key: 'Enter', ctrlKey: true });

    const cancelBtn = await screen.findByTestId('chat-cancel');
    fireEvent.click(cancelBtn);
    expect(cancelSpy).toHaveBeenCalledWith('job0011');

    serverSends('job.cancelled', { jobId: 'job0011', kind: 'agent.turn' });

    const summary = await screen.findByTestId('chat-turn-summary');
    expect(summary.textContent).toBe('Đã hủy');
    expect(screen.queryByTestId('chat-cancel')).toBeNull();
  });

  it('Scenario 12: handles job.completed and job.failed summaries [R-CH-03]', async () => {
    vi.spyOn(agentClient, 'startTurn').mockResolvedValue({ jobId: 'job0012' });

    render(<ChatPanel trusted />);
    const input = await screen.findByTestId('chat-input');
    fireEvent.change(input, { target: { value: 'Lượt thành công' } });
    fireEvent.keyDown(input, { key: 'Enter', ctrlKey: true });

    await screen.findByTestId('chat-cancel');

    serverSends('job.completed', {
      jobId: 'job0012',
      kind: 'agent.turn',
      result: {
        id: 'turn000012',
        agent: 'agy',
        startedAt: '2026-10-22T00:00:00.000Z',
        prompt: 'Lượt thành công',
        state: 'completed',
        files: [
          { path: 'src/a.ts', change: 'modified' },
          { path: 'src/b.ts', change: 'created' },
          { path: 'src/c.ts', change: 'deleted' },
        ],
        revertible: true,
        notices: [],
      },
    });

    const summary1 = await screen.findByTestId('chat-turn-summary');
    expect(summary1.textContent).toBe('Xong · 3 file đã đổi');

    // Turn 2 failed
    vi.spyOn(agentClient, 'startTurn').mockResolvedValue({ jobId: 'job0013' });
    fireEvent.change(input, { target: { value: 'Lượt lỗi' } });
    fireEvent.keyDown(input, { key: 'Enter', ctrlKey: true });

    await vi.waitFor(() => {
      const cancels = screen.getAllByTestId('chat-cancel');
      expect(cancels.length).toBeGreaterThan(0);
    });

    serverSends('job.failed', {
      jobId: 'job0013',
      kind: 'agent.turn',
      error: { code: 'E027', params: { agent: 'agy', exitCode: 1 } },
    });

    await vi.waitFor(() => {
      const summaries = screen.getAllByTestId('chat-turn-summary');
      const failSummary = summaries[summaries.length - 1];
      expect(failSummary?.textContent).toContain('E027');
    });
  });

  it('Scenario 13: preserves draft when startTurn fails and displays error [R-CH-03]', async () => {
    vi.spyOn(agentClient, 'startTurn').mockRejectedValue(new ApiError(400, 'E018'));

    render(<ChatPanel trusted />);
    const input = await screen.findByTestId('chat-input');
    fireEvent.change(input, { target: { value: 'Chữ cần giữ' } });
    fireEvent.keyDown(input, { key: 'Enter', ctrlKey: true });

    const errorEl = await screen.findByTestId('chat-send-error');
    expect(errorEl.textContent).toContain('E018');

    expect(screen.getByTestId<HTMLTextAreaElement>('chat-input').value).toBe('Chữ cần giữ');
  });
});
