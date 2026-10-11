// fixtures/designs/all-nodes.json (SPEC-07 WP-0.07) is the reference document used by the Canvas,
// codegen and E2E tests. It must stay valid and keep covering every part of the schema.
import { describe, expect, it } from 'vitest';

import allNodes from '../../../../fixtures/designs/all-nodes.json' with { type: 'json' };
import { ContentPropsSchema } from './content.schema.ts';
import type { DesignDocument } from './document.schema.ts';
import { INTERACTION_ACTION_TYPES } from './interaction.schema.ts';
import { type DesignNode, NODE_TYPES } from './node.schema.ts';
import { StylePropsSchema } from './style.schema.ts';
import { walkTree } from './tree.ts';
import { BINDING_KEYS } from './validate/rules-data.ts';
import { checkDocument } from './validate/validate-document.ts';

const OPTIONS = {
  assetNames: new Set(['hero.jpg', 'logo.png', 'footer.jpg']),
  iconNames: new Set(['x', 'menu', 'arrow-right', 'shopping-cart', 'trash']),
};

const document = allNodes as unknown as DesignDocument;
const trees = [
  ...Object.values(document.pages).map((page) => page.root),
  ...Object.values(document.components).map((component) => component.root),
];
const nodes: DesignNode[] = [];
for (const root of trees) walkTree(root, (node) => nodes.push(node));

const styles = nodes.flatMap((node) => [node.style ?? {}, ...Object.values(node.responsive ?? {})]);
const actions = nodes.flatMap((node) => [
  ...(node.interactions ?? []).flatMap((interaction) => interaction.actions),
  ...(node.content?.kind === 'table'
    ? [
        ...(node.content.rowClick ?? []),
        ...(node.content.rowActions ?? []).flatMap((a) => a.actions),
      ]
    : []),
]);
const missing = (expected: readonly string[], present: Iterable<string>) => {
  const seen = new Set(present);
  return expected.filter((item) => !seen.has(item));
};

describe('fixtures/designs/all-nodes.json', () => {
  it('passes the schema and every document rule', () => {
    const result = checkDocument(allNodes, OPTIONS);

    expect(result.ok ? [] : result.error.details).toEqual([]);
  });

  it('uses every node type', () => {
    expect(
      missing(
        NODE_TYPES,
        nodes.map((node) => node.type),
      ),
    ).toEqual([]);
  });

  it('uses every style property and every content kind', () => {
    expect(missing(Object.keys(StylePropsSchema.shape), styles.flatMap(Object.keys))).toEqual([]);
    const kinds = ContentPropsSchema.options.map((option) => option.shape.kind.value);
    expect(
      missing(
        kinds,
        nodes.map((node) => node.content?.kind ?? 'none'),
      ),
    ).toEqual([]);
  });

  it('uses every interaction action and every binding key', () => {
    expect(
      missing(
        INTERACTION_ACTION_TYPES,
        actions.map((action) => action.type),
      ),
    ).toEqual([]);
    const bindingKeys = [
      ...new Set(Object.values(BINDING_KEYS).flatMap((keys) => Object.keys(keys))),
    ];
    expect(
      missing(
        bindingKeys,
        nodes.flatMap((node) => Object.keys(node.bindings ?? {})),
      ),
    ).toEqual([]);
  });

  it('uses states, responsive keys and runtime options', () => {
    expect(
      missing(
        ['hover', 'focus', 'disabled'],
        nodes.flatMap((node) => Object.keys(node.states ?? {})),
      ),
    ).toEqual([]);
    expect(
      missing(
        ['sm', 'md', 'lg', 'xl', '2xl'],
        nodes.flatMap((node) => Object.keys(node.responsive ?? {})),
      ),
    ).toEqual([]);
    expect(nodes.some((node) => node.runtime?.initiallyHidden === true)).toBe(true);
    expect(nodes.some((node) => node.hidden === true && node.locked === true)).toBe(true);
  });
});
