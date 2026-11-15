// Tests for the chat session list: grouping, opening a session, what the chat then shows (K9.5).
import type { TurnSummary } from '@kumicraft/shared';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import i18next from 'i18next';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import * as agentClient from '../../api/agent-client.ts';
import { ChatSessions } from './chat-sessions.tsx';
import { groupSessions, turnsOfSession } from './chat-sessions-model.ts';
import { useChatStore } from './chat-store.ts';

function turn(id: string, minute: number, extra: Partial<TurnSummary> = {}): TurnSummary {
  return {
    id: id.padEnd(10, '0'),
    agent: 'agy',
    startedAt: new Date(Date.UTC(2026, 10, 7, 10, minute)).toISOString(),
    prompt: `prompt ${id}`,
    state: 'completed',
    files: [],
    revertible: false,
    notices: [],
    ...extra,
  };
}

const TURNS: readonly TurnSummary[] = [
  turn('a2', 30, { conversation: 'conv-a' }),
  turn('b1', 20, { conversation: 'conv-b', agent: 'claude' }),
  turn('a1', 10, { conversation: 'conv-a' }),
  turn('old', 1),
];

describe('groupSessions [K9.5]', () => {
  it('makes one session per conversation, newest first, titled by its first request', () => {
    const sessions = groupSessions(TURNS);
    expect(sessions.map((s) => [s.id, s.title, s.turnCount])).toEqual([
      ['conv-a', 'prompt a1', 2],
      ['conv-b', 'prompt b1', 1],
      [undefined, 'prompt old', 1],
    ]);
    expect(turnsOfSession(TURNS, 'conv-a').map((t) => t.prompt)).toEqual([
      'prompt a1',
      'prompt a2',
    ]);
  });

  it('leaves out a running turn that has no conversation yet', () => {
    expect(groupSessions([turn('run', 5, { state: 'running' })])).toEqual([]);
  });
});

describe('ChatSessions card [K9.5]', () => {
  beforeAll(async () => {
    const { initI18n } = await import('../../i18n/i18n.ts');
    await initI18n();
  });

  beforeEach(async () => {
    await i18next.changeLanguage('vi');
    useChatStore.getState().reset();
    vi.spyOn(agentClient, 'fetchTurns').mockResolvedValue(TURNS);
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('opening a session resumes it on the server and shows only its turns', async () => {
    const resume = vi
      .spyOn(agentClient, 'resumeConversation')
      .mockResolvedValue({ agent: 'agy', id: 'conv-a' });
    const onClose = vi.fn();
    render(<ChatSessions agent="agy" onClose={onClose} />);

    const rows = await screen.findAllByTestId('chat-session');
    expect(rows.map((r) => r.textContent)).toEqual([
      expect.stringContaining('prompt a1'),
      expect.stringContaining('prompt b1'),
      expect.stringContaining('chỉ xem'),
    ]);
    // Claude's session cannot continue with Antigravity.
    expect(rows[1]?.hasAttribute('disabled')).toBe(true);

    fireEvent.click(rows[0] as HTMLElement);
    await vi.waitFor(() => {
      expect(onClose).toHaveBeenCalled();
    });
    expect(resume).toHaveBeenCalledWith('conv-a');
    const state = useChatStore.getState();
    expect(state.sessionId).toBe('conv-a');
    expect(state.hasConversation).toBe(true);
    expect(state.turns.map((t) => t.turnId)).toEqual([TURNS[2]?.id, TURNS[0]?.id]);
  });

  it('older turns open to read; the next request starts a new conversation', async () => {
    const resume = vi.spyOn(agentClient, 'resumeConversation');
    render(<ChatSessions agent="agy" onClose={vi.fn()} />);
    const rows = await screen.findAllByTestId('chat-session');
    fireEvent.click(rows[2] as HTMLElement);
    await vi.waitFor(() => {
      expect(useChatStore.getState().turns).toHaveLength(1);
    });
    expect(resume).not.toHaveBeenCalled();
    expect(useChatStore.getState().hasConversation).toBe(false);
  });

  it('deletes a session from KumiCraft after a confirm and reads the list again', async () => {
    const forget = vi.spyOn(agentClient, 'forgetConversation').mockResolvedValue({ removed: 2 });
    useChatStore.getState().showSession(turnsOfSession(TURNS, 'conv-a'), 'conv-a');
    render(<ChatSessions agent="agy" onClose={vi.fn()} />);
    await screen.findAllByTestId('chat-session');

    fireEvent.click(screen.getAllByTestId('chat-session-delete')[0] as HTMLElement);
    expect(forget).not.toHaveBeenCalled();
    fireEvent.click(screen.getByTestId('chat-session-delete-confirm'));

    await vi.waitFor(() => {
      expect(forget).toHaveBeenCalledWith('conv-a');
    });
    await vi.waitFor(() => {
      expect(agentClient.fetchTurns).toHaveBeenCalledTimes(2);
    });
    // The chat was showing that session: it starts a new conversation.
    expect(useChatStore.getState().sessionId).toBeUndefined();
  });

  it('says where to delete sessions and closes with Escape', () => {
    const onClose = vi.fn();
    render(<ChatSessions agent="agy" onClose={onClose} />);
    expect(screen.getByTestId('chat-sessions-hint').textContent).toContain('KumiCraft');
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalled();
  });
});

describe('chat store sessions [K9.5]', () => {
  beforeEach(() => {
    useChatStore.getState().reset();
  });

  it('a finished new turn makes its conversation the shown session; other sessions stay out', () => {
    const store = useChatStore.getState();
    store.startLocal('fresh', 'job0001');
    useChatStore.getState().applyAgentEvent('fresh00000', { kind: 'message', text: 'hi' });
    const fresh = turn('fresh', 40, { conversation: 'conv-new' });
    useChatStore.getState().loadHistory([fresh, ...TURNS]);
    const state = useChatStore.getState();
    expect(state.sessionId).toBe('conv-new');
    expect(state.turns.map((t) => t.turnId)).toEqual([fresh.id]);
  });

  it('new conversation empties the chat', () => {
    useChatStore.getState().showSession(turnsOfSession(TURNS, 'conv-a'), 'conv-a');
    useChatStore.getState().newConversation();
    const state = useChatStore.getState();
    expect(state.turns).toEqual([]);
    expect(state.sessionId).toBeUndefined();
    expect(state.hasConversation).toBe(false);
  });
});
