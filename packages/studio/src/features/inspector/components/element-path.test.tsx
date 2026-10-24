// Unit tests for ElementPath breadcrumb (SPEC-04 R-SL-14, WP-2.12c).
import type { ElementRef, TreeNode } from '@kumicraft/shared';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { initI18n } from '../../../i18n/i18n.ts';
import { studioBridgeChannel } from '../../selection/bridge-channel.ts';
import { useSelectionStore } from '../../selection/selection-store.ts';
import { buildElementPath, collapsePath, ElementPath } from './element-path.tsx';

function makeNode(tag: string, loc: string, index = 0, parent?: number, label?: string): TreeNode {
  return {
    ref: { loc, index },
    tag,
    instances: 1,
    ...(parent !== undefined ? { parent } : {}),
    ...(label !== undefined ? { label } : {}),
  };
}

describe('ElementPath [R-SL-14]', () => {
  beforeAll(async () => {
    await initI18n();
  });

  beforeEach(() => {
    useSelectionStore.getState().reset();
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('Scenario 11: buildElementPath builds root-to-element path, returns empty if not found, and handles cyclic parent without hanging [R-SL-14]', () => {
    const nodes: TreeNode[] = [
      makeNode('main', 'src/App.tsx:1:1', 0, undefined),
      makeNode('section', 'src/App.tsx:2:1', 0, 0),
      makeNode('div', 'src/App.tsx:3:1', 0, 1),
      makeNode('article', 'src/App.tsx:4:1', 0, 2),
    ];

    const path = buildElementPath(nodes, { loc: 'src/App.tsx:4:1', index: 0 });
    expect(path).toHaveLength(4);
    expect(path[0]?.tag).toBe('main');
    expect(path[1]?.tag).toBe('section');
    expect(path[2]?.tag).toBe('div');
    expect(path[3]?.tag).toBe('article');

    const notFound = buildElementPath(nodes, { loc: 'src/Missing.tsx:1:1', index: 0 });
    expect(notFound).toEqual([]);

    const cyclicNodes: TreeNode[] = [
      makeNode('div', 'src/A.tsx:1:1', 0, 1),
      makeNode('div', 'src/A.tsx:2:1', 0, 0),
    ];
    const cyclicPath = buildElementPath(cyclicNodes, { loc: 'src/A.tsx:1:1', index: 0 });
    expect(cyclicPath.length).toBeLessThanOrEqual(cyclicNodes.length);
  });

  it('Scenario 12: collapsePath keeps <= 6 nodes as-is, collapses 8 nodes to first, more, and last 4 [R-SL-14]', () => {
    const sixNodes = Array.from({ length: 6 }, (_, i) =>
      makeNode(`div${String(i)}`, `src/App.tsx:${String(i + 1)}:1`, 0, i > 0 ? i - 1 : undefined),
    );
    const sixSlots = collapsePath(sixNodes);
    expect(sixSlots).toHaveLength(6);
    expect(sixSlots.every((s) => s.kind === 'node')).toBe(true);

    const eightNodes = Array.from({ length: 8 }, (_, i) =>
      makeNode(`tag${String(i)}`, `src/App.tsx:${String(i + 1)}:1`, 0, i > 0 ? i - 1 : undefined),
    );
    const eightSlots = collapsePath(eightNodes);
    expect(eightSlots).toHaveLength(6);
    expect(eightSlots[0]?.kind).toBe('node');
    if (eightSlots[0]?.kind === 'node') {
      expect(eightSlots[0].node.tag).toBe('tag0');
    }
    expect(eightSlots[1]?.kind).toBe('more');
    const lastFour = eightSlots.slice(2);
    expect(lastFour).toHaveLength(4);
    if (lastFour[0]?.kind === 'node') {
      expect(lastFour[0].node.tag).toBe('tag4');
    }
    if (lastFour[3]?.kind === 'node') {
      expect(lastFour[3].node.tag).toBe('tag7');
    }
  });

  it('Scenario 13: clicking ancestor in ElementPath selects that node and calls studioBridgeChannel.select with true [R-SL-14]', () => {
    const nodes: TreeNode[] = [
      makeNode('main', 'src/App.tsx:1:1', 0, undefined),
      makeNode('section', 'src/App.tsx:2:1', 0, 0),
      makeNode('div', 'src/App.tsx:3:1', 0, 1),
      makeNode('article', 'src/App.tsx:4:1', 0, 2),
    ];
    useSelectionStore.getState().setTree(nodes);
    useSelectionStore.getState().setSelectedRefs([{ loc: 'src/App.tsx:4:1', index: 0 }]);

    const selectSpy = vi.spyOn(studioBridgeChannel, 'select').mockImplementation(() => {});

    render(<ElementPath />);

    const sectionBtn = screen
      .getAllByTestId('element-path-item')
      .find((el) => el.getAttribute('data-loc') === 'src/App.tsx:2:1');
    expect(sectionBtn).toBeDefined();

    if (sectionBtn !== undefined) {
      fireEvent.click(sectionBtn);
    }

    const targetRef: ElementRef = { loc: 'src/App.tsx:2:1', index: 0 };
    expect(useSelectionStore.getState().selectedRefs).toEqual([targetRef]);
    expect(selectSpy).toHaveBeenCalledWith([targetRef], true);
  });

  it('Scenario 14: clicking more button expands all 7 ancestors and changing selected ref resets to collapsed [R-SL-14]', () => {
    const eightNodes = Array.from({ length: 8 }, (_, i) =>
      makeNode(`lvl${String(i)}`, `src/App.tsx:${String(i + 1)}:1`, 0, i > 0 ? i - 1 : undefined),
    );
    useSelectionStore.getState().setTree(eightNodes);
    useSelectionStore.getState().setSelectedRefs([{ loc: 'src/App.tsx:8:1', index: 0 }]);

    const { rerender } = render(<ElementPath />);

    const moreBtn = screen.getByTestId('element-path-more');
    expect(moreBtn).toBeDefined();

    fireEvent.click(moreBtn);

    const ancestorButtons = screen.getAllByTestId('element-path-item');
    expect(ancestorButtons).toHaveLength(7);
    expect(screen.queryByTestId('element-path-more')).toBeFalsy();

    useSelectionStore.getState().setSelectedRefs([{ loc: 'src/App.tsx:7:1', index: 0 }]);
    rerender(<ElementPath />);

    expect(screen.getByTestId('element-path-more')).toBeTruthy();
  });

  it('Scenario 15: renders nothing when multiple elements selected; renders element-path and hint when single element in tree is selected [R-SL-14]', () => {
    const nodes: TreeNode[] = [
      makeNode('main', 'src/App.tsx:1:1', 0, undefined),
      makeNode('section', 'src/App.tsx:2:1', 0, 0),
    ];
    useSelectionStore.getState().setTree(nodes);

    useSelectionStore.getState().setSelectedRefs([
      { loc: 'src/App.tsx:1:1', index: 0 },
      { loc: 'src/App.tsx:2:1', index: 0 },
    ]);

    const { rerender } = render(<ElementPath />);
    expect(screen.queryByTestId('element-path')).toBeFalsy();

    useSelectionStore.getState().setSelectedRefs([{ loc: 'src/App.tsx:2:1', index: 0 }]);
    rerender(<ElementPath />);

    expect(screen.queryByTestId('element-path')).toBeTruthy();
    expect(screen.queryByTestId('element-path-hint')).toBeTruthy();
  });
});
