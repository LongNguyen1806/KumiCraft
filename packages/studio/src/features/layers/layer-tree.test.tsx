import type { TreeNode } from '@reactcraft/shared';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useSelectionStore } from '../selection/selection-store.ts';
import { LayerTree } from './layer-tree.tsx';

describe('LayerTree', () => {
  const sampleNodes: TreeNode[] = [
    {
      ref: { loc: 'src/App.tsx:5:3', index: 0 },
      tag: 'div',
      label: 'container',
      instances: 1,
    },
    {
      ref: { loc: 'src/components/Header.tsx:2:3', index: 0 },
      parent: 0,
      tag: 'header',
      instances: 1,
    },
    {
      ref: { loc: 'src/components/Header.tsx:4:5', index: 0 },
      parent: 1,
      tag: 'h1',
      label: 'Page Title',
      instances: 1,
    },
    {
      ref: { loc: 'src/components/Card.tsx:10:3', index: 0 },
      parent: 0,
      tag: 'article',
      instances: 3,
    },
  ];

  beforeEach(() => {
    act(() => {
      useSelectionStore.getState().reset();
    });
  });

  afterEach(() => {
    cleanup();
  });

  it('renders empty hint when tree is empty', () => {
    render(<LayerTree />);
    expect(screen.getByText('editor.layersHint')).toBeDefined();
  });

  it('renders nodes with tag, label, instances badge, and component badge [R-SL-08]', () => {
    act(() => {
      useSelectionStore.getState().setTree(sampleNodes);
    });

    render(<LayerTree />);

    // Tags
    expect(screen.getByText('div')).toBeDefined();
    expect(screen.getByText('header')).toBeDefined();
    expect(screen.getByText('h1')).toBeDefined();
    expect(screen.getByText('article')).toBeDefined();

    // Labels
    expect(screen.getByText('container')).toBeDefined();
    expect(screen.getByText('Page Title')).toBeDefined();

    // Instances badge for instances > 1 (article has instances: 3)
    const instancesBadge = screen.getByTestId('instances-badge');
    expect(instancesBadge.textContent).toBe('×3');

    // Component badges: Header has different file than App.tsx -> Header
    const componentBadges = screen.getAllByTestId('component-badge');
    expect(componentBadges.some((b) => b.textContent === 'Header')).toBe(true);
    expect(componentBadges.some((b) => b.textContent === 'Card')).toBe(true);
  });

  it('collapses and expands child nodes [R-SL-07]', () => {
    act(() => {
      useSelectionStore.getState().setTree(sampleNodes);
    });

    render(<LayerTree />);

    expect(screen.getByText('h1')).toBeDefined();

    // Collapse Header node (second Collapse button)
    const collapseBtns = screen.getAllByRole('button', { name: /collapse/i });
    const headerCollapseBtn = collapseBtns[1];
    expect(headerCollapseBtn).toBeDefined();

    if (headerCollapseBtn) {
      fireEvent.click(headerCollapseBtn);
    }

    // h1 should now be hidden (collapsed under header)
    expect(screen.queryByText('h1')).toBeNull();
  });

  it('notifies onSelect and onHover with 2-way sync [R-SL-09]', () => {
    const handleSelect = vi.fn();
    const handleHover = vi.fn();

    act(() => {
      useSelectionStore.getState().setTree(sampleNodes);
    });

    render(<LayerTree onSelect={handleSelect} onHover={handleHover} />);

    const h1Item = screen.getByText('h1').closest('[role="treeitem"]');
    expect(h1Item).toBeDefined();
    if (h1Item) {
      fireEvent.click(h1Item);
    }

    expect(handleSelect).toHaveBeenCalledWith(
      { loc: 'src/components/Header.tsx:4:5', index: 0 },
      true,
    );
    expect(useSelectionStore.getState().selectedRefs).toEqual([
      { loc: 'src/components/Header.tsx:4:5', index: 0 },
    ]);

    if (h1Item) {
      fireEvent.mouseEnter(h1Item);
    }
    expect(handleHover).toHaveBeenCalledWith({ loc: 'src/components/Header.tsx:4:5', index: 0 });

    if (h1Item) {
      fireEvent.mouseLeave(h1Item);
    }
    expect(handleHover).toHaveBeenCalledWith(undefined);
  });

  it('handles Escape key to select parent node [R-SL-04]', () => {
    const handleSelect = vi.fn();
    const h1Node = sampleNodes[2];

    act(() => {
      useSelectionStore.getState().setTree(sampleNodes);
      if (h1Node) {
        useSelectionStore.getState().setSelectedRefs([h1Node.ref]);
      }
    });

    render(<LayerTree onSelect={handleSelect} />);

    fireEvent.keyDown(window, { key: 'Escape' });

    // Header ref should be selected
    expect(handleSelect).toHaveBeenCalledWith(
      { loc: 'src/components/Header.tsx:2:3', index: 0 },
      true,
    );
    expect(useSelectionStore.getState().selectedRefs).toEqual([
      { loc: 'src/components/Header.tsx:2:3', index: 0 },
    ]);
  });
});
