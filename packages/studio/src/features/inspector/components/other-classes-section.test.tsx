// @vitest-environment happy-dom
import type { ClassContext } from '@kumicraft/shared';
import { BREAKPOINT_WIDTHS, parseClasses } from '@kumicraft/shared';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

import { initI18n } from '../../../i18n/i18n.ts';
import { OtherClassesSection } from './other-classes-section.tsx';

const ctx: ClassContext = {
  theme: { colors: [], fontSizes: [], radii: [], fonts: [], shadows: [], breakpoints: [] },
  mode: 'desktop-first',
  breakpoints: BREAKPOINT_WIDTHS,
};

describe('OtherClassesSection [R-IN-17]', () => {
  beforeAll(async () => {
    await initI18n();
  });

  afterEach(() => {
    cleanup();
  });

  it('saves the whole class string on Enter [R-IN-17]', () => {
    const spy = vi.fn();
    render(
      <OtherClassesSection
        rawClassString="p-4 foo"
        onRawClassChange={spy}
        tokens={parseClasses('p-4 foo', ctx)}
      />,
    );

    const list = screen.getByTestId('other-classes-list');
    expect(list.textContent).toContain('foo');
    expect(list.textContent).not.toContain('p-4');

    const input = screen.getByTestId('raw-class-input');
    fireEvent.change(input, { target: { value: 'p-6 foo' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy).toHaveBeenCalledWith('p-6 foo');
  });
});
