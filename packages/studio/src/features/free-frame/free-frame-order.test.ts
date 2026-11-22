// Unit tests for layer order in free frame (SPEC-04 section 18E, R-FF-16, WP-2.12b).
import type { ElementRef, TreeNode } from '@kumicraft/shared';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import * as sourceClient from '../../api/source-client.ts';
import { useSelectionStore } from '../../core/selection-store.ts';
import { layerOrderTarget, runLayerOrder } from './layer-order.ts';

const FRAME = 'src/pages/Home.tsx:1:1';
const CHILD_A: ElementRef = { loc: 'src/pages/Home.tsx:2:1', index: 0 };
const CHILD_B: ElementRef = { loc: 'src/pages/Home.tsx:3:1', index: 0 };
const CHILD_C: ElementRef = { loc: 'src/pages/Home.tsx:4:1', index: 0 };

describe('Free frame layer order [R-FF-16]', () => {
  const treeNodes: TreeNode[] = [
    { ref: { loc: FRAME, index: 0 }, tag: 'div', instances: 1 },
    { ref: CHILD_A, tag: 'div', parent: 0, instances: 1 },
    { ref: CHILD_B, tag: 'div', parent: 0, instances: 1 },
    { ref: CHILD_C, tag: 'div', parent: 0, instances: 1 },
  ];

  beforeEach(() => {
    useSelectionStore.getState().reset();
    useSelectionStore.getState().setTree(treeNodes, false);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('Scenario 5: layerOrderTarget with 3 children A, B, C [R-FF-16]', () => {
    const frontA = layerOrderTarget('front', CHILD_A, 'div', treeNodes);
    expect(frontA).toEqual({
      kind: 'child',
      parent: { loc: FRAME, tag: 'div' },
      where: 'end',
    });

    const forwardA = layerOrderTarget('forward', CHILD_A, 'div', treeNodes);
    expect(forwardA).toEqual({
      kind: 'sibling',
      ref: { loc: CHILD_B.loc, tag: 'div' },
      where: 'after',
    });

    const backwardC = layerOrderTarget('backward', CHILD_C, 'div', treeNodes);
    expect(backwardC).toEqual({
      kind: 'sibling',
      ref: { loc: CHILD_B.loc, tag: 'div' },
      where: 'before',
    });

    const backC = layerOrderTarget('back', CHILD_C, 'div', treeNodes);
    expect(backC).toEqual({
      kind: 'child',
      parent: { loc: FRAME, tag: 'div' },
      where: 'start',
    });

    const frontC = layerOrderTarget('front', CHILD_C, 'div', treeNodes);
    expect(frontC).toBeUndefined();

    const backA = layerOrderTarget('back', CHILD_A, 'div', treeNodes);
    expect(backA).toBeUndefined();
  });

  it('Scenario 6: runLayerOrder front calls applyStructureEdit move without placement [R-FF-16]', async () => {
    useSelectionStore.getState().setSelectedRefs([CHILD_A]);
    const editSpy = vi.spyOn(sourceClient, 'applyStructureEdit').mockResolvedValue({
      changed: true,
      files: ['src/App.tsx'],
      locs: [CHILD_A.loc],
      warnings: [],
    });

    const ok = await runLayerOrder('front', CHILD_A, 'div');
    expect(ok).toBe(true);
    expect(editSpy).toHaveBeenCalledTimes(1);

    const callArg = editSpy.mock.calls[0]?.[0];
    expect(callArg).toEqual({
      kind: 'move',
      elements: [{ loc: CHILD_A.loc, tag: 'div' }],
      target: {
        kind: 'child',
        parent: { loc: FRAME, tag: 'div' },
        where: 'end',
      },
    });
    expect((callArg as Record<string, unknown>).placement).toBeUndefined();
  });
});
