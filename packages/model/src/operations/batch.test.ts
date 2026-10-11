import { describe, expect, it } from 'vitest';

import allNodes from '../../../../fixtures/designs/all-nodes.json' with { type: 'json' };
import type { DesignDocument, Page } from '../schema/document.schema.ts';
import { applyBatch, assignIds } from './batch.ts';
import { applyOperation } from './engine.ts';
import type { DesignOperation } from './operation.schema.ts';

const document = allNodes as unknown as DesignDocument;
const HOME = 'p_home000001';
const home = { kind: 'page', pageId: HOME } as const;
const rootId = (document.pages[HOME] as Page).root.id;

const divider = (id: string) => ({
  id,
  type: 'Divider' as const,
  content: { kind: 'none' as const },
});

describe('applyBatch', () => {
  it('applies every operation and returns the inverse in reverse order [V-51]', () => {
    const ops: DesignOperation[] = [
      { op: 'insert', target: home, parentId: rootId, index: 0, node: divider('n_batch00001') },
      { op: 'setNodeMeta', target: home, nodeId: 'n_batch00001', name: 'Line' },
    ];

    const result = applyBatch(document, ops);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.inverse.map((op) => op.op)).toEqual(['setNodeMeta', 'remove']);
    const undone = result.value.inverse.reduce(applyOperation, result.value.doc);
    expect(undone).toEqual(document);
  });

  it('stops at the first invalid operation and leaves the document unchanged [V-50]', () => {
    const snapshot = JSON.stringify(document);
    const ops: DesignOperation[] = [
      { op: 'insert', target: home, parentId: rootId, index: 0, node: divider('n_batch00002') },
      { op: 'remove', target: home, nodeId: 'n_missing000' },
      { op: 'insert', target: home, parentId: rootId, index: 0, node: divider('n_batch00003') },
    ];

    const result = applyBatch(document, ops);

    expect(result).toMatchObject({
      ok: false,
      error: { code: 'E005', params: { index: 1, op: 'remove' } },
    });
    expect(JSON.stringify(document)).toBe(snapshot);
  });
});

describe('assignIds', () => {
  let counter = 0;
  const generate = (kind: 'node' | 'page' | 'interaction') =>
    kind === 'interaction'
      ? `i_gen${String(++counter).padStart(5, '0')}`
      : `${kind[0] ?? 'x'}_gen${String(++counter).padStart(7, '0')}`;

  it('replaces temporary ids and every reference to them', () => {
    const ops = [
      {
        op: 'insert',
        target: home,
        parentId: rootId,
        index: 0,
        node: {
          id: 'tmp_1',
          type: 'Stack',
          content: { kind: 'none' },
          children: [{ id: 'tmp_2', type: 'Modal', content: { kind: 'modal', title: 'Hi' } }],
        },
      },
      {
        op: 'setInteractions',
        target: home,
        nodeId: 'tmp_1',
        interactions: [
          { id: 'tmp_3', trigger: 'click', actions: [{ type: 'openModal', modalId: 'tmp_2' }] },
        ],
      },
    ] as unknown as DesignOperation[];

    const { ops: assigned, idMap } = assignIds(ops, generate);

    expect(idMap).toEqual({ tmp_1: 'n_gen0000001', tmp_2: 'n_gen0000002', tmp_3: 'i_gen00003' });
    expect(JSON.stringify(assigned)).not.toContain('tmp_');
    expect(assigned[1]).toMatchObject({
      nodeId: 'n_gen0000001',
      interactions: [{ actions: [{ modalId: 'n_gen0000002' }] }],
    });
  });

  it('gives new pages a page id and keeps real ids', () => {
    const ops = [
      {
        op: 'page.create',
        index: 0,
        page: {
          schemaVersion: 1,
          id: 'tmp_9',
          name: 'New',
          route: '/new',
          root: { id: 'tmp_10', type: 'Stack', content: { kind: 'none' } },
        },
      },
      { op: 'remove', target: home, nodeId: rootId },
    ] as unknown as DesignOperation[];

    const { idMap, ops: assigned } = assignIds(ops);

    expect(idMap['tmp_9']).toMatch(/^p_[A-Za-z0-9_-]{10}$/);
    expect(idMap['tmp_10']).toMatch(/^n_[A-Za-z0-9_-]{10}$/);
    expect(assigned[1]).toEqual(ops[1]);
  });
});
