// Unit tests for K9.7-2 Table 4.1 Tailwind v4/v3 read/write, composite CSS merging, and K9.7-2 schemas (Test 12, TK-1, TK-4, TK-6, TK-10..17).
import { describe, expect, it } from 'vitest';

import {
  AnyEditSchema,
  type ClassContext,
  CSS_LONGHAND_OF,
  extractCompositeSubValue,
  isValidSettableAttrName,
  mergeCompositeCssDeclaration,
  parseClasses,
  readValue,
  ReplaceSvgEditSchema,
  SetTagEditSchema,
  type ThemeInfo,
  writeValue,
} from './index.ts';

const THEME: ThemeInfo = {
  colors: [
    { name: 'brand', value: '#4f46e5', variable: '--color-brand' },
    { name: 'accent', value: '#ec4899', variable: '--color-accent' },
  ],
  radii: [],
  fonts: [],
  fontSizes: [],
  shadows: [],
  breakpoints: [],
};

const ctx = (major: 3 | 4): ClassContext => ({
  theme: THEME,
  mode: 'desktop-first',
  breakpoints: { sm: 640, md: 768, lg: 1024, xl: 1280, '2xl': 1536 },
  major,
});

const baseScope = { breakpoint: 'base' as const };
const baseView = { width: 1280 };

