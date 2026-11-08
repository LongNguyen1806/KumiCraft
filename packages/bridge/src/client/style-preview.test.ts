// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from 'vitest';

import { cleanProbe, StylePreview } from './style-preview.ts';

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

  it('a style probe while previewing sees the element own styles, then the preview is back [K10]', () => {
    document.body.innerHTML = '<p data-rc-loc="src/Home.tsx:3:5" style="color: red">Hi</p>';
    const el = document.querySelector('p');
    if (!(el instanceof HTMLElement)) throw new Error('no p');
    const preview = new StylePreview();
    preview.apply(el, 'font-size', '22px');
    preview.apply(el, 'color', 'blue');
    const seen = preview.withoutPreview(() => ({
      fontSize: el.style.getPropertyValue('font-size'),
      color: el.style.getPropertyValue('color'),
    }));
    // The probe sees no previewed font size and the element's own red, not the preview's blue.
    expect(seen).toEqual({ fontSize: '', color: 'red' });
    expect(el.style.getPropertyValue('font-size')).toBe('22px');
    expect(el.style.getPropertyPriority('font-size')).toBe('important');
    expect(el.style.getPropertyValue('color')).toBe('blue');

    const answer = cleanProbe(
      preview,
      { ref: { loc: 'src/Home.tsx:3:5', index: 0 }, properties: ['fontSize', 'color'] },
      document,
    );
    expect(answer.inline.map((d) => d.property)).toEqual(['color']);
    expect(el.style.getPropertyValue('font-size')).toBe('22px');
  });
});
