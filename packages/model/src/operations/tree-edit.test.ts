import { describe, expect, it } from 'vitest';

import allNodes from '../../../../fixtures/designs/all-nodes.json' with { type: 'json' };
import type { DesignDocument } from '../schema/document.schema.ts';
import { node } from '../schema/test-support.ts';
import { denormalize, normalize } from './normalize.ts';
import {
  collectIds,
  documentIds,
  findNode,
  insertAt,
  removeAt,
  setTreeRoot,
  updateAt,
} from './tree-edit.ts';

const document = allNodes as unknown as DesignDocument;
const trees = [...Object.values(document.pages), ...Object.values(document.components)].map(
  (t) => t.root,
);

describe('normalize and denormalize', () => {
  it('round-trip every tree of the all-nodes fixture', () => {
    for (const root of trees) {
      expect(denormalize(normalize(root))).toEqual(root);
    }
  });

  it('record parents, slot names and child ids', () => {
    const button = node('Button');
    const instance = node('ComponentInstance', { slots: { actions: [button] } });
    const root = node('Stack', { children: [instance] });

    const { rootId, nodes } = normalize(root);

    expect(rootId).toBe(root.id);
    expect(nodes[instance.id]).toMatchObject({
      parentId: root.id,
      childIds: [],
      slotChildIds: { actions: [button.id] },
    });
    expect(nodes[button.id]).toMatchObject({ parentId: instance.id, slotName: 'actions' });
  });
});

describe('tree edits', () => {
  const a = node('Text');
  const b = node('Text');
  const deep = node('Text');
  const card = node('Card', { children: [deep] });
  const root = node('Stack', { children: [a, card, b] });

  it('finds nodes in children and slots', () => {
    const inSlot = node('Button');
    const tree = node('Stack', {
      children: [node('ComponentInstance', { slots: { actions: [inSlot] } })],
    });

    expect(findNode(root, deep.id)?.steps).toEqual([{ index: 1 }, { index: 0 }]);
    expect(findNode(tree, inSlot.id)?.steps).toEqual([{ index: 0 }, { slot: 'actions', index: 0 }]);
    expect(findNode(root, 'n_missing000')).toBeUndefined();
  });

  it('copies only the path to the edit', () => {
    const location = findNode(root, deep.id);
    const updated = updateAt(root, location?.steps ?? [], (n) => ({ ...n, name: 'Edited' }));

    expect(updated).not.toBe(root);
    expect(updated.children?.[0]).toBe(a);
    expect(updated.children?.[2]).toBe(b);
    expect(updated.children?.[1]?.children?.[0]?.name).toBe('Edited');
    expect(root.children?.[1]?.children?.[0]?.name).toBeUndefined();
  });

  it('inserts and removes without touching the original', () => {
    const extra = node('Divider');
    const inserted = insertAt(root, [], undefined, 1, extra);
    const removed = removeAt(inserted, [{ index: 1 }]);

    expect(inserted.children?.map((n) => n.id)).toEqual([a.id, extra.id, card.id, b.id]);
    expect(removed.children).toEqual(root.children);
    expect(root.children).toHaveLength(3);
    expect(() => removeAt(root, [])).toThrow();
  });

  it('collects ids and replaces tree roots', () => {
    expect(collectIds(root)).toEqual(new Set([root.id, a.id, card.id, deep.id, b.id]));
    expect(documentIds(document).size).toBeGreaterThan(70);
    const target = { kind: 'page', pageId: 'p_home000001' } as const;
    const next = setTreeRoot(document, target, root);
    expect(next.pages['p_home000001']?.root).toBe(root);
    expect(next.pages['p_prod000001']).toBe(document.pages['p_prod000001']);
  });
});