describe('Table 4.1 Tailwind v4 and v3 read/write (Test 12)', () => {
  it('reads and writes backgroundImage gradient direction differently in v4 vs v3', () => {
    const v4Ctx = ctx(4);
    const v3Ctx = ctx(3);

    const writtenV4 = writeValue(
      '',
      'backgroundImage',
      baseScope,
      { kind: 'keyword', name: 'linear-to-r' },
      v4Ctx,
    );
    expect(writtenV4).toBe('bg-linear-to-r');
    expect(
      readValue(parseClasses(writtenV4, v4Ctx), 'backgroundImage', baseView, v4Ctx).value,
    ).toEqual({
      kind: 'keyword',
      name: 'linear-to-r',
    });

    const writtenV3 = writeValue(
      '',
      'backgroundImage',
      baseScope,
      { kind: 'keyword', name: 'linear-to-r' },
      v3Ctx,
    );
    expect(writtenV3).toBe('bg-gradient-to-r');
    expect(
      readValue(parseClasses(writtenV3, v3Ctx), 'backgroundImage', baseView, v3Ctx).value,
    ).toEqual({
      kind: 'keyword',
      name: 'linear-to-r',
    });
  });

  it('reads and writes gradient stops, text gradient, shadowColor, glow, and backdropBlur', () => {
    for (const major of [4, 3] as const) {
      const c = ctx(major);
      let cls = '';
      cls = writeValue(cls, 'gradientFrom', baseScope, { kind: 'theme', name: 'brand' }, c);
      cls = writeValue(cls, 'gradientVia', baseScope, { kind: 'theme', name: 'accent' }, c);
      cls = writeValue(cls, 'gradientTo', baseScope, { kind: 'scale', token: 'purple-600' }, c);
      cls = writeValue(cls, 'backgroundClip', baseScope, { kind: 'keyword', name: 'text' }, c);
      cls = writeValue(cls, 'textColor', baseScope, { kind: 'scale', token: 'transparent' }, c);
      cls = writeValue(cls, 'shadowColor', baseScope, { kind: 'theme', name: 'brand' }, c);
      cls = writeValue(cls, 'backdropBlur', baseScope, { kind: 'scale', token: 'md' }, c);

      expect(cls).toContain('from-brand');
      expect(cls).toContain('via-accent');
      expect(cls).toContain('to-purple-600');
      expect(cls).toContain('bg-clip-text');
      expect(cls).toContain('text-transparent');
      expect(cls).toContain('shadow-brand/50');
      expect(cls).toContain('backdrop-blur-md');

      const tokens = parseClasses(cls, c);
      expect(readValue(tokens, 'gradientFrom', baseView, c).value).toEqual({
        kind: 'theme',
        name: 'brand',
      });
      expect(readValue(tokens, 'gradientVia', baseView, c).value).toEqual({
        kind: 'theme',
        name: 'accent',
      });
      expect(readValue(tokens, 'gradientTo', baseView, c).value).toEqual({
        kind: 'scale',
        token: 'purple-600',
      });
      expect(readValue(tokens, 'backgroundClip', baseView, c).value).toEqual({
        kind: 'keyword',
        name: 'text',
      });
      expect(readValue(tokens, 'shadowColor', baseView, c).value).toEqual({
        kind: 'theme',
        name: 'brand',
      });
      expect(readValue(tokens, 'backdropBlur', baseView, c).value).toEqual({
        kind: 'scale',
        token: 'md',
      });
    }

    const v3Backdrop = writeValue(
      '',
      'backdropBlur',
      baseScope,
      { kind: 'scale', token: 'sm' },
      ctx(3),
    );
    expect(v3Backdrop).toBe('backdrop-blur');
    const v4Backdrop = writeValue(
      '',
      'backdropBlur',
      baseScope,
      { kind: 'scale', token: 'sm' },
      ctx(4),
    );
    expect(v4Backdrop).toBe('backdrop-blur-sm');

    const glowCls = writeValue(
      '',
      'boxShadow',
      baseScope,
      { kind: 'arbitrary', css: '0 0 24px rgba(37,99,235,0.5)' },
      ctx(4),
    );
    expect(glowCls).toBe('shadow-[0_0_24px_rgba(37,99,235,0.5)]');
    expect(readValue(parseClasses(glowCls, ctx(4)), 'boxShadow', baseView, ctx(4)).value).toEqual({
      kind: 'arbitrary',
      css: '0 0 24px rgba(37,99,235,0.5)',
    });
  });

  it('reads and writes transform, filter, mixBlendMode, transition, animation, image & strokeWidth', () => {
    const c = ctx(4);
    let cls = '';
    cls = writeValue(cls, 'rotate', baseScope, { kind: 'scale', token: '45' }, c);
    cls = writeValue(cls, 'scale', baseScope, { kind: 'scale', token: '105' }, c);
    cls = writeValue(cls, 'translateX', baseScope, { kind: 'scale', token: '4' }, c);
    cls = writeValue(cls, 'translateY', baseScope, { kind: 'scale', token: '-1' }, c);
    cls = writeValue(cls, 'skewX', baseScope, { kind: 'scale', token: '6' }, c);
    cls = writeValue(cls, 'brightness', baseScope, { kind: 'scale', token: '110' }, c);
    cls = writeValue(cls, 'contrast', baseScope, { kind: 'scale', token: '125' }, c);
    cls = writeValue(cls, 'grayscale', baseScope, { kind: 'scale', token: 'DEFAULT' }, c);
    cls = writeValue(cls, 'mixBlendMode', baseScope, { kind: 'keyword', name: 'multiply' }, c);
    cls = writeValue(cls, 'transitionProperty', baseScope, { kind: 'scale', token: 'colors' }, c);
    cls = writeValue(cls, 'duration', baseScope, { kind: 'scale', token: '300' }, c);
    cls = writeValue(cls, 'ease', baseScope, { kind: 'keyword', name: 'in-out' }, c);
    cls = writeValue(cls, 'delay', baseScope, { kind: 'scale', token: '100' }, c);
    cls = writeValue(cls, 'animation', baseScope, { kind: 'keyword', name: 'pulse' }, c);
    cls = writeValue(cls, 'objectFit', baseScope, { kind: 'keyword', name: 'cover' }, c);
    cls = writeValue(cls, 'objectPosition', baseScope, { kind: 'keyword', name: 'center' }, c);
    cls = writeValue(cls, 'aspectRatio', baseScope, { kind: 'keyword', name: 'video' }, c);
    cls = writeValue(cls, 'strokeWidth', baseScope, { kind: 'scale', token: '2' }, c);

    expect(cls).toContain('rotate-45');
    expect(cls).toContain('scale-105');
    expect(cls).toContain('translate-x-4');
    expect(cls).toContain('-translate-y-1');
    expect(cls).toContain('skew-x-6');
    expect(cls).toContain('brightness-110');
    expect(cls).toContain('contrast-125');
    expect(cls).toContain('grayscale');
    expect(cls).toContain('mix-blend-multiply');
    expect(cls).toContain('transition-colors');
    expect(cls).toContain('duration-300');
    expect(cls).toContain('ease-in-out');
    expect(cls).toContain('delay-100');
    expect(cls).toContain('animate-pulse');
    expect(cls).toContain('object-cover');
    expect(cls).toContain('object-center');
    expect(cls).toContain('aspect-video');
    expect(cls).toContain('stroke-2');

    const tokens = parseClasses(cls, c);
    expect(readValue(tokens, 'rotate', baseView, c).value).toEqual({ kind: 'scale', token: '45' });
    expect(readValue(tokens, 'translateY', baseView, c).token?.negative).toBe(true);
    expect(readValue(tokens, 'grayscale', baseView, c).value).toEqual({
      kind: 'scale',
      token: 'DEFAULT',
    });
    expect(readValue(tokens, 'duration', baseView, c).value).toEqual({
      kind: 'scale',
      token: '300',
    });
    expect(readValue(tokens, 'animation', baseView, c).value).toEqual({
      kind: 'scale',
      token: 'pulse',
    });
    expect(readValue(tokens, 'objectFit', baseView, c).value).toEqual({
      kind: 'keyword',
      name: 'cover',
    });
    expect(readValue(tokens, 'objectPosition', baseView, c).value).toEqual({
      kind: 'scale',
      token: 'center',
    });
    expect(readValue(tokens, 'aspectRatio', baseView, c).value).toEqual({
      kind: 'scale',
      token: 'video',
    });
    expect(readValue(tokens, 'strokeWidth', baseView, c).value).toEqual({
      kind: 'scale',
      token: '2',
    });
  });

  it('maps every new PropertyId in CSS_LONGHAND_OF', () => {
    expect(CSS_LONGHAND_OF['backgroundImage']).toBe('background-image');
    expect(CSS_LONGHAND_OF['backdropBlur']).toBe('backdrop-filter');
    expect(CSS_LONGHAND_OF['rotate']).toBe('transform');
    expect(CSS_LONGHAND_OF['brightness']).toBe('filter');
    expect(CSS_LONGHAND_OF['mixBlendMode']).toBe('mix-blend-mode');
    expect(CSS_LONGHAND_OF['duration']).toBe('transition');
    expect(CSS_LONGHAND_OF['animation']).toBe('animation');
    expect(CSS_LONGHAND_OF['objectFit']).toBe('object-fit');
    expect(CSS_LONGHAND_OF['objectPosition']).toBe('object-position');
    expect(CSS_LONGHAND_OF['aspectRatio']).toBe('aspect-ratio');
  });
});

