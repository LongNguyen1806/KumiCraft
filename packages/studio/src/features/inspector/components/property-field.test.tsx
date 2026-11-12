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
    expect(screen.getByTestId('input-width')).toHaveProperty('value', 'full');
    // The usual values are offered as suggestions of the typed field, all of them whatever the
    // field holds (spec-log #123, #124), and picking one closes the list.
    fireEvent.focus(screen.getByTestId('input-width'));
    const items = [...screen.getByTestId('suggest-width').querySelectorAll('li')];
    expect(items.map((li) => li.textContent)).toEqual(['full', 'auto']);
    fireEvent.mouseDown(items[1] ?? document.body);
    expect(screen.queryByTestId('suggest-width')).toBeNull();
    fireEvent.blur(screen.getByTestId('input-width'));

    view.rerender(width(''));
    expect(screen.getByTestId('input-width')).toHaveProperty('value', '');
  });

  it('writes any valid typed value and nothing for an invalid one (spec-log #123)', () => {
    const onValueChange = vi.fn();
    const margin = (major: 3 | 4) => (
      <PropertyField
        property="marginBottom"
        label="Margin bottom"
        tokens={parseClasses('', ctx)}
        currentScope={base}
        frameWidth={1440}
        ctx={{ ...ctx, major }}
        onValueChange={onValueChange}
        options={['auto', '0', '1', '2', '4', '8']}
      />
    );
    const view = render(margin(4));
    const input = screen.getByTestId('input-marginBottom');
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: '13' } });
    expect(onValueChange).toHaveBeenLastCalledWith('marginBottom', { kind: 'scale', token: '13' });
    fireEvent.change(input, { target: { value: '[13px]' } });
    expect(onValueChange).toHaveBeenLastCalledWith('marginBottom', {
      kind: 'arbitrary',
      css: '13px',
    });

    onValueChange.mockClear();
    fireEvent.change(input, { target: { value: 'abc' } });
    fireEvent.change(input, { target: { value: '[13' } });
    expect(onValueChange).not.toHaveBeenCalled();
    expect(input.getAttribute('aria-invalid')).toBe('true');

    // Tailwind 3 has no mb-13: the field says so instead of writing a class that does nothing.
    view.rerender(margin(3));
    fireEvent.change(input, { target: { value: '13' } });
    expect(onValueChange).not.toHaveBeenCalled();
    fireEvent.change(input, { target: { value: '14' } });
    expect(onValueChange).toHaveBeenLastCalledWith('marginBottom', { kind: 'scale', token: '14' });
  });

  it('Enter keeps a typed value; the arrows then Enter pick a suggestion (spec-log #124)', () => {
    const onValueChange = vi.fn();
    render(
      <PropertyField
        property="paddingRight"
        label="Padding right"
        tokens={parseClasses('p-6', ctx)}
        currentScope={base}
        frameWidth={1440}
        ctx={ctx}
        onValueChange={onValueChange}
        options={['0', '1', '2', '4', '6', '8']}
      />,
    );
    const input = screen.getByTestId('input-paddingRight');
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: '50' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    // It used to pick the highlighted old value (6) and write it over the typed 50.
    expect(onValueChange).toHaveBeenLastCalledWith('paddingRight', { kind: 'scale', token: '50' });

    fireEvent.keyDown(input, { key: 'ArrowDown' });
    fireEvent.keyDown(input, { key: 'ArrowDown' });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(onValueChange).toHaveBeenLastCalledWith('paddingRight', { kind: 'scale', token: '1' });
  });
});
