// Tests for MultiInspectorView (SPEC-04 M-IN, Scenarios #13..#15 [R-CB-15]).
import type { ClassContext, ElementRef, ElementSource } from '@kumicraft/shared';
import { BREAKPOINT_WIDTHS } from '@kumicraft/shared';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import i18next from 'i18next';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import * as sourceClient from '../../api/source-client.ts';
import { initI18n } from '../../i18n/i18n.ts';
import { MultiInspectorView } from './multi-inspector-view.tsx';
import type { MultiTarget } from './types.ts';
import { DEFAULT_THEME } from './use-project-theme.ts';

const testCtx: ClassContext = {
  theme: DEFAULT_THEME,
  mode: 'desktop-first',
  breakpoints: BREAKPOINT_WIDTHS,
};

describe('MultiInspectorView (Scenarios #13..#15) [R-CB-15]', () => {
  beforeAll(async () => {
    await initI18n();
    await i18next.changeLanguage('vi');
  });

  const ref1: ElementRef = { loc: 'src/App.tsx:10:2', index: 0 };
  const ref2: ElementRef = { loc: 'src/App.tsx:15:2', index: 0 };
  const ref3: ElementRef = { loc: 'src/App.tsx:20:2', index: 0 };

  const source1: ElementSource = {
    loc: ref1.loc,
    tag: 'div',
    fileHash: 'a'.repeat(64),
    className: { kind: 'static', value: 'p-4 bg-white' },
    text: { kind: 'none' },
    attributes: {},
    inLoop: false,
  };

  const source2: ElementSource = {
    loc: ref2.loc,
    tag: 'section',
    fileHash: 'b'.repeat(64),
    className: { kind: 'static', value: 'p-4 bg-white' },
    text: { kind: 'none' },
    attributes: {},
    inLoop: false,
  };

  const source3: ElementSource = {
    loc: ref3.loc,
    tag: 'p',
    fileHash: 'c'.repeat(64),
    className: { kind: 'static', value: 'p-2 bg-white' },
    text: { kind: 'none' },
    attributes: {},
    inLoop: false,
  };

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('Scenario 13: 3 elements with different padding show "Hỗn hợp", identical background shows white [R-CB-15]', () => {
    const target: MultiTarget = {
      kind: 'multi',
      items: [
        { ref: ref1, source: source1 },
        { ref: ref2, source: source2 },
        { ref: ref3, source: source3 },
      ],
      loading: false,
      currentScope: { breakpoint: 'base' },
      writePrefix: '',
      refresh: vi.fn(),
    };

    render(<MultiInspectorView target={target} ctx={testCtx} frameWidth={1440} />);

    // Padding differs (p-4 vs p-2) -> the field shows "Hỗn hợp" and holds no value
    const paddingInput = screen.getByTestId<HTMLInputElement>('input-padding');
    expect(paddingInput.placeholder).toBe('Hỗn hợp');
    expect(paddingInput.value).toBe('');

    // Background is identical (bg-white) -> shows white
    const bgField = screen.getByTestId('property-field-backgroundColor');
    expect(bgField.textContent).toContain('white');
  });

  it('Scenario 14: Changing padding to 6 calls editSourceBatch once with 3 setClassName edits [R-CB-15]', async () => {
    const editBatchSpy = vi
      .spyOn(sourceClient, 'editSourceBatch')
      .mockResolvedValue({ changed: true, files: ['src/App.tsx'] });

    const target: MultiTarget = {
      kind: 'multi',
      items: [
        { ref: ref1, source: source1 },
        { ref: ref2, source: source2 },
        { ref: ref3, source: source3 },
      ],
      loading: false,
      currentScope: { breakpoint: 'base' },
      writePrefix: '',
      refresh: vi.fn(),
    };

    render(<MultiInspectorView target={target} ctx={testCtx} frameWidth={1440} />);

    const paddingInput = screen.getByTestId('input-padding');
    fireEvent.change(paddingInput, { target: { value: '6' } });

    await waitFor(
      () => {
        expect(editBatchSpy).toHaveBeenCalledTimes(1);
      },
      { timeout: 1000 },
    );

    const callArg = editBatchSpy.mock.calls[0]?.[0];
    expect(callArg?.edits).toHaveLength(3);
    expect(callArg?.edits[0]?.loc).toBe(ref1.loc);
    expect(callArg?.edits[0]?.before).toBe('p-4 bg-white');
    expect(callArg?.edits[0]?.after).toContain('p-6');
    expect(callArg?.edits[1]?.loc).toBe(ref2.loc);
    expect(callArg?.edits[1]?.before).toBe('p-4 bg-white');
    expect(callArg?.edits[1]?.after).toContain('p-6');
    expect(callArg?.edits[2]?.loc).toBe(ref3.loc);
    expect(callArg?.edits[2]?.before).toBe('p-2 bg-white');
    expect(callArg?.edits[2]?.after).toContain('p-6');
  });

  it('Scenario 15: 1 element with className expression renders inspector-multi-locked and disables inputs [R-CB-15]', () => {
    const editBatchSpy = vi.spyOn(sourceClient, 'editSourceBatch');

    const target: MultiTarget = {
      kind: 'multi',
      items: [
        { ref: ref1, source: source1 },
        {
          ref: { loc: 'src/App.tsx:30:5', index: 0 },
          source: {
            loc: 'src/App.tsx:30:5',
            tag: 'button',
            fileHash: 'd'.repeat(64),
            className: { kind: 'expression', code: 'cn("p-4")' },
            text: { kind: 'none' },
            attributes: {},
            inLoop: false,
          },
        },
      ],
      loading: false,
      lock: { tag: 'button', loc: 'src/App.tsx:30:5' },
      currentScope: { breakpoint: 'base' },
      writePrefix: '',
      refresh: vi.fn(),
    };

    render(<MultiInspectorView target={target} ctx={testCtx} frameWidth={1440} />);

    const lockedBanner = screen.getByTestId('inspector-multi-locked');
    expect(lockedBanner).toBeDefined();
    expect(lockedBanner.textContent).toContain('button');
    expect(lockedBanner.textContent).toContain('src/App.tsx:30:5');

    const paddingInput = screen.getByTestId<HTMLSelectElement>('input-padding');
    expect(paddingInput.disabled).toBe(true);

    expect(editBatchSpy).not.toHaveBeenCalled();
  });
});
