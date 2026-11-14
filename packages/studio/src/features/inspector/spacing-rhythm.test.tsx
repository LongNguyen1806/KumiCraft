// @vitest-environment happy-dom
// Unit tests for Inspector spacing rhythm offbeat dot and suggestion ordering (TK-72, test 23).
import type { ClassContext, Scope } from '@kumicraft/shared';
import { BREAKPOINT_WIDTHS, parseClasses } from '@kumicraft/shared';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

import { initI18n } from '../../i18n/i18n.ts';
import { PropertyField } from './components/property-field.tsx';
import { SpacingBox } from './components/spacing-box.tsx';
import { PROPERTY_GROUPS } from './property-groups-config.ts';

const ctx: ClassContext = {
  theme: { colors: [], fontSizes: [], radii: [], fonts: [], shadows: [], breakpoints: [] },
  mode: 'desktop-first',
  breakpoints: BREAKPOINT_WIDTHS,
};
const base: Scope = { breakpoint: 'base' };

describe('Spacing rhythm [TK-72]', () => {
  beforeAll(async () => {
    await initI18n();
  });

  afterEach(() => {
    cleanup();
  });

  it('23. p-5 shows yellow offbeat dot and clicking snaps to p-6; p-4 shows no dot', () => {
    const onValueChange = vi.fn();
    const view = render(
      <PropertyField
        property="padding"
        label="Padding"
        tokens={parseClasses('p-5', ctx)}
        currentScope={base}
        frameWidth={1440}
        ctx={ctx}
        options={['0', '0.5', '1', '2', '3', '4', '5', '6', '8']}
        onValueChange={onValueChange}
      />,
    );

    const dot = screen.getByTestId('spacing-offbeat-padding');
    expect(dot.getAttribute('title')).toContain('6');

    fireEvent.click(dot);
    expect(onValueChange).toHaveBeenCalledWith('padding', { kind: 'scale', token: '6' });

    view.rerender(
      <PropertyField
        property="padding"
        label="Padding"
        tokens={parseClasses('p-4', ctx)}
        currentScope={base}
        frameWidth={1440}
        ctx={ctx}
        options={['0', '0.5', '1', '2', '3', '4', '5', '6', '8']}
        onValueChange={onValueChange}
      />,
    );
    expect(screen.queryAllByTestId('spacing-offbeat-padding')).toHaveLength(0);
  });

  it('23b. prioritizes rhythm values in suggestions and supports SpacingBox side snapping', () => {
    const onValueChange = vi.fn();
    render(
      <PropertyField
        property="gap"
        label="Gap"
        tokens={parseClasses('gap-4', ctx)}
        currentScope={base}
        frameWidth={1440}
        ctx={ctx}
        options={['0', '0.5', '1', '1.5', '2', '4', '5', '6']}
        onValueChange={onValueChange}
      />,
    );

    const input = screen.getByTestId('input-gap');
    fireEvent.focus(input);
    const items = screen.getAllByRole('option').map((el) => el.textContent);
    expect(items).toEqual(['0', '1', '2', '4', '6', '0.5', '1.5', '5']);

    // Typing an offbeat value is never blocked
    fireEvent.change(input, { target: { value: '5' } });
    expect(onValueChange).toHaveBeenLastCalledWith('gap', { kind: 'scale', token: '5' });

    const spacingFields = PROPERTY_GROUPS.find((g) => g.id === 'spacing')?.fields ?? [];
    render(
      <SpacingBox
        fields={spacingFields}
        shared={{
          tokens: parseClasses('pt-5', ctx),
          currentScope: base,
          frameWidth: 1440,
          ctx,
          onValueChange,
        }}
      />,
    );
    const ptDot = screen.getByTestId('spacing-offbeat-paddingTop');
    fireEvent.click(ptDot);
    expect(onValueChange).toHaveBeenCalledWith('paddingTop', { kind: 'scale', token: '6' });
  });
});
