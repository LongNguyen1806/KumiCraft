// Chat store: a turn that ends before `startTurn` returns its job id (R-CH-03).
import { beforeEach, describe, expect, it } from 'vitest';

import { useChatStore } from './chat-store.ts';

describe('chat store [R-CH-03]', () => {
  beforeEach(() => {
    useChatStore.getState().reset();
  });

  it('applies an outcome that arrived before the job id was known [R-CH-03]', () => {
    const store = useChatStore.getState();
    store.startLocal('Make it blue');
    store.finishJobFailed('job0009', { code: 'E016', params: { reason: 'projectTooLarge' } });

    useChatStore.getState().setRunningJobId('job0009');

    const [turn] = useChatStore.getState().turns;
    expect(turn?.state).toBe('failed');
    expect(turn?.error).toEqual({ code: 'E016', params: { reason: 'projectTooLarge' } });
    expect(useChatStore.getState().earlyOutcomes).toEqual({});
  });

  it('applies an outcome to the turn that already has the job id [R-CH-03]', () => {
    const store = useChatStore.getState();
    store.startLocal('Add a button');
    store.setRunningJobId('job0010');
    useChatStore.getState().finishJobCompleted('job0010', {
      id: 'turn000001',
      agent: 'agy',
      startedAt: '2026-10-22T00:00:00.000Z',
      prompt: 'Add a button',
      state: 'completed',
      files: [
        { path: 'src/App.tsx', change: 'modified' },
        { path: 'src/Button.tsx', change: 'created' },
      ],
      revertible: true,
      notices: [],
    });

    const [turn] = useChatStore.getState().turns;
    expect(turn?.state).toBe('completed');
    expect(turn?.summary?.files.length).toBe(2);
  });
});
