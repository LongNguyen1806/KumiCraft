// Locked cases from the round 14 brief (giao-viec/p2-luot14-brand.md section 4), hand-computed.
import { describe, expect, it } from 'vitest';

import { applyThemeEdit, countTokenUses, isValidThemeValue } from './theme-edit.ts';

const CRLF_CSS =
  '@import "tailwindcss";\r\n\r\n@theme {\r\n  --color-brand: #1d4ed8; /* main */\r\n  --color-brand-soft: #dbeafe;\r\n}\r\n';

function value(r: ReturnType<typeof applyThemeEdit>): string {
  if (!r.ok) throw new Error(JSON.stringify(r.error));
  return r.value;
}

describe('theme edit, brief table [R-TH-11..14]', () => {
  it('#1 colour values', () => {
    const cases = ['#1d4ed8', '#abc', '#12', 'oklch(0.6 0.2 250)', 'rgb(1 2 3', 'red; }'];
    expect(cases.map((v) => isValidThemeValue('color', v))).toEqual([
      true,
      true,
      false,
      true,
      false,
      false,
    ]);
  });

  it('#2 lengths, font, shadow', () => {
    expect(['0.5rem', '8px', '0', '8', '1vw'].map((v) => isValidThemeValue('radius', v))).toEqual([
      true,
      true,
      true,
      false,
      false,
    ]);
    expect(isValidThemeValue('fontSize', '1.125rem')).toBe(true);
    expect(isValidThemeValue('font', '"Be Vietnam Pro", sans-serif')).toBe(true);
    expect(isValidThemeValue('shadow', '0 1px 2px rgb(0 0 0 / 0.1)')).toBe(true);
  });

  it('#3 set keeps every other byte (comment, CRLF, brand-soft)', () => {
    const out = value(
      applyThemeEdit(CRLF_CSS, { op: 'set', kind: 'color', name: 'brand', value: '#b91c1c' }),
    );
    expect(out).toBe(CRLF_CSS.replace('#1d4ed8', '#b91c1c'));
  });

  it('#3b set keeps the spacing the author used after the colon', () => {
    const css = '@theme {\n  --radius-card:1rem;\n  --radius-pill:   9999px;\n}\n';
    expect(
      value(applyThemeEdit(css, { op: 'set', kind: 'radius', name: 'card', value: '2rem' })),
    ).toBe(css.replace(':1rem', ':2rem'));
    expect(
      value(applyThemeEdit(css, { op: 'set', kind: 'radius', name: 'pill', value: '1px' })),
    ).toBe(css.replace('9999px', '1px'));
  });

  it('#4 add before the closing brace; add twice is tokenExists', () => {
    const out = value(
      applyThemeEdit(CRLF_CSS, { op: 'add', kind: 'color', name: 'accent', value: '#f59e0b' }),
    );
    expect(out).toBe(CRLF_CSS.replace('}\r\n', '  --color-accent: #f59e0b;\r\n}\r\n'));
    const again = applyThemeEdit(CRLF_CSS, {
      op: 'add',
      kind: 'color',
      name: 'brand',
      value: '#000',
    });
    expect(again.ok ? 'ok' : again.error.params).toEqual({ reason: 'tokenExists' });
  });

  it('#5 add creates a @theme block after the import', () => {
    const css = '@import "tailwindcss";\n.btn { color: red; }\n';
    expect(
      value(applyThemeEdit(css, { op: 'add', kind: 'radius', name: 'card', value: '1rem' })),
    ).toBe('@import "tailwindcss";\n\n@theme {\n  --radius-card: 1rem;\n}\n.btn { color: red; }\n');
  });

  it('#6 remove; missing token; --text-hero--line-height is not --text-hero', () => {
    expect(
      value(applyThemeEdit(CRLF_CSS, { op: 'remove', kind: 'color', name: 'brand-soft' })),
    ).toBe(CRLF_CSS.replace('  --color-brand-soft: #dbeafe;\r\n', ''));
    const missing = applyThemeEdit(CRLF_CSS, { op: 'remove', kind: 'color', name: 'nope' });
    expect(missing.ok ? 'ok' : missing.error.params).toEqual({ reason: 'tokenNotFound' });
    const css = '@theme {\n  --text-hero--line-height: 1.1;\n}\n';
    const hero = applyThemeEdit(css, { op: 'set', kind: 'fontSize', name: 'hero', value: '2rem' });
    expect(hero.ok ? 'ok' : hero.error.params).toEqual({ reason: 'tokenNotFound' });
  });

  it('#8 colour uses: variants, opacity, template literal; brand-soft is not brand', () => {
    const src =
      '<a className="bg-brand md:hover:text-brand/80 bg-brand-soft border-brand">x</a>; cn(`ring-brand`)';
    expect(countTokenUses(src, 'color', 'brand')).toBe(4);
  });

  it('#9 radius side prefixes and shadow with opacity', () => {
    expect(countTokenUses('rounded-card rounded-t-card rounded-cardx', 'radius', 'card')).toBe(2);
    expect(countTokenUses('shadow-soft hover:shadow-soft/50', 'shadow', 'soft')).toBe(2);
  });
});
