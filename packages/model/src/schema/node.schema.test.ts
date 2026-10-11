import { describe, expect, it } from 'vitest';

import type { Interaction } from './interaction.schema.ts';
import { DesignNodeSchema } from './node.schema.ts';
import { node, rulesOf } from './test-support.ts';

const rules = (value: unknown) => rulesOf(DesignNodeSchema.safeParse(value));
const click: Interaction = {
  id: 'i_aaaaaaaa',
  trigger: 'click',
  actions: [{ type: 'showToast', message: 'x', tone: 'info' }],
};

describe('DesignNodeSchema', () => {
  it('accepts a nested card with style, states and bindings', () => {
    const card = node('Card', {
      style: { gap: 'token:spacing.3', radius: 'token:radius.lg' },
      responsive: { md: { gap: 'token:spacing.6' } },
      states: { hover: { shadow: 'token:shadow.md' } },
      children: [
        node('Heading', { bindings: { text: { source: 'ds_products', field: 'name' } } }),
        node('Text'),
      ],
    });

    expect(DesignNodeSchema.safeParse(card).success).toBe(true);
  });

  it('needs the content kind of the node type [V-21]', () => {
    expect(rules(node('Text', { content: { kind: 'none' } }))).toContain('V-21');
    expect(rules(node('Card', { content: { kind: 'text', text: 'x' } }))).toContain('V-21');
    expect(rules(node('Divider'))).toEqual([]);
  });

  it('gives children to containers only [V-10]', () => {
    expect(rules(node('Text', { children: [node('Text')] }))).toContain('V-10');
    expect(rules(node('Stack', { children: [node('Text')] }))).toEqual([]);
  });

  it('gives slots to component instances only [V-18]', () => {
    expect(rules(node('Card', { slots: { actions: [] } }))).toContain('V-18');
    expect(rules(node('ComponentInstance', { slots: { actions: [node('Button')] } }))).toEqual([]);
  });

  it('needs exactly one child in a List [V-14]', () => {
    expect(rules(node('List', { children: [node('Card'), node('Card')] }))).toContain('V-14');
    expect(rules(node('List', { children: [node('Card')] }))).toEqual([]);
  });

  it('needs one Stack per tab item [V-15]', () => {
    expect(rules(node('Tabs', { children: [node('Stack')] }))).toEqual([]);
    expect(rules(node('Tabs', { children: [node('Card')] }))).toContain('V-15');
    expect(rules(node('Tabs', { children: [] }))).toContain('V-15');
  });

  it('accepts triggers on the node types that support them [V-90]', () => {
    expect(rules(node('Button', { interactions: [click] }))).toEqual([]);
    expect(rules(node('Divider', { interactions: [click] }))).toContain('V-90');
    expect(
      rules(node('Button', { interactions: [{ ...click, trigger: 'submitSuccess' }] })),
    ).toContain('V-90');
  });

  it('allows at most 10 interactions per node [V-96]', () => {
    const many = Array.from({ length: 11 }, (_, i) => ({
      ...click,
      id: `i_${String(i).padStart(8, '0')}`,
    }));

    expect(rules(node('Button', { interactions: many }))).toContain('V-96');
  });

  it('makes a link use either href or a click interaction [V-95]', () => {
    const viaClick = node('Link', {
      content: { kind: 'link', text: 'Go', href: '' },
      interactions: [click],
    });

    expect(rules(viaClick)).toEqual([]);
    expect(rules(node('Link', { interactions: [click] }))).toContain('V-95');
    expect(rules(node('Link', { content: { kind: 'link', text: 'Go', href: '' } }))).toContain(
      'V-95',
    );
  });

  it('forbids runs on a node with a text binding [V-35]', () => {
    const bound = node('Text', {
      content: { kind: 'text', text: 'Hi', runs: [{ text: 'Hi', bold: true }] },
      bindings: { text: { source: 'ds_products', field: 'name' } },
    });

    expect(rules(bound)).toContain('V-35');
  });

  it('matches propRef targets to node types without a binding on the same field [V-57]', () => {
    expect(rules(node('Image', { propRef: { prop: 'photo', target: 'src' } }))).toEqual([]);
    expect(rules(node('Text', { propRef: { prop: 'photo', target: 'src' } }))).toContain('V-57');
    const bound = node('Text', {
      propRef: { prop: 'title', target: 'text' },
      bindings: { text: { source: 'ds_products', field: 'name' } },
    });
    expect(rules(bound)).toContain('V-57');
  });

  it('reports rules found deep in the tree', () => {
    const tree = node('Stack', {
      children: [node('Card', { children: [node('Text', { children: [node('Text')] })] })],
    });

    expect(rules(tree)).toContain('V-10');
  });
});
