// Unit tests for an Inspector field keeping what the user types while it has focus (R-IN-20).
import type { ClassContext, Scope } from '@kumicraft/shared';
import { BREAKPOINT_WIDTHS, parseClasses } from '@kumicraft/shared';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

import { initI18n } from '../../../i18n/i18n.ts';
import { PropertyField } from './property-field.tsx';

const ctx: ClassContext = {
  theme: { colors: [], fontSizes: [], radii: [], fonts: [], shadows: [], breakpoints: [] },
  mode: 'desktop-first',
  breakpoints: BREAKPOINT_WIDTHS,
};
const base: Scope = { breakpoint: 'base' };

function field(classString: string, onValueChange = vi.fn()) {
  return (
    <PropertyField
      property="padding"
      label="Padding"
      tokens={parseClasses(classString, ctx)}
      currentScope={base}
      frameWidth={1440}
      ctx={ctx}
      onValueChange={onValueChange}
    />
  );
}

describe('PropertyField [R-IN-20]', () => {
  beforeAll(async () => {
    await initI18n();
  });

  afterEach(() => {
    cleanup();
  });

  it('keeps the typed value while focused, then shows the source value after blur', () => {
    const onValueChange = vi.fn();
    const view = render(field('p-4', onValueChange));
    const input = screen.getByTestId('input-padding');
    expect(input).toHaveProperty('value', '4');

    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: '12' } });
    expect(onValueChange).toHaveBeenLastCalledWith('padding', { kind: 'scale', token: '12' });

    // The source refreshes with an older answer while the user is still typing.
    view.rerender(field('p-8', onValueChange));
    expect(input).toHaveProperty('value', '12');

    fireEvent.blur(input);
    expect(input).toHaveProperty('value', '8');
  });

  it('follows the source while not focused', () => {
    const view = render(field('p-4'));

    view.rerender(field('p-6'));

    expect(screen.getByTestId('input-padding')).toHaveProperty('value', '6');
  });

  it('shows a value that is not one of the choices instead of "—" (spec-log #120)', () => {
    const width = (classString: string) => (
      <PropertyField
        property="width"
        label="Width"
        tokens={parseClasses(classString, ctx)}
        currentScope={base}
        frameWidth={1440}
        ctx={ctx}
        onValueChange={vi.fn()}
        options={['full', 'auto']}
      />
    );
    const view = render(width('w-96'));
    expect(screen.getByTestId('input-width')).toHaveProperty('value', '96');

    view.rerender(width('w-[420px]'));
    expect(screen.getByTestId('input-width')).toHaveProperty('value', '[420px]');

    view.rerender(width('w-full'));
    const select = screen.getByTestId<HTMLSelectElement>('input-width');
    expect(select.value).toBe('full');
    // A value of the list is not repeated.
    expect([...select.options].map((o) => o.value)).toEqual(['', 'full', 'auto']);

    view.rerender(width(''));
    expect(screen.getByTestId('input-width')).toHaveProperty('value', '');
  });
});
