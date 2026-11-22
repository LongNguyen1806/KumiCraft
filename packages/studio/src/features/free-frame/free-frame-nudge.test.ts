// Unit tests for keyboard nudge in free frame (SPEC-04 section 18E, R-FF-15, WP-2.12b).
import type { ElementSource } from '@kumicraft/shared';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import * as sourceClient from '../../api/source-client.ts';
import { writtenClass } from '../../api/written-class-test-support.ts';
import { useCanvasViewStore } from '../../core/canvas-view-store.ts';
import { useSelectionStore } from '../../core/selection-store.ts';
import { nudgeDelta, nudgeSelection } from './free-nudge.ts';

const FRAME = 'src/pages/Home.tsx:1:1';
const CHILD_A = 'src/pages/Home.tsx:2:1';
const CHILD_B = 'src/pages/Home.tsx:3:1';

function mockSource(loc: string, className: string, free = false): ElementSource {
  return {
    loc,
    tag: 'div',
    fileHash: '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
    className: { kind: 'static', value: className },
    text: { kind: 'none' },
    attributes: {},
    inLoop: false,
    free,
  };
}

describe('Free frame nudge [R-FF-15]', () => {
  beforeEach(() => {
    useSelectionStore.getState().reset();
    useCanvasViewStore.getState().setTailwindMajor(4);
    useCanvasViewStore.getState().setGrid(8);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('Scenario 2: nudgeDelta calculates grid and fine deltas [R-FF-15]', () => {
    expect(nudgeDelta('nudgeRight', 8)).toEqual({ dx: 8, dy: 0 });
    expect(nudgeDelta('nudgeUpFine', 8)).toEqual({ dx: 0, dy: -1 });
    expect(nudgeDelta('undo', 8)).toBeUndefined();
  });

  it('Scenario 3: nudgeSelection with 2 elements in frame sends single batch edit [R-FF-15]', async () => {
    useSelectionStore.getState().setTree(
      [
        { ref: { loc: FRAME, index: 0 }, tag: 'div', instances: 1 },
        { ref: { loc: CHILD_A, index: 0 }, tag: 'div', parent: 0, instances: 1 },
        { ref: { loc: CHILD_B, index: 0 }, tag: 'div', parent: 0, instances: 1 },
      ],
      false,
    );
    useSelectionStore.getState().setSelectedRefs([
      { loc: CHILD_A, index: 0 },
      { loc: CHILD_B, index: 0 },
    ]);

    vi.spyOn(sourceClient, 'fetchElementSourceByLoc').mockImplementation((loc) => {
      if (loc === FRAME) return Promise.resolve(mockSource(FRAME, 'relative', true));
      if (loc === CHILD_A) {
        return Promise.resolve(mockSource(CHILD_A, 'absolute left-4 top-2 w-40'));
      }
      return Promise.resolve(mockSource(CHILD_B, 'p-2 absolute left-[10px] top-0'));
    });

    const batchSpy = vi
      .spyOn(sourceClient, 'editSourceBatch')
      .mockResolvedValue({ changed: true, files: ['src/App.tsx'] });

    const ok = await nudgeSelection(8, 0);
    expect(ok).toBe(true);
    expect(batchSpy).toHaveBeenCalledTimes(1);

    const callArg = batchSpy.mock.calls[0]?.[0];
    expect(callArg?.edits).toHaveLength(2);
    expect(writtenClass(callArg?.edits[0])).toBe('w-40 absolute left-6 top-2');
    expect(writtenClass(callArg?.edits[1])).toBe('p-2 absolute left-[18px] top-0');
    expect(callArg?.coalesceKey?.startsWith('nudge:')).toBe(true);
  });

  it('Scenario 4: clamps position at 0 and returns false for elements outside free frame [R-FF-15]', async () => {
    useSelectionStore.getState().setTree(
      [
        { ref: { loc: FRAME, index: 0 }, tag: 'div', instances: 1 },
        { ref: { loc: CHILD_A, index: 0 }, tag: 'div', parent: 0, instances: 1 },
      ],
      false,
    );
    useSelectionStore.getState().setSelectedRefs([{ loc: CHILD_A, index: 0 }]);

    vi.spyOn(sourceClient, 'fetchElementSourceByLoc').mockImplementation((loc) => {
      if (loc === FRAME) return Promise.resolve(mockSource(FRAME, 'relative', true));
      return Promise.resolve(mockSource(CHILD_A, 'absolute left-1 top-0'));
    });

    const batchSpy = vi
      .spyOn(sourceClient, 'editSourceBatch')
      .mockResolvedValue({ changed: true, files: ['src/App.tsx'] });

    // 4 px - 8 px = -4 px clamped to 0 -> left-0
    const ok = await nudgeSelection(-8, 0);
    expect(ok).toBe(true);
    expect(batchSpy).toHaveBeenCalledTimes(1);
    expect(writtenClass(batchSpy.mock.calls[0]?.[0].edits[0])).toBe('absolute left-0 top-0');

    // Outside free frame
    vi.spyOn(sourceClient, 'fetchElementSourceByLoc').mockImplementation((loc) =>
      Promise.resolve(mockSource(loc, 'p-4', false)),
    );
    batchSpy.mockClear();

    const outsideOk = await nudgeSelection(8, 0);
    expect(outsideOk).toBe(false);
    expect(batchSpy).not.toHaveBeenCalled();
  });
});
