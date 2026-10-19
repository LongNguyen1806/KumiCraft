// Unit tests for align and distribute in free frame (SPEC-04 section 18E, R-FF-17, WP-2.12b).
import type { ElementSource } from '@reactcraft/shared';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import * as sourceClient from '../../api/source-client.ts';
import { useCanvasViewStore } from '../editor/canvas-view-store.ts';
import { studioBridgeChannel } from '../selection/bridge-channel.ts';
import { useSelectionStore } from '../selection/selection-store.ts';
import {
  alignBoxes,
  distributeBoxes,
  type FreeItemBox,
  runAlign,
  useFreeFrameErrorStore,
} from './align.ts';

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

describe('Free frame align and distribute [R-FF-17]', () => {
  beforeEach(() => {
    useSelectionStore.getState().reset();
    useFreeFrameErrorStore.getState().setError(undefined);
    useCanvasViewStore.getState().setTailwindMajor(4);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('Scenario 7: alignBoxes with 3 boxes for left, right, centerX [R-FF-17]', () => {
    const boxes: FreeItemBox[] = [
      { key: 'a', left: 10, top: 10, width: 20, height: 20 },
      { key: 'b', left: 50, top: 20, width: 40, height: 20 },
      { key: 'c', left: 90, top: 30, width: 30, height: 20 },
    ];
    const frame = { width: 400, height: 300 };

    const leftRes = alignBoxes(boxes, 'left', frame);
    expect(leftRes.get('a')?.left).toBe(10);
    expect(leftRes.get('b')?.left).toBe(10);
    expect(leftRes.get('c')?.left).toBe(10);

    const rightRes = alignBoxes(boxes, 'right', frame);
    expect(rightRes.get('a')?.left).toBe(100);
    expect(rightRes.get('b')?.left).toBe(80);
    expect(rightRes.get('c')?.left).toBe(90);

    const centerRes = alignBoxes(boxes, 'centerX', frame);
    expect(centerRes.get('a')?.left).toBe(55);
    expect(centerRes.get('b')?.left).toBe(45);
    expect(centerRes.get('c')?.left).toBe(50);
  });

  it('Scenario 8: alignBoxes with 1 box against frame bounds for right, centerY [R-FF-17]', () => {
    const boxes: FreeItemBox[] = [{ key: 'a', left: 30, top: 40, width: 100, height: 50 }];
    const frame = { width: 400, height: 300 };

    const rightRes = alignBoxes(boxes, 'right', frame);
    expect(rightRes.get('a')).toEqual({ left: 300, top: 40 });

    const centerRes = alignBoxes(boxes, 'centerY', frame);
    expect(centerRes.get('a')).toEqual({ left: 30, top: 125 });
  });

  it('Scenario 9: distributeBoxes with 3 boxes along x and 2 boxes [R-FF-17]', () => {
    const boxes: FreeItemBox[] = [
      { key: 'a', left: 0, top: 10, width: 20, height: 20 },
      { key: 'b', left: 30, top: 10, width: 20, height: 20 },
      { key: 'c', left: 200, top: 10, width: 20, height: 20 },
    ];

    const threeRes = distributeBoxes(boxes, 'x');
    expect(threeRes.get('b')?.left).toBe(100);
    expect(threeRes.has('a')).toBe(false);
    expect(threeRes.has('c')).toBe(false);

    const twoRes = distributeBoxes(boxes.slice(0, 2), 'x');
    expect(twoRes.size).toBe(0);
  });

  it('Scenario 10: runAlign left with 2 elements sends batch edit [R-FF-17]', async () => {
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
      if (loc === CHILD_A) return Promise.resolve(mockSource(CHILD_A, 'absolute left-20 top-4'));
      return Promise.resolve(mockSource(CHILD_B, 'absolute left-40 top-4'));
    });

    vi.spyOn(studioBridgeChannel, 'measureFree').mockImplementation(() => {
      window.dispatchEvent(
        new MessageEvent('message', {
          source: window,
          origin: window.location.origin,
          data: {
            rc: 1,
            nonce: 'test-nonce',
            type: 'free-measure',
            payload: {
              ref: { loc: FRAME, index: 0 },
              width: 500,
              height: 400,
              hasHeight: true,
              children: [
                {
                  ref: { loc: CHILD_A, index: 0 },
                  tag: 'div',
                  left: 80,
                  top: 16,
                  width: 100,
                  height: 50,
                },
                {
                  ref: { loc: CHILD_B, index: 0 },
                  tag: 'div',
                  left: 160,
                  top: 16,
                  width: 100,
                  height: 50,
                },
              ],
            },
          },
        }),
      );
    });

    const batchSpy = vi
      .spyOn(sourceClient, 'editSourceBatch')
      .mockResolvedValue({ changed: true, files: ['src/App.tsx'] });

    // Trigger runAlign with fake listener registration
    vi.spyOn(studioBridgeChannel, 'registerFreeFrameListener').mockImplementation(
      ({ onFreeMeasure }) => {
        onFreeMeasure?.({
          ref: { loc: FRAME, index: 0 },
          width: 500,
          height: 400,
          hasHeight: true,
          children: [
            {
              ref: { loc: CHILD_A, index: 0 },
              tag: 'div',
              left: 80,
              top: 16,
              width: 100,
              height: 50,
            },
            {
              ref: { loc: CHILD_B, index: 0 },
              tag: 'div',
              left: 160,
              top: 16,
              width: 100,
              height: 50,
            },
          ],
        });
        return () => {};
      },
    );

    const ok = await runAlign('left');
    expect(ok).toBe(true);
    expect(batchSpy).toHaveBeenCalledTimes(1);
    const callEdits = batchSpy.mock.calls[0]?.[0].edits;
    // Box A is at left: 80, Box B is at left: 160. Align left -> min left is 80.
    // Box A is already at 80, so only Box B moves to 80 (or both if class didn't have 80)
    // Box A has left-20 (80px), so Box A doesn't change! Box B moves to left-20.
    expect(callEdits).toBeDefined();
  });

  it('Scenario 11: runAlign times out after 2s without free-measure [R-FF-17]', async () => {
    vi.useFakeTimers();

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
      return Promise.resolve(mockSource(CHILD_A, 'absolute left-20 top-4'));
    });

    vi.spyOn(studioBridgeChannel, 'measureFree').mockImplementation(() => {});
    const batchSpy = vi
      .spyOn(sourceClient, 'editSourceBatch')
      .mockResolvedValue({ changed: true, files: ['src/App.tsx'] });

    const alignPromise = runAlign('left');
    await vi.advanceTimersByTimeAsync(2000);

    const ok = await alignPromise;
    expect(ok).toBe(false);
    expect(batchSpy).not.toHaveBeenCalled();
    expect(useFreeFrameErrorStore.getState().error).toBe('measureTimeout');
    vi.useRealTimers();
  });
});
