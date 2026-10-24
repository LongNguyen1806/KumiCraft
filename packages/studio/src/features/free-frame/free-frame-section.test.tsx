// Unit tests for FreeFrameSection (SPEC-04 section 18E, WP-2.12b, R-FF-11, R-FF-14, R-FF-17).
import type { ElementSource } from '@kumicraft/shared';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import * as sourceClient from '../../api/source-client.ts';
import { initI18n } from '../../i18n/i18n.ts';
import { useCanvasViewStore } from '../editor/canvas-view-store.ts';
import { useSelectionStore } from '../selection/selection-store.ts';
import { FreeFrameSection } from './free-frame-section.tsx';

const FRAME = 'src/pages/Home.tsx:1:1';
const CHILD_A = 'src/pages/Home.tsx:2:1';
const CHILD_B = 'src/pages/Home.tsx:3:1';
const OUTSIDE = 'src/pages/Home.tsx:4:1';

function mockSource(loc: string, className: string, free = false): ElementSource {
  return {
    loc,
    tag: 'div',
    fileHash: '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
    className: { kind: 'static', value: className },
    text: { kind: 'none' },
    attributes: {},
    inLoop: false,
    free,
  };
}

describe('FreeFrameSection [R-FF-11, R-FF-14, R-FF-17]', () => {
  beforeAll(async () => {
    await initI18n();
  });

  beforeEach(() => {
    useSelectionStore.getState().reset();
    useCanvasViewStore.getState().setTailwindMajor(4);
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('Scenario 12: reads X, Y from the code classes and commits X on Enter [R-FF-11, R-FF-20]', async () => {
    useSelectionStore.getState().setTree(
      [
        { ref: { loc: FRAME, index: 0 }, tag: 'div', instances: 1 },
        { ref: { loc: CHILD_A, index: 0 }, tag: 'div', parent: 0, instances: 1 },
      ],
      false,
    );
    useSelectionStore.getState().setSelectedRefs([{ loc: CHILD_A, index: 0 }]);

    vi.spyOn(sourceClient, 'fetchElementSourceByLoc').mockImplementation((loc) => {
      if (loc === FRAME) return Promise.resolve(mockSource(FRAME, 'relative', true));
      return Promise.resolve(mockSource(CHILD_A, 'absolute left-8 top-4 w-full'));
    });

    const editSpy = vi.spyOn(sourceClient, 'editSource').mockResolvedValue({
      changed: true,
      file: 'src/pages/Home.tsx',
      fileHash: 'a'.repeat(64),
      element: mockSource(CHILD_A, 'w-full absolute left-16 top-4'),
    });

    const source = mockSource(CHILD_A, 'absolute left-8 top-4 w-full');
    render(<FreeFrameSection source={source} />);

    await waitFor(() => {
      expect(screen.queryByTestId('free-frame-section')).toBeTruthy();
    });

    const inputX = screen.getByTestId<HTMLInputElement>('free-pos-x');
    const inputY = screen.getByTestId<HTMLInputElement>('free-pos-y');
    const inputW = screen.getByTestId<HTMLInputElement>('free-pos-w');
    const inputH = screen.getByTestId<HTMLInputElement>('free-pos-h');

    expect(inputX.value).toBe('32');
    expect(inputY.value).toBe('16');
    expect(inputW.value).toBe('');
    expect(inputH.value).toBe('');

    // The user is typing in the field, so it has focus; Enter leaves it and writes once.
    inputX.focus();
    fireEvent.change(inputX, { target: { value: '64' } });
    fireEvent.keyDown(inputX, { key: 'Enter' });
    expect(document.activeElement).not.toBe(inputX);

    expect(editSpy).toHaveBeenCalledTimes(1);
    const callArg = editSpy.mock.calls[0]?.[0];
    expect(callArg?.edit).toEqual({
      kind: 'setClassName',
      loc: CHILD_A,
      tag: 'div',
      before: 'absolute left-8 top-4 w-full',
      after: 'w-full absolute left-16 top-4',
    });
  });

  it('Scenario 13: commits W on blur and cancels Y on Escape [R-FF-14]', async () => {
    useSelectionStore.getState().setTree(
      [
        { ref: { loc: FRAME, index: 0 }, tag: 'div', instances: 1 },
        { ref: { loc: CHILD_A, index: 0 }, tag: 'div', parent: 0, instances: 1 },
      ],
      false,
    );
    useSelectionStore.getState().setSelectedRefs([{ loc: CHILD_A, index: 0 }]);

    vi.spyOn(sourceClient, 'fetchElementSourceByLoc').mockImplementation((loc) => {
      if (loc === FRAME) return Promise.resolve(mockSource(FRAME, 'relative', true));
      return Promise.resolve(mockSource(CHILD_A, 'absolute left-8 top-4 w-full'));
    });

    const editSpy = vi.spyOn(sourceClient, 'editSource').mockResolvedValue({
      changed: true,
      file: 'src/pages/Home.tsx',
      fileHash: 'a'.repeat(64),
      element: mockSource(CHILD_A, 'absolute left-8 top-4 w-[122px]'),
    });

    const source = mockSource(CHILD_A, 'absolute left-8 top-4 w-full');
    render(<FreeFrameSection source={source} />);

    await waitFor(() => {
      expect(screen.queryByTestId('free-frame-section')).toBeTruthy();
    });

    const inputW = screen.getByTestId<HTMLInputElement>('free-pos-w');
    fireEvent.change(inputW, { target: { value: '122' } });
    fireEvent.blur(inputW);

    expect(editSpy).toHaveBeenCalledTimes(1);
    const afterClass = editSpy.mock.calls[0]?.[0].edit.after ?? '';
    expect(afterClass).toContain('w-[122px]');
    expect(afterClass).not.toContain('w-full');

    editSpy.mockClear();
    const inputY = screen.getByTestId<HTMLInputElement>('free-pos-y');
    fireEvent.change(inputY, { target: { value: '99' } });
    fireEvent.keyDown(inputY, { key: 'Escape' });

    expect(editSpy).not.toHaveBeenCalled();
    expect(inputY.value).toBe('16');
  });

  it('Scenario 14: multi-selection disables distribute and outside element hides section [R-FF-17]', async () => {
    useSelectionStore.getState().setTree(
      [
        { ref: { loc: FRAME, index: 0 }, tag: 'div', instances: 1 },
        { ref: { loc: CHILD_A, index: 0 }, tag: 'div', parent: 0, instances: 1 },
        { ref: { loc: CHILD_B, index: 0 }, tag: 'div', parent: 0, instances: 1 },
        { ref: { loc: OUTSIDE, index: 0 }, tag: 'div', instances: 1 },
      ],
      false,
    );

    vi.spyOn(sourceClient, 'fetchElementSourceByLoc').mockImplementation((loc) => {
      if (loc === FRAME) return Promise.resolve(mockSource(FRAME, 'relative', true));
      if (loc === CHILD_A) return Promise.resolve(mockSource(CHILD_A, 'absolute left-4 top-2'));
      if (loc === CHILD_B) return Promise.resolve(mockSource(CHILD_B, 'absolute left-20 top-2'));
      return Promise.resolve(mockSource(OUTSIDE, 'p-4', false));
    });

    useSelectionStore.getState().setSelectedRefs([
      { loc: CHILD_A, index: 0 },
      { loc: CHILD_B, index: 0 },
    ]);

    const childASource = mockSource(CHILD_A, 'absolute left-4 top-2');
    const { rerender } = render(<FreeFrameSection source={childASource} />);

    await waitFor(() => {
      expect(screen.queryByTestId('free-frame-section')).toBeTruthy();
    });

    expect(screen.getByTestId('align-left')).toBeDefined();
    expect(screen.getByTestId<HTMLButtonElement>('distribute-x').disabled).toBe(true);
    expect(screen.queryByTestId('free-pos-x')).toBeFalsy();

    useSelectionStore.getState().setSelectedRefs([{ loc: OUTSIDE, index: 0 }]);
    const outsideSource = mockSource(OUTSIDE, 'p-4', false);
    rerender(<FreeFrameSection source={outsideSource} />);

    await waitFor(() => {
      expect(screen.queryByTestId('free-frame-section')).toBeFalsy();
    });
  });
});
