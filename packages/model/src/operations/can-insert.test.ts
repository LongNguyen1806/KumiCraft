import { describe, expect, it } from 'vitest';

import allNodes from '../../../../fixtures/designs/all-nodes.json' with { type: 'json' };
import type { DesignDocument, Page } from '../schema/document.schema.ts';
import type { DesignNode } from '../schema/node.schema.ts';
import { node } from '../schema/test-support.ts';
import { walkTree } from '../schema/tree.ts';
import { applyBatch } from './batch.ts';
import { canInsert } from './can-insert.ts';
import type { TreeTarget } from './operation.schema.ts';

const document = allNodes as unknown as DesignDocument;
const HOME = 'p_home000001';
const home: TreeTarget = { kind: 'page', pageId: HOME };
const root = (document.pages[HOME] as Page).root;

function first(
  type: DesignNode['type'],
  where: (n: DesignNode) => boolean = () => true,
): DesignNode {
  let found: DesignNode | undefined;
  walkTree(root, (n) => {
    if (found === undefined && n.type === type && where(n)) found = n;
  });
  if (found === undefined) throw new Error(`No ${type}`);
  return found;
}

const section = first('Section');
const card = first('Card');
const textNode = first('Text');
const listNode = first('List');

describe('canInsert validation rules', () => {
  it('blocks inserting child into leaf node [V-10]', () => {
    const res = canInsert(document, home, textNode.id, { kind: 'new', node: node('Button') }, 0);
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.error.details?.[0]?.rule).toBe('V-10');
    }
  });

  it('allows inserting child into container [V-10]', () => {
    const res = canInsert(document, home, section.id, { kind: 'new', node: node('Button') }, 0);
    expect(res.ok).toBe(true);
  });

  it('blocks Modal placed inside Card [V-12] [AC-02]', () => {
    const modalNode: DesignNode = {
      id: 'tmp_1',
      type: 'Modal',
      content: { kind: 'modal', title: 'Test Dialog' },
      children: [],
    };
    const res = canInsert(document, home, card.id, { kind: 'new', node: modalNode }, 0);
    expect(res.ok).toBe(false);
    if (!res.ok) {
      const rules = res.error.details?.map((d) => d.rule) ?? [];
      expect(rules).toContain('V-12');
    }
  });

  it('allows Modal placed directly in page root [V-12]', () => {
    const modalNode: DesignNode = {
      id: 'tmp_1',
      type: 'Modal',
      content: { kind: 'modal', title: 'Test Dialog' },
      children: [],
    };
    const res = canInsert(document, home, root.id, { kind: 'new', node: modalNode }, 0);
    expect(res.ok).toBe(true);
  });

  it('blocks List having more than 1 child [V-14]', () => {
    // List already has 1 child in all-nodes
    const res = canInsert(document, home, listNode.id, { kind: 'new', node: node('Card') }, 1);
    expect(res.ok).toBe(false);
    if (!res.ok) {
      const rules = res.error.details?.map((d) => d.rule) ?? [];
      expect(rules).toContain('V-14');
    }
  });

  it('blocks Tabs child that is not a Stack [V-15]', () => {
    const tabsNode: DesignNode = {
      id: 'tmp_tabs',
      type: 'Tabs',
      content: {
        kind: 'tabs',
        items: [{ id: 'tab1', label: 'T1' }],
      },
      children: [node('Card')],
    };
    const res = canInsert(document, home, section.id, { kind: 'new', node: tabsNode }, 0);
    expect(res.ok).toBe(false);
    if (!res.ok) {
      const rules = res.error.details?.map((d) => d.rule) ?? [];
      expect(rules).toContain('V-15');
    }
  });

  it('blocks moving the page root [V-20]', () => {
    const res = canInsert(document, home, section.id, { kind: 'move', nodeIds: [root.id] }, 0);
    expect(res.ok).toBe(false);
    if (!res.ok) {
      const rules = res.error.details?.map((d) => d.rule) ?? [];
      expect(rules).toContain('V-20');
    }
  });

  it('blocks moving a node into itself or its descendants [V-42]', () => {
    const res = canInsert(document, home, card.id, { kind: 'move', nodeIds: [card.id] }, 0);
    expect(res.ok).toBe(false);
    if (!res.ok) {
      const rules = res.error.details?.map((d) => d.rule) ?? [];
      expect(rules).toContain('V-42');
    }
  });

  it('blocks moving multiple nodes from different parents [R-DD-05]', () => {
    const cardChild = card.children?.[0] as DesignNode;
    const sectionChild = section.children?.[0] as DesignNode;
    const res = canInsert(
      document,
      home,
      section.id,
      { kind: 'move', nodeIds: [cardChild.id, sectionChild.id] },
      0,
    );
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.error.params?.rule).toBe('R-DD-05');
    }
  });

  it('allows moving siblings together [R-DD-05]', () => {
    const children = (section.children ?? []).filter((c) => c.type !== 'Modal');
    if (children.length >= 2) {
      const id1 = children[0]?.id as string;
      const id2 = children[1]?.id as string;
      const res = canInsert(document, home, section.id, { kind: 'move', nodeIds: [id1, id2] }, 0);
      expect(res.ok).toBe(true);
    }
  });

  it('property check: ok canInsert implies valid applyBatch', () => {
    const testCases: { parent: string; child: DesignNode; index: number }[] = [
      { parent: section.id, child: node('Divider'), index: 0 },
      { parent: card.id, child: node('Text'), index: 0 },
      { parent: root.id, child: node('Section'), index: 0 },
    ];

    for (const { parent, child, index } of testCases) {
      const result = canInsert(document, home, parent, { kind: 'new', node: child }, index);
      expect(result.ok).toBe(true);
      if (result.ok) {
        const op = { op: 'insert' as const, target: home, parentId: parent, index, node: child };
        const applied = applyBatch(document, [op]);
        expect(applied.ok).toBe(true);
      }
    }
  });
});
