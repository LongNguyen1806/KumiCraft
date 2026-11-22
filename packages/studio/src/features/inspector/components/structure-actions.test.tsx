// Component tests for StructureActions in Inspector (Scenario #16, SPEC-04 R-SE-25, R-SE-26).
import type { ElementSource } from '@kumicraft/shared';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { ApiError } from '../../../api/http.ts';
import * as sourceClient from '../../../api/source-client.ts';
import { useSelectionStore } from '../../../core/selection-store.ts';
import { initI18n } from '../../../i18n/i18n.ts';
import { useStructureErrorStore } from '../../structure/structure-error-store.ts';
import type { InspectorTarget } from '../types.ts';
import { StructureActions } from './structure-actions.tsx';

function makeTarget(
  overrides: Partial<Extract<InspectorTarget, { readonly kind: 'element' }>> = {},
): Extract<InspectorTarget, { readonly kind: 'element' }> {
  const defaultSource: ElementSource = {
    loc: 'src/Home.tsx:10:5',
    tag: 'div',
    fileHash: 'a'.repeat(64),
    className: { kind: 'static', value: 'p-4' },
    text: { kind: 'none' },
    attributes: {},
    inLoop: false,
  };

  return {
    kind: 'element',
    ref: { loc: 'src/Home.tsx:10:5', index: 0 },
    locFile: 'src/Home.tsx',
    locLine: 10,
    locCol: 5,
    source: defaultSource,
    loading: false,
    warnings: [],
    currentScope: { breakpoint: 'base' },
    writePrefix: '',
    setInteractionState: () => undefined,
    refresh: () => undefined,
    ...overrides,
  };
}

describe('StructureActions Component [Scenario #16]', () => {
  beforeAll(async () => {
    await initI18n();
  });

  beforeEach(() => {
    useSelectionStore.getState().reset();
    useSelectionStore.getState().setSelectedRefs([{ loc: 'src/Home.tsx:10:5', index: 0 }]);
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('calls applyStructureEdit duplicate and selects the newly duplicated element', async () => {
    const spy = vi.spyOn(sourceClient, 'applyStructureEdit').mockResolvedValue({
      changed: true,
      files: ['src/Home.tsx'],
      locs: ['src/Home.tsx:14:5'],
    });

    render(<StructureActions target={makeTarget()} />);

    fireEvent.click(screen.getByTestId('inspector-duplicate'));

    await waitFor(() => {
      expect(spy).toHaveBeenCalledWith({
        kind: 'duplicate',
        elements: [{ loc: 'src/Home.tsx:10:5', tag: 'div' }],
      });
    });

    expect(useSelectionStore.getState().selectedRefs).toEqual([
      { loc: 'src/Home.tsx:14:5', index: 0 },
    ]);
  });

  it('calls applyStructureEdit remove and clears the selection', async () => {
    const spy = vi.spyOn(sourceClient, 'applyStructureEdit').mockResolvedValue({
      changed: true,
      files: ['src/Home.tsx'],
      locs: [],
    });

    render(<StructureActions target={makeTarget()} />);

    fireEvent.click(screen.getByTestId('inspector-remove'));

    await waitFor(() => {
      expect(spy).toHaveBeenCalledWith({
        kind: 'remove',
        elements: [{ loc: 'src/Home.tsx:10:5', tag: 'div' }],
      });
    });

    expect(useSelectionStore.getState().selectedRefs).toEqual([]);
  });

  it('displays translated error message when server returns E023 rootElement', async () => {
    vi.spyOn(sourceClient, 'applyStructureEdit').mockRejectedValue(
      new ApiError(422, 'E023', { reason: 'rootElement', loc: 'src/Home.tsx:10:5' }),
    );

    render(<StructureActions target={makeTarget()} />);

    act(() => {
      fireEvent.click(screen.getByTestId('inspector-remove'));
    });

    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toMatch(/root element of a component|phần tử gốc của component/);
  });

  it('Scenario 16: StructureActions displays E023 error when error is populated via store (from shortcut)', async () => {
    render(<StructureActions target={makeTarget()} />);

    act(() => {
      useStructureErrorStore.getState().setError({
        targetKey: 'src/Home.tsx:10:5#0',
        info: {
          code: 'E023',
          params: { reason: 'rootElement', loc: 'src/Home.tsx:10:5' },
        },
      });
    });

    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toMatch(/root element of a component|phần tử gốc của component/);
  });

  it('calls applyStructureEdit move with target calculated from tree when clicking Up [Scenario #18]', async () => {
    const n1 = {
      tag: 'h1',
      instances: 1,
      ref: { loc: 'src/Home.tsx:5:5', index: 0 },
      parent: 0,
    };
    const n2 = {
      tag: 'div',
      instances: 1,
      ref: { loc: 'src/Home.tsx:10:5', index: 0 },
      parent: 0,
    };
    useSelectionStore.getState().setTree([n1, n2]);

    const spy = vi.spyOn(sourceClient, 'applyStructureEdit').mockResolvedValue({
      changed: true,
      files: ['src/Home.tsx'],
      locs: ['src/Home.tsx:5:5'],
    });

    render(<StructureActions target={makeTarget()} />);

    const upButton = screen.getByTestId('inspector-move-up');
    expect(upButton.hasAttribute('disabled')).toBe(false);
    fireEvent.click(upButton);

    await waitFor(() => {
      expect(spy).toHaveBeenCalledWith({
        kind: 'move',
        elements: [{ loc: 'src/Home.tsx:10:5', tag: 'div' }],
        target: {
          kind: 'sibling',
          ref: { loc: 'src/Home.tsx:5:5', tag: 'h1' },
          where: 'before',
        },
      });
    });
  });

  it('calls applyStructureEdit wrap grid when selecting grid [Scenario #18]', async () => {
    const spy = vi.spyOn(sourceClient, 'applyStructureEdit').mockResolvedValue({
      changed: true,
      files: ['src/Home.tsx'],
      locs: ['src/Home.tsx:10:5'],
    });

    render(<StructureActions target={makeTarget()} />);

    fireEvent.click(screen.getByTestId('inspector-wrap'));
    fireEvent.click(screen.getByRole('menuitem', { name: /Grid|Lưới/ }));
    expect(screen.queryByRole('menu')).toBeNull();

    await waitFor(() => {
      expect(spy).toHaveBeenCalledWith({
        kind: 'wrap',
        elements: [{ loc: 'src/Home.tsx:10:5', tag: 'div' }],
        wrapper: 'grid',
      });
    });
  });

  it('disables unwrap button when element has component tag Card [Scenario #18]', () => {
    const target = makeTarget({
      source: {
        loc: 'src/Home.tsx:10:5',
        tag: 'Card',
        fileHash: 'a'.repeat(64),
        className: { kind: 'static', value: '' },
        text: { kind: 'none' },
        attributes: {},
        inLoop: false,
      },
    });

    render(<StructureActions target={target} />);

    const unwrapBtn = screen.getByTestId('inspector-unwrap');
    expect(unwrapBtn.hasAttribute('disabled')).toBe(true);
  });
});
