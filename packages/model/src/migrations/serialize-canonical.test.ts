import { describe, expect, it } from 'vitest';

import allNodes from '../../../../fixtures/designs/all-nodes.json' with { type: 'json' };
import type { DesignDocument, Page } from '../schema/document.schema.ts';
import { serializeCanonical } from './serialize-canonical.ts';

const document = allNodes as unknown as DesignDocument;
const home = document.pages['p_home000001'] as Page;

/** Rebuilds every object with its keys in reverse order. */
function reverseKeys(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(reverseKeys);
  if (!(value instanceof Object)) return value;
  return Object.fromEntries(
    Object.entries(value)
      .reverse()
      .map(([key, item]) => [key, reverseKeys(item)]),
  );
}

describe('serializeCanonical', () => {
  it('gives byte-identical output whatever the input key order [R-DS-10]', () => {
    const once = serializeCanonical('page', home);
    const reversed = serializeCanonical('page', reverseKeys(home) as Page);

    expect(reversed).toBe(once);
    expect(serializeCanonical('page', JSON.parse(once) as Page)).toBe(once);
  });

  it('writes fields in schema declaration order [R-DS-07]', () => {
    const page = reverseKeys(home) as Page;

    const parsed = JSON.parse(serializeCanonical('page', page)) as Record<string, unknown>;

    expect(Object.keys(parsed)).toEqual([
      'schemaVersion',
      'id',
      'name',
      'route',
      'title',
      'description',
      'root',
    ]);
    const root = parsed['root'] as Record<string, unknown>;
    expect(Object.keys(root).indexOf('id')).toBe(0);
    expect(Object.keys(root).indexOf('type')).toBe(1);
  });

  it('sorts Record keys, and responsive keys by breakpoint [R-DS-08]', () => {
    const node = {
      id: 'n_sorted0001',
      type: 'Card' as const,
      content: { kind: 'none' as const },
      responsive: { '2xl': { gap: { px: 1 } }, sm: { gap: { px: 2 } }, lg: { gap: { px: 3 } } },
      states: { hover: { opacity: 50 }, disabled: { opacity: 40 }, focus: { opacity: 30 } },
      bindings: { text: { source: 'ds_b' }, alt: { source: 'ds_a' } },
    };
    const page: Page = { ...home, root: { ...home.root, children: [node] } };

    const text = serializeCanonical('page', page);
    const written = (JSON.parse(text) as Page).root.children?.[0];

    expect(Object.keys(written?.responsive ?? {})).toEqual(['sm', 'lg', '2xl']);
    expect(Object.keys(written?.states ?? {})).toEqual(['disabled', 'focus', 'hover']);
    expect(Object.keys(written?.bindings ?? {})).toEqual(['alt', 'text']);
  });

  it('sorts token names inside each group, keeping the group order of the schema', () => {
    const tokens = {
      ...document.tokens,
      color: { zeta: { value: '#000000' as const }, alpha: { value: '#ffffff' as const } },
    };

    const parsed = JSON.parse(
      serializeCanonical('tokens', reverseKeys(tokens) as typeof tokens),
    ) as Record<string, object>;

    expect(Object.keys(parsed)).toEqual([
      'schemaVersion',
      'color',
      'spacing',
      'radius',
      'shadow',
      'fontSize',
      'fontWeight',
      'lineHeight',
      'fontFamily',
    ]);
    expect(Object.keys(parsed['color'] ?? {})).toEqual(['alpha', 'zeta']);
  });

  it('uses 2-space indent, LF line ends and a final newline [R-DS-09]', () => {
    const text = serializeCanonical('workspace', document.workspace);

    expect(text.startsWith('{\n  "schemaVersion": 1,')).toBe(true);
    expect(text.endsWith('}\n')).toBe(true);
    expect(text).not.toContain('\r');
    expect(text.charCodeAt(0)).not.toBe(0xfeff);
  });

  it('serializes every file kind and refuses invalid data', () => {
    expect(serializeCanonical('dataSources', document.dataSources)).toContain('"entities"');
    expect(serializeCanonical('component', document.components['c_card000001'] as never)).toContain(
      '"ProductCard"',
    );
    expect(() => serializeCanonical('page', { ...home, route: 'Bad Route' })).toThrow(
      /invalid page/,
    );
  });
});
