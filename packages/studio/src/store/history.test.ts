import type { DesignOperation } from '@reactcraft/model';
import { describe, expect, it } from 'vitest';

import { coalesceKeyOf, type HistoryEntry, MAX_HISTORY, pushEntry } from './history.ts';
import { setText } from './test-support.ts';

const padding = (top: number, breakpoint?: 'md'): DesignOperation => ({
  op: 'setStyle',
  target: { kind: 'page', pageId: 'p_home000001' },
  nodeId: 'n_card000001',
  scope: breakpoint === undefined ? {} : { breakpoint },
  set: { padding: { top: { px: top } } },
});

const entry = (at: number, ops: readonly DesignOperation[], id = String(at)): HistoryEntry => {
  const key = coalesceKeyOf(ops);
  return {
    id,
    label: 'Change',
    source: 'user',
    forward: ops,
    inverse: [],
    at,
    ...(key === undefined ? {} : { coalesceKey: key }),
  };
};

describe('coalesceKeyOf', () => {
  it('names the node, breakpoint, state and properties of a single change', () => {
    expect(coalesceKeyOf([padding(4)])).toBe('setStyle:n_card000001:base::padding');
    expect(coalesceKeyOf([padding(4, 'md')])).toBe('setStyle:n_card000001:md::padding');
    expect(coalesceKeyOf([setText('x')])).toBe('setContent:n_text000001:text');
  });

  it('never merges batches of several operations or other kinds', () => {
    expect(coalesceKeyOf([padding(4), padding(8)])).toBeUndefined();
    expect(
      coalesceKeyOf([
        { op: 'remove', target: { kind: 'page', pageId: 'p_x0000000001' }, nodeId: 'n_card000001' },
      ]),
    ).toBeUndefined();
  });
});

describe('pushEntry', () => {
  it('merges the same change within 500 ms, keeping the first inverse', () => {
    const first = { ...entry(0, [padding(4)]), inverse: [padding(0)] };
    const merged = pushEntry([first], entry(400, [padding(8)]));

    expect(merged).toHaveLength(1);
    expect(merged[0]).toMatchObject({ forward: [padding(8)], inverse: [padding(0)], at: 400 });
  });

  it('keeps separate entries when too slow, for another breakpoint, or from AI', () => {
    const first = entry(0, [padding(4)]);

    expect(pushEntry([first], entry(600, [padding(8)]))).toHaveLength(2);
    expect(pushEntry([first], entry(100, [padding(8, 'md')]))).toHaveLength(2);
    expect(pushEntry([first], { ...entry(100, [padding(8)]), source: 'ai' })).toHaveLength(2);
  });

  it('keeps at most 200 entries, dropping the oldest [V-55]', () => {
    let stack: HistoryEntry[] = [];
    for (let i = 0; i < MAX_HISTORY + 5; i++)
      stack = pushEntry(stack, entry(i * 1000, [setText(String(i))], `e${String(i)}`));

    expect(stack).toHaveLength(MAX_HISTORY);
    expect(stack[0]?.id).toBe('e5');
  });
});
