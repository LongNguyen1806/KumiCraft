// Unit tests for TagAttributesSection (SPEC-04 R-IN-18, FR-25).
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

import { initI18n } from '../../../i18n/i18n.ts';
import { TagAttributesSection } from './tag-attributes-section.tsx';

describe('TagAttributesSection [SPEC-04 R-IN-18]', () => {
  beforeAll(async () => {
    await initI18n();
  });

  afterEach(() => {
    cleanup();
  });

  it('commits the trimmed value once on Enter, not on every keystroke', () => {
    const onChange = vi.fn();
    render(
      <TagAttributesSection
        tag="a"
        attributes={{ href: { kind: 'static', value: '/old' } }}
        onAttributeChange={onChange}
      />,
    );
    const input = screen.getByTestId('attr-input-href');
    input.focus();

    fireEvent.change(input, { target: { value: '/n' } });
    fireEvent.change(input, { target: { value: ' /new ' } });
    expect(onChange).not.toHaveBeenCalled();

    fireEvent.keyDown(input, { key: 'Enter' });
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith('href', '/new');
  });

  it('removes the attribute when the field is cleared and blurred', () => {
    const onChange = vi.fn();
    render(
      <TagAttributesSection
        tag="img"
        attributes={{ alt: { kind: 'static', value: 'Logo' } }}
        onAttributeChange={onChange}
      />,
    );
    const input = screen.getByTestId('attr-input-alt');

    fireEvent.change(input, { target: { value: '  ' } });
    fireEvent.blur(input);

    expect(onChange).toHaveBeenCalledWith('alt', undefined);
  });

  it('reverts on Escape and does not commit an unchanged value', () => {
    const onChange = vi.fn();
    render(
      <TagAttributesSection
        tag="a"
        attributes={{ href: { kind: 'static', value: '/old' } }}
        onAttributeChange={onChange}
      />,
    );
    const input = screen.getByTestId('attr-input-href');

    fireEvent.change(input, { target: { value: '/typo' } });
    fireEvent.keyDown(input, { key: 'Escape' });
    expect(input).toHaveProperty('value', '/old');

    fireEvent.blur(input);
    expect(onChange).not.toHaveBeenCalled();
  });

  it('keeps expression attributes read-only', () => {
    render(
      <TagAttributesSection
        tag="img"
        attributes={{ src: { kind: 'expression', code: 'logoUrl' } }}
        onAttributeChange={vi.fn()}
      />,
    );

    expect(screen.getByTestId('attr-input-src')).toHaveProperty('disabled', true);
  });
});
