// Unit tests for Free Frame Studio features (Scenarios 12–16, R-FF-10..19).
import type { ElementSource } from '@kumicraft/shared';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import * as sourceClient from '../../api/source-client.ts';
import { initI18n } from '../../i18n/i18n.ts';
import { GridSelect } from '../editor/canvas-grid-select.tsx';
import { useCanvasViewStore } from '../editor/canvas-view-store.ts';
import { studioBridgeChannel } from '../selection/bridge-channel.ts';
import { useSelectionStore } from '../selection/selection-store.ts';
import { computeNextClassNameForResize, handleFreeMove } from './free-frame-commands.ts';
import { FreeFramePageWarning } from './free-frame-page-warning.tsx';
import { FreeFrameToggle } from './free-frame-toggle.tsx';

function createMockSource(partial: Partial<ElementSource>): ElementSource {
  return {
    loc: 'src/pages/Home.tsx:3:5',
    tag: 'div',
    fileHash: '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
    className: { kind: 'static', value: 'p-4' },
    text: { kind: 'none' },
    attributes: {},
    inLoop: false,
    ...partial,
  };
}

describe('Studio: Free Frame features [Scenarios 12–16]', () => {
  beforeAll(async () => {
    await initI18n();
  });

  beforeEach(() => {
    useSelectionStore.getState().reset();
    localStorage.clear();
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('Scenario 12: handles free-move for 2 elements with a single batch edit [R-FF-13]', async () => {
    const editBatchSpy = vi.spyOn(sourceClient, 'editSourceBatch').mockResolvedValue({
      changed: true,
      files: ['src/Page.tsx'],
    });

    vi.spyOn(sourceClient, 'fetchElementSourceByLoc').mockImplementation((loc) => {
      if (loc === 'src/Page.tsx:3:5') {
        return Promise.resolve(
          createMockSource({ loc, className: { kind: 'static', value: 'w-40 p-2' } }),
        );
      }
      return Promise.resolve(
        createMockSource({ loc, className: { kind: 'static', value: 'h-20 bg-blue-500' } }),
      );
    });

    await handleFreeMove({
      items: [
        { ref: { loc: 'src/Page.tsx:3:5', index: 0 }, tag: 'div', left: 100, top: 200 },
        { ref: { loc: 'src/Page.tsx:4:5', index: 0 }, tag: 'div', left: 150, top: 250 },
      ],
    });

    expect(editBatchSpy).toHaveBeenCalledTimes(1);
    const callArgs = editBatchSpy.mock.calls[0]?.[0];
    expect(callArgs?.edits).toHaveLength(2);
    expect(callArgs?.edits[0]?.before).toBe('w-40 p-2');
    expect(callArgs?.edits[1]?.before).toBe('h-20 bg-blue-500');
  });

  it('Scenario 13: computes next className for left-edge resize, standard resize, and resetSize [R-FF-14]', () => {
    const freeRes = computeNextClassNameForResize(
      {
        ref: { loc: 'src/Page.tsx:3:5', index: 0 },
        tag: 'div',
        left: 64,
        width: 256,
      },
      'absolute left-8 top-16 w-32 p-4',
    );
    expect(freeRes).toBe('p-4 absolute left-16 top-16 w-64');

    const flowRes = computeNextClassNameForResize(
      {
        ref: { loc: 'src/Page.tsx:3:5', index: 0 },
        tag: 'div',
        width: 200,
        height: 100,
      },
      'p-4 bg-white',
    );
    expect(flowRes).toBe('p-4 bg-white w-50 h-25');

    const resetRes = computeNextClassNameForResize(
      {
        ref: { loc: 'src/Page.tsx:3:5', index: 0 },
        tag: 'div',
        resetSize: true,
      },
      'w-50 h-25 p-4',
    );
    expect(resetRes).toBe('p-4');
  });

  it('Scenario 14: Grid select changes to 16, sends set-grid and persists to localStorage [R-FF-11]', () => {
    const setGridSpy = vi.spyOn(studioBridgeChannel, 'setGrid').mockImplementation(() => undefined);
    render(<GridSelect />);

    const select = screen.getByTestId('canvas-grid-select');
    fireEvent.change(select, { target: { value: '16' } });

    expect(useCanvasViewStore.getState().grid).toBe(16);
    expect(setGridSpy).toHaveBeenCalledWith(16);
    expect(localStorage.getItem('kumicraft:canvas-grid')).toBe('16');
  });

  it('Scenario 15: displays warning on regular page and hides it on draft page [R-FF-19]', async () => {
    vi.spyOn(sourceClient, 'fetchElementSourceByLoc').mockResolvedValue(
      createMockSource({ loc: 'src/pages/Home.tsx:3:5', tag: 'div', free: true }),
    );

    useSelectionStore.getState().setTree(
      [
        { ref: { loc: 'src/pages/Home.tsx:3:5', index: 0 }, tag: 'div', instances: 1 },
        {
          ref: { loc: 'src/pages/Home.tsx:4:7', index: 0 },
          tag: 'p',
          parent: 0,
          instances: 1,
        },
      ],
      false,
    );

    const regularSource = createMockSource({
      loc: 'src/pages/Home.tsx:4:7',
      tag: 'p',
    });
    const { rerender } = render(<FreeFramePageWarning source={regularSource} />);
    await waitFor(() => {
      expect(screen.queryByTestId('free-frame-page-warning')).toBeTruthy();
    });

    const draftSource = createMockSource({
      loc: 'src/drafts/MyDraft.tsx:4:7',
      tag: 'p',
    });
    rerender(<FreeFramePageWarning source={draftSource} />);
    await waitFor(() => {
      expect(screen.queryByTestId('free-frame-page-warning')).toBeFalsy();
    });
  });

  it('Scenario 16: timeout on measure-free displays error and sends no edits [R-FF-10]', () => {
    vi.useFakeTimers();
    const batchSpy = vi.spyOn(sourceClient, 'editSourceBatch');
    const measureSpy = vi
      .spyOn(studioBridgeChannel, 'measureFree')
      .mockImplementation(() => undefined);

    useSelectionStore.getState().setSelectedRefs([{ loc: 'src/pages/Home.tsx:3:5', index: 0 }]);
    const source = createMockSource({
      loc: 'src/pages/Home.tsx:3:5',
      tag: 'div',
      className: { kind: 'static', value: 'p-4' },
      free: false,
    });

    render(<FreeFrameToggle source={source} />);
    const toggleBtn = screen.getByTestId('free-frame-toggle');
    fireEvent.click(toggleBtn);

    expect(measureSpy).toHaveBeenCalledWith({ loc: 'src/pages/Home.tsx:3:5', index: 0 });

    act(() => {
      vi.advanceTimersByTime(2000);
    });

    const errorAlert = screen.getByTestId('free-frame-error');
    expect(errorAlert).toBeDefined();
    expect(batchSpy).not.toHaveBeenCalled();

    vi.useRealTimers();
  });
});
