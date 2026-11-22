// Unit tests for composite CSS merging and the K9.7-2 schemas (TK-10..17).
import { describe, expect, it } from 'vitest';

import {
  AnyEditSchema,
  extractCompositeSubValue,
  isValidSettableAttrName,
  mergeCompositeCssDeclaration,
  ReplaceSvgEditSchema,
  SetTagEditSchema,
} from './index.ts';

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
