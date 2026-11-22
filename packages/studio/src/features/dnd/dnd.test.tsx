// @vitest-environment happy-dom
import { LIBRARY_BLOCKS } from '@kumicraft/content';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { ApiError } from '../../api/http.ts';
import * as sourceClient from '../../api/source-client.ts';
import { useDndStore } from '../../core/dnd-store.ts';
import { useSelectionStore } from '../../core/selection-store.ts';
import { initI18n } from '../../i18n/i18n.ts';
import { DEFAULT_THEME, useThemeStore } from '../inspector/use-project-theme.ts';
import { localizedBlockJsx, resetThemeLookAttempt } from '../library/insert-block.ts';
import { setSelectedVariant } from '../library/library-variants.ts';
import { toFrameCoords } from './canvas-drop-layer.tsx';
import { DndErrorBanner } from './dnd-error-banner.tsx';
import { handleDrop } from './drop-actions.ts';

describe('Canvas Drag and Drop (Scenarios #14, #15)', () => {
  beforeAll(async () => {
    await initI18n();
  });

  beforeEach(() => {
    localStorage.clear();
    resetThemeLookAttempt();
    useThemeStore.setState({
      theme: { ...DEFAULT_THEME, file: 'src/index.css' },
    });
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

  it('13. [TK-47] handleDrop uses the dragged or stored variant for library blocks', async () => {
    const spy = vi.spyOn(sourceClient, 'applyStructureEdit').mockResolvedValue({
      changed: true,
      files: ['src/Home.tsx'],
      locs: ['src/Home.tsx:40:5'],
    });
    const buttonBlock = LIBRARY_BLOCKS.find((b) => b.id === 'form.button');
    if (!buttonBlock) throw new Error('Missing form.button block');

    // (a) Explicit variantId carried on DragSource
    useDndStore
      .getState()
      .startDrag({ source: 'library', block: buttonBlock, variantId: 'outline' });
    useDndStore.getState().setDropTarget({
      kind: 'child',
      parent: { loc: 'src/Home.tsx:10:1', tag: 'section' },
      where: 'end',
    });

    const okExplicit = await handleDrop('en');
    expect(okExplicit).toBe(true);
    const firstCall = spy.mock.calls[0]?.[0];
    expect(firstCall?.kind).toBe('insert');
    if (firstCall?.kind === 'insert') {
      expect(firstCall.jsx).toContain('border');
      expect(firstCall.jsx).not.toContain('bg-blue-600');
    }

    // (b) Persisted variant in localStorage when DragSource omits variantId
    spy.mockClear();
    setSelectedVariant('form.button', 'ghost');
    useDndStore.getState().startDrag({ source: 'library', block: buttonBlock });
    useDndStore.getState().setDropTarget({
      kind: 'child',
      parent: { loc: 'src/Home.tsx:10:1', tag: 'section' },
      where: 'end',
    });

    const okStored = await handleDrop('en');
    expect(okStored).toBe(true);
    const secondCall = spy.mock.calls[0]?.[0];
    expect(secondCall?.kind).toBe('insert');
    if (secondCall?.kind === 'insert') {
      expect(secondCall.jsx).toContain('bg-transparent');
      expect(secondCall.jsx).not.toContain('border-blue-600');
    }
  });
});
