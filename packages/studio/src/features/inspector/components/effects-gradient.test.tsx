// "Gradient text" makes the text transparent; turning it off must give the old color back. The
// owner's hand test of 2026-11-15: a white button text came back black.
import { type ClassContext, type ClassToken, parseClasses } from '@kumicraft/shared';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

import { initI18n } from '../../../i18n/i18n.ts';
import { useSelectionStore } from '../../selection/selection-store.ts';
import type { BatchPropEntry } from '../use-live-edit.ts';
import { GradientControls } from './effects-gradient.tsx';

const ctx: ClassContext = {
  theme: { colors: [], fontSizes: [], radii: [], fonts: [], shadows: [], breakpoints: [] },
  mode: 'desktop-first',
  breakpoints: {},
};
/** The classes as the Inspector reads them. */
const tokens = (classes: string): readonly ClassToken[] => parseClasses(classes, ctx);

beforeAll(async () => {
  await initI18n();
});

afterEach(() => {
  cleanup();
  useSelectionStore.getState().reset();
});

function textColorOf(entries: readonly BatchPropEntry[] | undefined) {
  return entries?.find((e) => e.property === 'textColor');
}

describe('GradientControls, gradient text', () => {
  it('turning gradient text off gives back the text color it had [R-IN-11]', () => {
    useSelectionStore.getState().setSelectedRefs([{ loc: 'src/App.tsx:4:5', index: 0 }]);
    const onBatch = vi.fn<(entries: readonly BatchPropEntry[]) => void>();
    const gradientOn = tokens('text-white bg-linear-to-r from-blue-500 to-purple-500');
    const white = gradientOn.find((t) => t.property === 'textColor')?.value;
    const { rerender } = render(
      <GradientControls
        shared={{ editable: true, disabled: false, tokens: gradientOn, onBatchProps: onBatch }}
      />,
    );
    fireEvent.click(screen.getByTestId('effect-gradient-text'));
    expect(textColorOf(onBatch.mock.calls[0]?.[0])?.value).toEqual({
      kind: 'keyword',
      name: 'transparent',
    });

    const textOn = tokens(
      'text-transparent bg-linear-to-r from-blue-500 to-purple-500 bg-clip-text',
    );
    rerender(
      <GradientControls
        shared={{ editable: true, disabled: false, tokens: textOn, onBatchProps: onBatch }}
      />,
    );
    fireEvent.click(screen.getByTestId('effect-gradient-text'));
    expect(textColorOf(onBatch.mock.calls[1]?.[0])?.value).toEqual(white);
  });
});
