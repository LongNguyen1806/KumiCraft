// A number field with a slider (owner, 2026-11-18): a drag previews every value and writes once
// when let go; a wrong typed value says why and writes nothing.
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

import { initI18n } from '../../../i18n/i18n.ts';
import { NUMERIC_FIELDS } from '../numeric-fields.ts';
import { SliderNumberField } from './slider-number-field.tsx';

beforeAll(async () => {
  await initI18n();
});

afterEach(() => {
  cleanup();
});

function renderField(value: number | undefined) {
  const onCommit = vi.fn<(value: number | undefined) => void>();
  const onPreview = vi.fn<(value: number) => void>();
  render(
    <SliderNumberField
      field={NUMERIC_FIELDS.rotate}
      label="Xoay"
      testId="rot"
      value={value}
      disabled={false}
      onPreview={onPreview}
      onCommit={onCommit}
    />,
  );
  return { onCommit, onPreview };
}

describe('SliderNumberField [R-IN-13]', () => {
  it('previews each dragged value and writes once when the mouse is let go', () => {
    const { onCommit, onPreview } = renderField(undefined);
    const slider = screen.getByTestId('rot-slider');
    fireEvent.change(slider, { target: { value: '10' } });
    fireEvent.change(slider, { target: { value: '11' } });
    expect(onPreview).toHaveBeenCalledWith(11);
    expect(onCommit).not.toHaveBeenCalled();
    fireEvent.pointerUp(slider);
    expect(onCommit).toHaveBeenCalledTimes(1);
    expect(onCommit).toHaveBeenCalledWith(11);
    expect(screen.getByTestId<HTMLInputElement>('rot-input').value).toBe('11');
  });

  it('refuses a wrong typed value with the reason, and writes a good one on Enter', () => {
    const { onCommit } = renderField(5);
    const input = screen.getByTestId('rot-input');
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: 'abc' } });
    expect(screen.getByTestId('rot-error').textContent).not.toBe('');
    fireEvent.keyDown(input, { key: 'Enter' });
    fireEvent.change(input, { target: { value: '400' } });
    expect(screen.getByTestId('rot-error').textContent).toContain('360');
    fireEvent.blur(input);
    expect(onCommit).not.toHaveBeenCalled();

    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: '15' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(onCommit).toHaveBeenCalledWith(15);
  });

  it('takes the value off with Clear', () => {
    const { onCommit } = renderField(5);
    fireEvent.click(screen.getByTestId('rot-clear'));
    expect(onCommit).toHaveBeenCalledWith(undefined);
  });
});