describe('Composite CSS merging helper', () => {
  it('merges transform, filter, transition, and linear-gradient without losing siblings', () => {
    const t = mergeCompositeCssDeclaration('rotate', 'scale(1.05) perspective(400px)', '45deg');
    expect(t).toBe('scale(1.05) perspective(400px) rotate(45deg)');
    expect(extractCompositeSubValue('scale', t)).toBe('1.05');
    expect(extractCompositeSubValue('rotate', t)).toBe('45deg');

    const f = mergeCompositeCssDeclaration('brightness', 'blur(4px) contrast(120%)', '110%');
    expect(f).toBe('blur(4px) contrast(120%) brightness(110%)');

    const tr = mergeCompositeCssDeclaration('duration', 'transform 200ms ease-out', '500ms');
    expect(tr).toBe('transform 500ms ease-out');
    expect(extractCompositeSubValue('transitionProperty', tr)).toBe('transform');

    const g1 = mergeCompositeCssDeclaration(
      'gradientVia',
      'linear-gradient(to right, var(--brand), #9333ea)',
      '#ec4899',
    );
    expect(g1).toBe('linear-gradient(to right, var(--brand), #ec4899, #9333ea)');
    expect(extractCompositeSubValue('backgroundImage', g1)).toBe('to right');
    expect(extractCompositeSubValue('gradientFrom', g1)).toBe('var(--brand)');
    expect(extractCompositeSubValue('gradientVia', g1)).toBe('#ec4899');
    expect(extractCompositeSubValue('gradientTo', g1)).toBe('#9333ea');
  });
});

describe('K9.7-2 schema guards (TK-1, TK-4, TK-6)', () => {
  it('validates setTag allowlist and rejects components or unknown tags', () => {
    expect(
      SetTagEditSchema.safeParse({ kind: 'setTag', loc: 'a:1:1', tag: 'div', after: 'section' })
        .success,
    ).toBe(true);
    expect(
      SetTagEditSchema.safeParse({ kind: 'setTag', loc: 'a:1:1', tag: 'div', after: 'Card' })
        .success,
    ).toBe(false);
    expect(
      SetTagEditSchema.safeParse({ kind: 'setTag', loc: 'a:1:1', tag: 'div', after: 'marquee' })
        .success,
    ).toBe(false);
  });

  it('validates extended attributes and blocks event handlers and data-rc-*', () => {
    for (const okAttr of ['id', 'aria-label', 'data-test', 'target', 'rel', 'tabIndex', 'role']) {
      expect(isValidSettableAttrName(okAttr)).toBe(true);
    }
    for (const badAttr of [
      'onClick',
      'onload',
      'style',
      'className',
      'class',
      'key',
      'ref',
      'dangerouslySetInnerHTML',
      'data-rc-free',
    ]) {
      expect(isValidSettableAttrName(badAttr)).toBe(false);
    }
  });

  it('rejects script and foreignObject inside replaceSvg', () => {
    expect(
      ReplaceSvgEditSchema.safeParse({
        kind: 'replaceSvg',
        loc: 'a:1:1',
        tag: 'svg',
        icon: { name: 'heart', node: [['path', { d: 'M12 21' }]] },
      }).success,
    ).toBe(true);
    expect(
      AnyEditSchema.safeParse({
        kind: 'replaceSvg',
        loc: 'a:1:1',
        tag: 'svg',
        icon: { name: 'bad', node: [['script', {}]] },
      }).success,
    ).toBe(false);
    expect(
      ReplaceSvgEditSchema.safeParse({
        kind: 'replaceSvg',
        loc: 'a:1:1',
        tag: 'svg',
        icon: { name: 'bad', node: [['foreignObject', {}]] },
      }).success,
    ).toBe(false);
  });
});
