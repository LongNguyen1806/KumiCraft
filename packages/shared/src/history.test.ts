import { describe, expect, it } from 'vitest';

import { HistoryLabelSchema, HistoryStateSchema, HistoryStepSchema } from './history.ts';

describe('history schemas', () => {
  it('validates HistoryLabelSchema', () => {
    expect(
      HistoryLabelSchema.safeParse({
        key: 'history:setClassName',
        params: { tag: 'button' },
      }).success,
    ).toBe(true);

    expect(
      HistoryLabelSchema.safeParse({
        key: 'history:setText',
      }).success,
    ).toBe(true);

    expect(HistoryLabelSchema.safeParse({ key: '' }).success).toBe(false);
  });

  it('validates HistoryStateSchema', () => {
    const valid = {
      undo: { key: 'history:setClassName', params: { tag: 'div' } },
      undoCount: 1,
      redoCount: 0,
    };
    expect(HistoryStateSchema.safeParse(valid).success).toBe(true);

    const empty = {
      undoCount: 0,
      redoCount: 0,
    };
    expect(HistoryStateSchema.safeParse(empty).success).toBe(true);
  });

  it('validates HistoryStepSchema', () => {
    const step = {
      state: {
        undo: { key: 'history:setText', params: { tag: 'h1' } },
        undoCount: 2,
        redoCount: 1,
      },
      files: ['src/App.tsx', 'src/components/Header.tsx'],
    };
    expect(HistoryStepSchema.safeParse(step).success).toBe(true);

    // Invalid file path in files array
    const invalid = {
      state: { undoCount: 0, redoCount: 0 },
      files: ['/absolute/path.tsx'],
    };
    expect(HistoryStepSchema.safeParse(invalid).success).toBe(false);
  });
});
