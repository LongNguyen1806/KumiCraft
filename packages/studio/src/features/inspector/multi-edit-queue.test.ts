// Multi-element Inspector queue: changes made while a batch is saving (SPEC-04 R-CB-15).
import {
  type BatchEditRequest,
  BREAKPOINT_WIDTHS,
  type ClassContext,
  type ElementSource,
} from '@kumicraft/shared';
import { describe, expect, it, vi } from 'vitest';

import { MultiEditQueue } from './multi-edit-queue.ts';
import type { MultiTargetItem } from './types.ts';
import { DEFAULT_THEME } from './use-project-theme.ts';

const ctx: ClassContext = {
  theme: DEFAULT_THEME,
  mode: 'desktop-first',
  breakpoints: BREAKPOINT_WIDTHS,
};
const scope = { breakpoint: 'base' as const, state: undefined };

function item(loc: string, className: string): MultiTargetItem {
  const source: ElementSource = {
    loc,
    tag: 'div',
    fileHash: 'a'.repeat(64),
    className: { kind: 'static', value: className },
    text: { kind: 'none' },
    attributes: {},
    inLoop: false,
  };
  return { ref: { loc, index: 0 }, source };
}

describe('MultiEditQueue [R-CB-15]', () => {
  it('builds the next batch on the classes the previous one saved, keeping both changes', async () => {
    vi.useFakeTimers();
    const sent: BatchEditRequest[] = [];
    let release: () => void = () => {};
    const send = vi.fn((req: BatchEditRequest) => {
      sent.push(req);
      return sent.length === 1
        ? new Promise<void>((resolve) => {
            release = resolve;
          })
        : Promise.resolve();
    });
    const items = [item('src/A.tsx:1:1', 'p-2'), item('src/A.tsx:2:1', 'p-4')];
    const queue = new MultiEditQueue(150);
    queue.setDeps({ getItems: () => items, ctx: () => ctx, send });

    queue.schedule({
      property: 'padding',
      value: { kind: 'scale', token: '6' },
      scope,
      writePrefix: '',
    });
    await vi.advanceTimersByTimeAsync(150);
    // While the first batch is saving, the sources (items) are still the old ones.
    queue.schedule({
      property: 'backgroundColor',
      value: { kind: 'theme', name: 'white' },
      scope,
      writePrefix: '',
    });
    await vi.advanceTimersByTimeAsync(150);
    expect(sent).toHaveLength(1);
    release();
    await vi.runAllTimersAsync();

    expect(sent).toHaveLength(2);
    const second = sent[1]?.edits ?? [];
    expect(second.map((e) => e.before)).toEqual(sent[0]?.edits.map((e) => e.after));
    for (const e of second) {
      expect(e.after).toContain('p-6');
      expect(e.after).toContain('bg-white');
    }
    vi.useRealTimers();
  });
});
