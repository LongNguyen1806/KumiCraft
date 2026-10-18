// @vitest-environment happy-dom
import { LIBRARY_BLOCKS } from '@reactcraft/shared';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { ApiError } from '../../api/http.ts';
import * as sourceClient from '../../api/source-client.ts';
import { initI18n } from '../../i18n/i18n.ts';
import { localizedBlockJsx } from '../library/insert-block.ts';
import { useSelectionStore } from '../selection/selection-store.ts';
import { toFrameCoords } from './canvas-drop-layer.tsx';
import { DndErrorBanner } from './dnd-error-banner.tsx';
import { useDndStore } from './dnd-store.ts';
import { handleDrop } from './drop-actions.ts';

describe('Canvas Drag and Drop (Scenarios #14, #15)', () => {
  beforeAll(async () => {
    await initI18n();
  });

  beforeEach(() => {
    useSelectionStore.getState().reset();
    useDndStore.getState().endDrag();
    useDndStore.getState().setError(undefined);
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('Scenario 14: toFrameCoords converts client coordinates with zoom and border offset [R-DD-10]', () => {
    const coords = toFrameCoords(150, 220, { left: 100, top: 200 }, 0.5, 1, 1);
    expect(coords).toEqual({ x: 99, y: 39 });
  });

  it('Scenario 15(a) & (b): handleDrop inserts from library and moves from layer [R-DD-14]', async () => {
    const spy = vi.spyOn(sourceClient, 'applyStructureEdit').mockResolvedValue({
      changed: true,
      files: ['src/Home.tsx'],
      locs: ['src/Home.tsx:30:5'],
    });

    const headingBlock = LIBRARY_BLOCKS.find((b) => b.id === 'content.heading');
    if (!headingBlock) throw new Error('Missing content.heading block');

    // (a) Library drag + child dropTarget
    useDndStore.getState().startDrag({ source: 'library', block: headingBlock });
    useDndStore.getState().setDropTarget({
      kind: 'child',
      parent: { loc: 'src/Home.tsx:10:1', tag: 'section' },
      where: 'end',
    });

    const okInsert = await handleDrop('vi');
    expect(okInsert).toBe(true);
    expect(spy).toHaveBeenCalledWith({
      kind: 'insert',
      target: {
        kind: 'child',
        parent: { loc: 'src/Home.tsx:10:1', tag: 'section' },
        where: 'end',
      },
      jsx: localizedBlockJsx(headingBlock, 'vi'),
    });
    expect(useSelectionStore.getState().selectedRefs).toEqual([
      { loc: 'src/Home.tsx:30:5', index: 0 },
    ]);
    expect(useDndStore.getState().drag).toBeUndefined();
    expect(useDndStore.getState().dropTarget).toBeUndefined();

    // (b) Layer drag + sibling dropTarget
    spy.mockClear();
    useDndStore.getState().startDrag({
      source: 'layer',
      ref: { loc: 'src/Home.tsx:12:3', index: 0 },
      tag: 'p',
    });
    useDndStore.getState().setDropTarget({
      kind: 'sibling',
      ref: { loc: 'src/Home.tsx:20:3', tag: 'h2' },
      where: 'after',
    });

    const okMove = await handleDrop('vi');
    expect(okMove).toBe(true);
    expect(spy).toHaveBeenCalledWith({
      kind: 'move',
      elements: [{ loc: 'src/Home.tsx:12:3', tag: 'p' }],
      target: {
        kind: 'sibling',
        ref: { loc: 'src/Home.tsx:20:3', tag: 'h2' },
        where: 'after',
      },
    });
  });

  it('Scenario 15(c) & (d): handleDrop skips without target and shows error banner on E023 [R-DD-14]', async () => {
    const spy = vi.spyOn(sourceClient, 'applyStructureEdit');

    // (c) No dropTarget -> no server call, drag cleared
    useDndStore.getState().startDrag({
      source: 'layer',
      ref: { loc: 'src/Home.tsx:12:3', index: 0 },
      tag: 'p',
    });
    const okNoTarget = await handleDrop('vi');
    expect(okNoTarget).toBe(false);
    expect(spy).not.toHaveBeenCalled();
    expect(useDndStore.getState().drag).toBeUndefined();

    // (d) Server throws E023 -> error set, DndErrorBanner displayed, selectedRefs unchanged
    useSelectionStore.getState().setSelectedRefs([{ loc: 'src/Home.tsx:5:1', index: 0 }]);
    spy.mockRejectedValueOnce(new ApiError(422, 'E023', { reason: 'loop' }));

    useDndStore.getState().startDrag({
      source: 'layer',
      ref: { loc: 'src/Home.tsx:12:3', index: 0 },
      tag: 'p',
    });
    useDndStore.getState().setDropTarget({
      kind: 'sibling',
      ref: { loc: 'src/Home.tsx:20:3', tag: 'h2' },
      where: 'after',
    });

    const okErr = await handleDrop('vi');
    expect(okErr).toBe(false);
    expect(useDndStore.getState().error?.code).toBe('E023');
    expect(useSelectionStore.getState().selectedRefs).toEqual([
      { loc: 'src/Home.tsx:5:1', index: 0 },
    ]);

    render(<DndErrorBanner />);
    const banner = screen.getByTestId('dnd-error');
    expect(banner.textContent).toContain('E023');
  });
});
