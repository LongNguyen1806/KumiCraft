import { describe, expect, it } from 'vitest';

import { classifyVariable } from './classify.ts';

describe('classifyVariable [R-ST-11]', () => {
  it('classifies brand-blue as color, radius-card as radius, shadow-soft as shadow, and ignores gap [R-ST-11]', () => {
    expect(classifyVariable('brand-blue', '#1d4ed8')).toEqual({
      kind: 'color',
      name: 'brand-blue',
    });
    expect(classifyVariable('radius-card', '12px')).toEqual({
      kind: 'radius',
      name: 'card',
    });
    expect(classifyVariable('shadow-soft', '0 2px 4px rgba(0,0,0,0.1)')).toEqual({
      kind: 'shadow',
      name: 'soft',
    });
    expect(classifyVariable('gap', '12px')).toBeUndefined();
  });

  it('classifies font-size-lg as fontSize, font-body as font, and ignores Brand_X failing THEME_TOKEN_NAME [R-ST-11]', () => {
    expect(classifyVariable('font-size-lg', '1.25rem')).toEqual({
      kind: 'fontSize',
      name: 'lg',
    });
    expect(classifyVariable('font-body', '"Inter", sans-serif')).toEqual({
      kind: 'font',
      name: 'body',
    });
    expect(classifyVariable('Brand_X', '#ff0000')).toBeUndefined();
  });
});
