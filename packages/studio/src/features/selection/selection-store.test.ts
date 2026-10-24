// Unit tests for the selection store (R-SL-05, R-SL-10).
import type { ElementRef, TreeNode } from '@kumicraft/shared';
import { beforeEach, describe, expect, it } from 'vitest';

import { useSelectionStore } from './selection-store.ts';

const a: ElementRef = { loc: 'src/App.tsx:3:5', index: 0 };
const b: ElementRef = { loc: 'src/App.tsx:7:5', index: 0 };
const c: ElementRef = { loc: 'src/App.tsx:9:5', index: 1 };

const node = (ref: ElementRef): TreeNode => ({ ref, tag: 'div', instances: 1 });

describe('selection store', () => {
  beforeEach(() => {
    useSelectionStore.getState().reset();
  });

  it('keeps the selection in order, the last one being the primary [R-SL-05]', () => {
    useSelectionStore.getState().setSelectedRefs([a, b]);

    const refs = useSelectionStore.getState().selectedRefs;
    expect(refs).toEqual([a, b]);
    expect(refs.at(-1)).toEqual(b);
  });

  it('drops refs missing from a new tree, the last one left becomes primary [R-SL-10]', () => {
    useSelectionStore.getState().setSelectedRefs([a, b, c]);

    useSelectionStore.getState().setTree([node(a), node(b)]);

    expect(useSelectionStore.getState().selectedRefs).toEqual([a, b]);

    useSelectionStore.getState().setTree([node(a), node(c)]);

    expect(useSelectionStore.getState().selectedRefs).toEqual([a]);
  });

  it('keeps the selection when the tree is truncated [R-SL-10, V-113]', () => {
    useSelectionStore.getState().setSelectedRefs([a, b]);

    useSelectionStore.getState().setTree([node(a)], true);

    expect(useSelectionStore.getState().selectedRefs).toEqual([a, b]);
    expect(useSelectionStore.getState().treeTruncated).toBe(true);
  });
});
