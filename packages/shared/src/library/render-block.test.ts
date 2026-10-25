// Unit tests for renderBlock across all style systems (R-LB-11, R-ST-12).
import { describe, expect, it } from 'vitest';

import { STYLE_SYSTEM_IDS } from '../style.ts';
import { LIBRARY_BLOCKS } from './blocks.ts';
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

describe('renderBlock', () => {
  it('1. [R-ST-12] all 16 blocks have matching @key tokens in styles and bootstrap, and leave no @ after rendering in any system', () => {
    expect(LIBRARY_BLOCKS).toHaveLength(16);

    for (const block of LIBRARY_BLOCKS) {
      const viKeys = extractKeyTokens(block.neutral.jsx.vi);
      const enKeys = extractKeyTokens(block.neutral.jsx.en);
      expect(viKeys.length).toBeGreaterThan(0);
      expect(enKeys).toEqual(viKeys);

      for (const key of viKeys) {
        expect(block.neutral.styles[key], `${block.id} missing styles.${key}`).toBeDefined();
      }
      for (const bsKey of Object.keys(block.neutral.bootstrap)) {
        expect(viKeys, `${block.id} bootstrap.${bsKey} not in neutral.jsx`).toContain(bsKey);
      }

      for (const sys of [...STYLE_SYSTEM_IDS, undefined]) {
        for (const lang of ['vi', 'en'] as const) {
          const rendered = renderBlock(block, sys, lang);
          for (const cls of extractClassNames(rendered.jsx)) {
            expect(
              cls,
              `${block.id} (${String(sys)}, ${lang}) still has @ in className`,
            ).not.toContain('@');
          }
        }
      }
    }
  });

  it('2. [R-LB-11] tailwind4 and undefined return block.jsx[lang] byte-for-byte with empty rules for all 16 blocks', () => {
    for (const block of LIBRARY_BLOCKS) {
      for (const lang of ['vi', 'en'] as const) {
        const tw4 = renderBlock(block, 'tailwind4', lang);
        expect(tw4.jsx).toBe(block.jsx[lang]);
        expect(tw4.rules).toEqual([]);

        const undef = renderBlock(block, undefined, lang);
        expect(undef.jsx).toBe(block.jsx[lang]);
        expect(undef.rules).toEqual([]);
      }
    }
  });

  it('3. [R-ST-12] layout.row with css produces kc-row and kc-row-cell classes and .kc-row-cell rule with padding: 16px', () => {
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
      { selector: '.kc-row', declarations: rowBlock.neutral.styles['root'] },
      { selector: '.kc-row-cell', declarations: rowBlock.neutral.styles['cell'] },
      { selector: '.kc-row-text', declarations: rowBlock.neutral.styles['text'] },
    ]);
    const cellRule = vi.rules.find((r) => r.selector === '.kc-row-cell');
    expect(cellRule?.declarations['padding']).toBe('16px');
  });

  it('4. [R-ST-12] composite.card with bootstrap5 outputs Bootstrap classes and falls back to .kc-card-* rules for keys without Bootstrap classes', () => {
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
      { selector: '.kc-card-title', declarations: cardBlock.neutral.styles['title'] },
      { selector: '.kc-card-body', declarations: cardBlock.neutral.styles['body'] },
    ]);
  });

  it('5. [R-ST-12] tailwind3 translates shadow-sm to shadow and rounded-sm to rounded while preserving unmapped classes', () => {
    const cardBlock = LIBRARY_BLOCKS.find((b) => b.id === 'composite.card');
    expect(cardBlock).toBeDefined();
    if (cardBlock === undefined) return;

    const renderedCard = renderBlock(cardBlock, 'tailwind3', 'vi');
    expect(renderedCard.jsx).toContain(
      'className="p-6 bg-white border border-gray-200 rounded-xl shadow"',
    );
    expect(renderedCard.jsx).not.toContain('shadow-sm');
    expect(renderedCard.rules).toEqual([]);

    const customBlock: LibraryBlock = {
      ...cardBlock,
      jsx: {
        vi: '<div className="p-4 rounded-sm shadow-sm text-gray-900">Thẻ</div>',
        en: '<div className="p-4 rounded-sm shadow-sm text-gray-900">Card</div>',
      },
    };
    const renderedCustom = renderBlock(customBlock, 'tailwind3', 'vi');
    expect(renderedCustom.jsx).toBe('<div className="p-4 rounded shadow text-gray-900">Thẻ</div>');
    expect(renderedCustom.rules).toEqual([]);
  });
});
