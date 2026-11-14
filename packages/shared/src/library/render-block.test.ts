// Unit tests for renderBlock across all style systems, look roles, variants, and responsive classes (R-LB-11, R-ST-12, TK-43, TK-47, TK-48).
import { describe, expect, it } from 'vitest';

import type { ThemeInfo } from '../project.ts';
import { STYLE_SYSTEM_IDS } from '../style.ts';
import { LIBRARY_BLOCKS } from './blocks.ts';
import { lookFromTheme } from './project-look.ts';
import { renderBlock } from './render-block.ts';
import type { LibraryBlock } from './types.ts';

function extractKeyTokens(jsx: string): string[] {
  const keys: string[] = [];
  for (const match of jsx.matchAll(/className="@([a-zA-Z0-9_-]+)"/g)) {
    const key = match[1];
    if (key !== undefined && !keys.includes(key)) {
      keys.push(key);
    }
  }
  return keys;
}

function extractClassNames(jsx: string): string[] {
  const classes: string[] = [];
  for (const match of jsx.matchAll(/className="([^"]*)"/g)) {
    if (match[1] !== undefined) {
      classes.push(match[1]);
    }
  }
  return classes;
}

function makeTheme(overrides: Partial<ThemeInfo> = {}): ThemeInfo {
  return {
    colors: [],
    fontSizes: [],
    radii: [],
    fonts: [],
    shadows: [],
    breakpoints: [],
    ...overrides,
  };
}

