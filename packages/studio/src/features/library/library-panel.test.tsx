// @vitest-environment happy-dom
import { LIBRARY_BLOCKS } from '@reactcraft/shared';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import * as sourceClient from '../../api/source-client.ts';
import { initI18n } from '../../i18n/i18n.ts';
import { useSelectionStore } from '../selection/selection-store.ts';
import { useStructureErrorStore } from '../structure/structure-error-store.ts';
import { determineInsertTarget, insertBlock } from './insert-block.ts';
import { LibraryPanel } from './library-panel.tsx';

describe('Library Panel and Insertion (Scenarios #14, #15)', () => {
  beforeAll(async () => {
    await initI18n();
  });

  beforeEach(() => {
    useSelectionStore.getState().reset();
    useStructureErrorStore.getState().clearError();
    useStructureErrorStore.getState().setActiveSource(undefined);
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('Scenario 14: determineInsertTarget targets child end for container tags and sibling after for non-containers', async () => {
    // 1. Container: section -> child end
    const sectionTarget = determineInsertTarget({ loc: 'src/Home.tsx:10:1', index: 0 }, 'section');
    expect(sectionTarget).toEqual({
      kind: 'child',
      parent: { loc: 'src/Home.tsx:10:1', tag: 'section' },
      where: 'end',
    });

    // 2. Non-container: p -> sibling after
    const pTarget = determineInsertTarget({ loc: 'src/Home.tsx:15:3', index: 0 }, 'p');
    expect(pTarget).toEqual({
      kind: 'sibling',
      ref: { loc: 'src/Home.tsx:15:3', tag: 'p' },
      where: 'after',
    });

    // 3. No selection: insertBlock skips without calling API
    const spy = vi.spyOn(sourceClient, 'applyStructureEdit');
    useSelectionStore.getState().setSelectedRefs([]);
    const rowBlock = LIBRARY_BLOCKS[0];
    if (!rowBlock) throw new Error('Missing block');

    const res = await insertBlock(rowBlock, 'vi');
    expect(res.ok).toBe(false);
    expect(spy).not.toHaveBeenCalled();
  });

  it('Scenario 15: LibraryPanel disables blocks and shows hint when no selection; inserts and updates selection when selected', async () => {
    const spy = vi.spyOn(sourceClient, 'applyStructureEdit').mockResolvedValue({
      changed: true,
      files: ['src/Home.tsx'],
      locs: ['src/Home.tsx:25:5'],
    });

    // 1. Render when nothing is selected
    const { rerender } = render(<LibraryPanel />);

    expect(screen.getByTestId('library-hint')).toBeDefined();
    const buttonBlock = screen.getByTestId('library-block-form.button');
    expect(buttonBlock.hasAttribute('disabled')).toBe(true);

    // 2. Select an element on Canvas
    useSelectionStore.getState().setSelectedRefs([{ loc: 'src/Home.tsx:10:1', index: 0 }]);
    useStructureErrorStore.getState().setActiveSource({ loc: 'src/Home.tsx:10:1', tag: 'div' });
    rerender(<LibraryPanel />);

    expect(screen.queryByTestId('library-hint')).toBeNull();
    expect(buttonBlock.hasAttribute('disabled')).toBe(false);

    // 3. Click the block to insert
    fireEvent.click(buttonBlock);

    await waitFor(() => {
      expect(spy).toHaveBeenCalled();
    });

    const call = spy.mock.calls[0]?.[0];
    expect(call?.kind).toBe('insert');
    if (call?.kind === 'insert') {
      expect(call.target).toEqual({
        kind: 'child',
        parent: { loc: 'src/Home.tsx:10:1', tag: 'div' },
        where: 'end',
      });
      expect(call.jsx).toContain('<button');
    }

    expect(useSelectionStore.getState().selectedRefs).toEqual([
      { loc: 'src/Home.tsx:25:5', index: 0 },
    ]);
  });
});
