import { describe, expect, it } from 'vitest';

import { AgentEventSchema, StartTurnRequestSchema, TurnSummarySchema } from './agent.ts';

describe('agent schemas [WP-3.02 #1]', () => {
  it('valid sample for each schema passes validation', () => {
    const validEvent = AgentEventSchema.parse({
      kind: 'message',
      text: 'Hello from agent',
    });
    expect(validEvent.kind).toBe('message');

    const validSummary = TurnSummarySchema.parse({
      id: 'turn_01234',
      agent: 'agy',
      startedAt: '2026-10-21T00:00:00.000Z',
      prompt: 'Make the header sticky',
      state: 'completed',
      files: [{ path: 'src/Header.tsx', change: 'modified' }],
      revertible: true,
      notices: [{ code: 'backendSkipped', backendId: 'b_01234567', label: 'Django API' }],
    });
    expect(validSummary.agent).toBe('agy');

    const validRequest = StartTurnRequestSchema.parse({
      prompt: 'Add login button',
      context: { route: '/login' },
      conversation: 'new',
      docs: ['docs/architecture.md'],
    });
    expect(validRequest.prompt).toBe('Add login button');
  });

  it('rejects empty or whitespace-only prompt in StartTurnRequest', () => {
    expect(() =>
      StartTurnRequestSchema.parse({
        prompt: '   ',
        context: {},
        conversation: 'new',
        docs: [],
      }),
    ).toThrow();
  });

  it('rejects docs with 11 items (> 10 limit)', () => {
    const elevenDocs = Array.from({ length: 11 }, (_, i) => `doc${String(i)}.md`);
    expect(() =>
      StartTurnRequestSchema.parse({
        prompt: 'Valid prompt',
        context: {},
        conversation: 'new',
        docs: elevenDocs,
      }),
    ).toThrow();
  });

  it('rejects unknown event kind in AgentEventSchema', () => {
    expect(() =>
      AgentEventSchema.parse({
        kind: 'unknown_kind',
        payload: 123,
      }),
    ).toThrow();
  });
});