describe('renderBlock', () => {
  it('1. [R-ST-12] all 76 blocks and variants have matching @key tokens and leave no @ or {role} after rendering in any system', () => {
    expect(LIBRARY_BLOCKS).toHaveLength(76);

    for (const block of LIBRARY_BLOCKS) {
      const variants = [undefined, ...(block.variants?.map((v) => v.id) ?? [])];
      for (const variantId of variants) {
        const neutral =
          variantId !== undefined
            ? block.variants?.find((v) => v.id === variantId)?.neutral
            : block.neutral;
        expect(neutral).toBeDefined();
        if (neutral === undefined) continue;

        const viKeys = extractKeyTokens(neutral.jsx.vi);
        const enKeys = extractKeyTokens(neutral.jsx.en);
        expect(viKeys.length).toBeGreaterThan(0);
        expect(enKeys).toEqual(viKeys);

        for (const key of viKeys) {
          expect(
            neutral.styles[key],
            `${block.id}:${String(variantId)} missing styles.${key}`,
          ).toBeDefined();
        }
        for (const bsKey of Object.keys(neutral.bootstrap)) {
          expect(
            viKeys,
            `${block.id}:${String(variantId)} bootstrap.${bsKey} not in neutral.jsx`,
          ).toContain(bsKey);
        }

        for (const sys of [...STYLE_SYSTEM_IDS, undefined]) {
          for (const lang of ['vi', 'en'] as const) {
            const rendered = renderBlock(block, sys, lang, undefined, variantId);
            expect(
              rendered.jsx,
              `${block.id}:${String(variantId)} (${String(sys)}) left {role}`,
            ).not.toMatch(/\{[a-zA-Z0-9_-]+\}/);
            for (const cls of extractClassNames(rendered.jsx)) {
              expect(
                cls,
                `${block.id}:${String(variantId)} (${String(sys)}, ${lang}) still has @ in className`,
              ).not.toContain('@');
            }
          }
        }
      }
    }
  });

  it('2. [R-LB-11] tailwind4 and undefined resolve roles identically with empty rules for all 16 blocks', () => {
    for (const block of LIBRARY_BLOCKS) {
      for (const lang of ['vi', 'en'] as const) {
        const tw4 = renderBlock(block, 'tailwind4', lang);
        const undef = renderBlock(block, undefined, lang);
        expect(tw4.jsx).toBe(undef.jsx);
        expect(tw4.rules).toEqual([]);
        expect(undef.rules).toEqual([]);
        expect(tw4.jsx).not.toMatch(/\{[a-zA-Z0-9_-]+\}/);
      }
    }
  });

  it('3. [R-ST-12] layout.row with css produces kc-row and kc-row-cell classes and resolved default declarations', () => {
    const rowBlock = LIBRARY_BLOCKS.find((b) => b.id === 'layout.row');
    expect(rowBlock).toBeDefined();
    if (rowBlock === undefined) return;

    const vi = renderBlock(rowBlock, 'css', 'vi');
    const en = renderBlock(rowBlock, 'css', 'en');

    expect(vi.jsx).toContain('className="kc-row"');
    expect(vi.jsx).toContain('className="kc-row-cell"');
    expect(vi.jsx).not.toBe(en.jsx);
    expect(extractClassNames(vi.jsx)).toEqual(extractClassNames(en.jsx));

    expect(vi.rules).toEqual([
      { selector: '.kc-row', declarations: { display: 'flex', 'flex-wrap': 'wrap', gap: '16px' } },
      {
        selector: '.kc-row-cell',
        declarations: {
          flex: '1 1 240px',
          padding: '16px',
          'background-color': '#f9fafb',
          'border-radius': '8px',
        },
      },
      {
        selector: '.kc-row-text',
        declarations: { 'font-size': '14px', 'line-height': '20px', color: '#4b5563' },
      },
    ]);
  });

  it('4. [R-ST-12] composite.card with bootstrap5 outputs Bootstrap classes and falls back to resolved .kc-card-* rules', () => {
    const cardBlock = LIBRARY_BLOCKS.find((b) => b.id === 'composite.card');
    expect(cardBlock).toBeDefined();
    if (cardBlock === undefined) return;

    const fullBs = renderBlock(cardBlock, 'bootstrap5', 'vi');
    expect(fullBs.jsx).toContain('card card-body');
    expect(fullBs.jsx).toContain('btn btn-primary');
    expect(fullBs.rules).toEqual([]);

    const partialCard: LibraryBlock = {
      ...cardBlock,
      neutral: {
        ...cardBlock.neutral,
        bootstrap: {
          root: 'card card-body',
          action: 'btn btn-primary',
        },
      },
    };
    const partialBs = renderBlock(partialCard, 'bootstrap5', 'vi');
    expect(partialBs.jsx).toContain('className="card card-body"');
    expect(partialBs.jsx).toContain('className="btn btn-primary"');
    expect(partialBs.jsx).toContain('className="kc-card-title"');
    expect(partialBs.jsx).toContain('className="kc-card-body"');
    expect(partialBs.rules).toEqual([
      {
        selector: '.kc-card-title',
        declarations: {
          'font-size': '18px',
          'line-height': '28px',
          'font-weight': '600',
          color: '#111827',
          'margin-bottom': '8px',
        },
      },
      {
        selector: '.kc-card-body',
        declarations: {
          'font-size': '14px',
          'line-height': '20px',
          color: '#4b5563',
          'margin-bottom': '16px',
        },
      },
    ]);
  });

  it('5. [TK-43, R-ST-12] tailwind3 resolves roles first, then translates v4 utility names (rounded-sm -> rounded, shadow-sm -> shadow)', () => {
    const cardBlock = LIBRARY_BLOCKS.find((b) => b.id === 'composite.card');
    expect(cardBlock).toBeDefined();
    if (cardBlock === undefined) return;

    const themeLook = lookFromTheme(
      makeTheme({
        colors: [{ name: 'brand', value: '#3b82f6' }],
        radii: [{ name: 'md', value: '6px' }],
      }),
    );
    const renderedCard = renderBlock(cardBlock, 'tailwind3', 'vi', themeLook);
    expect(renderedCard.jsx).toContain(
      'className="min-w-0 p-6 bg-white border border-gray-200 rounded-md shadow"',
    );
    expect(renderedCard.jsx).toContain('text-brand');
    expect(renderedCard.jsx).not.toContain('shadow-sm');

    const smRadiusLook = { roles: { radius: { tailwind: 'sm', css: '4px' } } };
    const renderedSm = renderBlock(cardBlock, 'tailwind3', 'vi', smRadiusLook);
    expect(renderedSm.jsx).toContain(
      'className="min-w-0 p-6 bg-white border border-gray-200 rounded shadow"',
    );
    expect(renderedSm.jsx).not.toContain('rounded-sm');
    expect(renderedSm.rules).toEqual([]);
  });

  it('6. [TK-43] plain css with look emits var(--...) declarations in rules', () => {
    const buttonBlock = LIBRARY_BLOCKS.find((b) => b.id === 'form.button');
    expect(buttonBlock).toBeDefined();
    if (buttonBlock === undefined) return;

    const look = lookFromTheme(
      makeTheme({
        colors: [{ name: 'brand', value: '#2563eb', variable: '--brand' }],
        radii: [{ name: 'radius', value: '8px', variable: '--radius' }],
      }),
    );
    const rendered = renderBlock(buttonBlock, 'css', 'vi', look);
    expect(rendered.jsx).toContain('className="kc-button"');
    expect(rendered.rules).toEqual([
      {
        selector: '.kc-button',
        declarations: {
          padding: '8px 16px',
          'background-color': 'var(--brand)',
          color: '#ffffff',
          'border-radius': 'var(--radius)',
          'font-weight': '500',
          border: 'none',
        },
      },
    ]);
  });

  it('7. [TK-43] bootstrap5 keeps Bootstrap classes for form.button and its variants', () => {
    const buttonBlock = LIBRARY_BLOCKS.find((b) => b.id === 'form.button');
    expect(buttonBlock).toBeDefined();
    if (buttonBlock === undefined) return;

    const look = lookFromTheme(
      makeTheme({ colors: [{ name: 'brand', value: '#2563eb', variable: '--brand' }] }),
    );
    const solid = renderBlock(buttonBlock, 'bootstrap5', 'en', look);
    expect(solid.jsx).toContain('className="btn btn-primary"');
    expect(solid.rules).toEqual([]);

    const outline = renderBlock(buttonBlock, 'bootstrap5', 'en', look, 'outline');
    expect(outline.jsx).toContain('className="btn btn-outline-primary"');
    expect(outline.rules).toEqual([]);
  });

  it('8. [TK-47] variants: form.button + outline differs from default; unknown variantId falls back to default', () => {
    const buttonBlock = LIBRARY_BLOCKS.find((b) => b.id === 'form.button');
    expect(buttonBlock).toBeDefined();
    if (buttonBlock === undefined) return;

    const def = renderBlock(buttonBlock, 'tailwind4', 'en');
    const outline = renderBlock(buttonBlock, 'tailwind4', 'en', undefined, 'outline');
    const unknown = renderBlock(buttonBlock, 'tailwind4', 'en', undefined, 'non-existent');

    expect(outline.jsx).not.toBe(def.jsx);
    expect(outline.jsx).toContain('border');
    expect(outline.jsx).not.toContain('bg-blue-600');
    expect(unknown.jsx).toBe(def.jsx);

    const cssDef = renderBlock(buttonBlock, 'css', 'en');
    const cssOutline = renderBlock(buttonBlock, 'css', 'en', undefined, 'outline');
    expect(cssOutline.jsx).toContain('kc-button-outline');
    expect(cssOutline.rules[0]?.selector).toBe('.kc-button-outline');
    expect(cssOutline.rules[0]?.selector).not.toBe(cssDef.rules[0]?.selector);
  });

  it('10. [TK-48] no Tailwind block or variant uses sm:, md:, lg:, xl:, or max- breakpoint prefixes (except max-w-*)', () => {
    const forbiddenPrefixRe = /(?:^|\s)(?:sm:|md:|lg:|xl:|max-(?!w-))/;
    for (const block of LIBRARY_BLOCKS) {
      const variants = [undefined, ...(block.variants?.map((v) => v.id) ?? [])];
      for (const variantId of variants) {
        for (const lang of ['vi', 'en'] as const) {
          const rendered = renderBlock(block, 'tailwind4', lang, undefined, variantId);
          for (const cls of extractClassNames(rendered.jsx)) {
            expect(
              cls,
              `${block.id}:${String(variantId)} (${lang}) has forbidden responsive prefix: ${cls}`,
            ).not.toMatch(forbiddenPrefixRe);
          }
        }
      }
    }
  });

  it('18. [TK-44] renderBlock with uiKit uses <Button variant="outline"> + alias import, falls back when card missing', () => {
    const buttonBlock = LIBRARY_BLOCKS.find((b) => b.id === 'form.button');
    const cardBlock = LIBRARY_BLOCKS.find((b) => b.id === 'composite.card');
    expect(buttonBlock).toBeDefined();
    expect(cardBlock).toBeDefined();
    if (buttonBlock === undefined || cardBlock === undefined) return;

    const uiKit = {
      kind: 'shadcn' as const,
      uiDir: 'src/components/ui',
      importBase: '@/components/ui',
      components: ['button'],
    };

    const btnRendered = renderBlock(buttonBlock, 'tailwind4', 'en', undefined, 'outline', uiKit);
    expect(btnRendered.usedUiKit).toBe(true);
    expect(btnRendered.jsx).toContain('<Button variant="outline"');
    expect(btnRendered.imports).toEqual(["import { Button } from '@/components/ui/button';"]);

    const cardFallback = renderBlock(cardBlock, 'tailwind4', 'en', undefined, undefined, uiKit);
    expect(cardFallback.usedUiKit).toBeUndefined();
    expect(cardFallback.imports).toBeUndefined();
    expect(cardFallback.jsx).toContain('<div ');
    expect(cardFallback.jsx).not.toContain('<Card');
  });

  it('19. [K9.7-3] semantic attributes (form htmlFor/id, video title, breadcrumb aria-label) and shadcn interactive tabs', () => {
    const newFormIds = new Set([
      'form.textarea',
      'form.select',
      'form.checkbox',
      'form.radio-group',
      'form.switch',
      'form.search',
      'form.date',
      'form.file',
    ]);
    for (const block of LIBRARY_BLOCKS.filter((b) => newFormIds.has(b.id))) {
      const rendered = renderBlock(block, 'tailwind4', 'vi').jsx;
      const htmlForId = /htmlFor="([^"]+)"/.exec(rendered)?.[1];
      expect(htmlForId, `${block.id} missing htmlFor`).toBeDefined();
      if (htmlForId !== undefined) {
        expect(rendered, `${block.id} missing matching id`).toContain(`id="${htmlForId}"`);
      }
    }
    const video = LIBRARY_BLOCKS.find((b) => b.id === 'content.video');
    expect(video).toBeDefined();
    if (video !== undefined) {
      expect(renderBlock(video, 'tailwind4', 'en').jsx).toMatch(/<iframe[^>]+title="[^"]+"/);
    }
    const crumb = LIBRARY_BLOCKS.find((b) => b.id === 'navigation.breadcrumb');
    expect(crumb).toBeDefined();
    if (crumb !== undefined) {
      expect(renderBlock(crumb, 'tailwind4', 'en').jsx).toMatch(/<nav[^>]+aria-label="[^"]+"/);
    }

    const tabs = LIBRARY_BLOCKS.find((b) => b.id === 'interactive.tabs');
    expect(tabs).toBeDefined();
    if (tabs !== undefined) {
      const kitResult = renderBlock(tabs, 'tailwind4', 'en');
      expect(kitResult.kit).toEqual({ components: ['Tabs', 'Tab'] });

      const shadcnResult = renderBlock(tabs, 'tailwind4', 'en', undefined, undefined, {
        kind: 'shadcn',
        uiDir: 'src/components/ui',
        importBase: '@/components/ui',
        components: ['tabs'],
      });
      expect(shadcnResult.usedUiKit).toBe(true);
      expect(shadcnResult.kit).toBeUndefined();
      expect(shadcnResult.imports).toEqual([
        "import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';",
      ]);
      expect(shadcnResult.jsx).toContain('<Tabs ');
    }
  });
});
