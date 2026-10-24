import type { ClassContext, ThemeInfo } from '@kumicraft/shared';
import { parseClasses } from '@kumicraft/shared';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

import { initI18n } from '../../../i18n/i18n.ts';
import { ColorField } from './color-field.tsx';

describe('ColorField', () => {
  beforeAll(async () => {
    await initI18n();
  });

  afterEach(() => {
    cleanup();
  });

  const mockTheme: ThemeInfo = {
    colors: [{ name: 'brand', value: '#f00' }],
    fontSizes: [],
    radii: [],
    fonts: [],
    shadows: [],
    breakpoints: [],
  };

  const mockCtx: ClassContext = {
    theme: mockTheme,
    mode: 'desktop-first',
    breakpoints: { sm: 640, md: 768, lg: 1024, xl: 1280, '2xl': 1536 },
  };

  it('offers project colors before the Tailwind palette [R-IN-19]', () => {
    const onValueChange = vi.fn();
    render(
      <ColorField
        property="textColor"
        label="Text Color"
        tokens={[]}
        currentScope={{ breakpoint: 'base' }}
        frameWidth={1440}
        ctx={mockCtx}
        onValueChange={onValueChange}
      />,
    );

    fireEvent.click(screen.getByTestId('color-field-textColor'));

    const themeBrand = screen.getByTestId('color-option-theme-brand');
    const paletteRed500 = screen.getByTestId('color-option-palette-red-500');

    expect(themeBrand).toBeDefined();
    expect(paletteRed500).toBeDefined();

    // theme-brand is before palette-red-500 in document order
    const position = themeBrand.compareDocumentPosition(paletteRed500);
    expect(position & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('writes a project color by name and a palette color as a scale token [R-IN-19]', () => {
    const onValueChange = vi.fn();
    render(
      <ColorField
        property="textColor"
        label="Text Color"
        tokens={[]}
        currentScope={{ breakpoint: 'base' }}
        frameWidth={1440}
        ctx={mockCtx}
        onValueChange={onValueChange}
      />,
    );

    fireEvent.click(screen.getByTestId('color-field-textColor'));
    fireEvent.click(screen.getByTestId('color-option-theme-brand'));
    expect(onValueChange).toHaveBeenCalledWith('textColor', { kind: 'theme', name: 'brand' });

    // Open again
    fireEvent.click(screen.getByTestId('color-field-textColor'));
    fireEvent.click(screen.getByTestId('color-option-palette-slate-200'));
    expect(onValueChange).toHaveBeenCalledWith('textColor', {
      kind: 'scale',
      token: 'slate-200',
    });
  });

  it('writes a valid custom color and refuses an invalid one [R-IN-19]', () => {
    const onValueChange = vi.fn();
    render(
      <ColorField
        property="textColor"
        label="Text Color"
        tokens={[]}
        currentScope={{ breakpoint: 'base' }}
        frameWidth={1440}
        ctx={mockCtx}
        onValueChange={onValueChange}
      />,
    );

    fireEvent.click(screen.getByTestId('color-field-textColor'));

    const input = screen.getByTestId('color-custom-input');
    const applyBtn = screen.getByTestId('color-custom-apply');

    fireEvent.change(input, { target: { value: '#ff6600' } });
    fireEvent.click(applyBtn);

    expect(onValueChange).toHaveBeenCalledWith('textColor', {
      kind: 'arbitrary',
      css: '#ff6600',
    });

    onValueChange.mockClear();

    fireEvent.change(input, { target: { value: 'banana' } });
    fireEvent.click(applyBtn);

    expect(onValueChange).not.toHaveBeenCalled();
    const alert = screen.getByRole('alert');
    expect(alert).toBeDefined();
  });

  it('shows the current value with its swatch [R-IN-19]', () => {
    const tokens = parseClasses('text-brand', mockCtx);
    const onValueChange = vi.fn();

    render(
      <ColorField
        property="textColor"
        label="Text Color"
        tokens={tokens}
        currentScope={{ breakpoint: 'base' }}
        frameWidth={1440}
        ctx={mockCtx}
        onValueChange={onValueChange}
      />,
    );

    const button = screen.getByTestId('color-field-textColor');
    expect(button.textContent).toContain('brand');
  });
});
