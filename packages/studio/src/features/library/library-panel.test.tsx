// @vitest-environment happy-dom
import { LIBRARY_BLOCKS } from '@kumicraft/shared';
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

  it('Scenario 14: determineInsertTarget targets child end for container tags and sibling after for non-containers [R-LB-14]', async () => {
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

  it('Scenario 15: LibraryPanel keeps blocks draggable, locks + and shows hint when no selection; + inserts when selected, then selects the new element [R-LB-14, R-LB-15]', async () => {
    const spy = vi.spyOn(sourceClient, 'applyStructureEdit').mockResolvedValue({
      changed: true,
      files: ['src/Home.tsx'],
      locs: ['src/Home.tsx:25:5'],
    });

    // 1. Render when nothing is selected: the block stays draggable, its + button is locked
    const { rerender } = render(<LibraryPanel />);

    expect(screen.getByTestId('library-hint')).toBeDefined();
    const buttonBlock = screen.getByTestId('library-block-form.button');
    const addButton = screen.getByTestId<HTMLButtonElement>('library-add-form.button');
    expect(buttonBlock.getAttribute('draggable')).toBe('true');
    expect(addButton.disabled).toBe(true);
    fireEvent.click(addButton);
    expect(spy).not.toHaveBeenCalled();

    // 2. Select an element on Canvas
    useSelectionStore.getState().setSelectedRefs([{ loc: 'src/Home.tsx:10:1', index: 0 }]);
    useStructureErrorStore.getState().setActiveSource({ loc: 'src/Home.tsx:10:1', tag: 'div' });
    rerender(<LibraryPanel />);

    expect(screen.queryByTestId('library-hint')).toBeNull();
    expect(addButton.disabled).toBe(false);

    // 3. A click on the block itself inserts nothing (owner, 2026-10-23); its + button does
    fireEvent.click(buttonBlock);
    expect(spy).not.toHaveBeenCalled();
    fireEvent.click(addButton);

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
