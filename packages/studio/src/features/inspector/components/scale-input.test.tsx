// The bare class (`rounded`) is the scale step DEFAULT: the field shows it in words, and the same
// words typed or picked write `rounded` again (the owner's hand test of 2026-11-15).
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

import { initI18n } from '../../../i18n/i18n.ts';
import { ScaleInput } from './scale-input.tsx';

beforeAll(async () => {
  await initI18n();
});

afterEach(() => {
  cleanup();
});

function renderRadius(value: string, onInput = vi.fn<(raw: string) => void>()) {
  render(
    <ScaleInput
      property="borderRadius"
      value={value}
      suggestions={['none', 'sm', 'DEFAULT', 'md', 'lg']}
      major={4}
      disabled={false}
      className=""
      onInput={onInput}
    />,
  );
  const input = screen.getByTestId('input-borderRadius');
  if (!(input instanceof HTMLInputElement)) throw new Error('expected an input');
  return { input, onInput };
}

describe('ScaleInput, the DEFAULT step', () => {
  it('shows DEFAULT in words, in the field and in its list [R-IN-11]', () => {
    const { input } = renderRadius('DEFAULT');
    expect(input.value).not.toBe('DEFAULT');
    fireEvent.focus(input);
    const items = screen.getAllByRole('option').map((li) => li.textContent);
    expect(items).not.toContain('DEFAULT');
    expect(items).toContain(input.value);
  });

  it('writes DEFAULT when its words are typed [R-IN-11]', () => {
    const { input, onInput } = renderRadius('md');
    fireEvent.focus(input);
    const words = screen.getAllByRole('option')[2]?.textContent ?? '';
    fireEvent.change(input, { target: { value: words } });
    expect(onInput).toHaveBeenLastCalledWith('DEFAULT');
  });
});
