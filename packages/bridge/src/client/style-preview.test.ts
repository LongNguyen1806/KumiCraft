// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from 'vitest';

import { StylePreview } from './style-preview.ts';

describe('StylePreview [R-ST-13]', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('applies !important inline style twice and restores original inline styles on clearAll [R-ST-13]', () => {
    const el = document.createElement('div');
    el.style.setProperty('padding-top', '2px');
    document.body.append(el);

    const preview = new StylePreview();
    preview.apply(el, 'padding-top', '16px');
    expect(el.style.getPropertyValue('padding-top')).toBe('16px');
    expect(el.style.getPropertyPriority('padding-top')).toBe('important');

    preview.apply(el, 'padding-top', '24px');
    expect(el.style.getPropertyValue('padding-top')).toBe('24px');
    expect(el.style.getPropertyPriority('padding-top')).toBe('important');

    preview.apply(el, 'margin-top', '10px');
    expect(el.style.getPropertyValue('margin-top')).toBe('10px');

    preview.clearAll();
    expect(el.style.getPropertyValue('padding-top')).toBe('2px');
    expect(el.style.getPropertyPriority('padding-top')).toBe('');
    expect(el.style.getPropertyValue('margin-top')).toBe('');
  });
});
