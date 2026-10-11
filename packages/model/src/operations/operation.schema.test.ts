import { describe, expect, it } from 'vitest';

import { DesignOperationSchema, OperationBatchSchema } from './operation.schema.ts';

const target = { kind: 'page', pageId: 'p_home000001' };
const ok = (value: unknown) => DesignOperationSchema.safeParse(value).success;

describe('DesignOperationSchema', () => {
  it('parses the example of SPEC-03 section 7.2', () => {
    expect(
      ok({
        op: 'setStyle',
        target,
        nodeId: 'n_Card000001',
        scope: { breakpoint: 'md' },
        set: { gap: 'token:spacing.4' },
        unset: ['shadow'],
      }),
    ).toBe(true);
  });

  it('parses one operation of each group', () => {
    const samples = [
      {
        op: 'insert',
        target,
        parentId: 'n_0000000001',
        index: 0,
        node: { id: 'n_0000000002', type: 'Divider', content: { kind: 'none' } },
      },
      {
        op: 'move',
        target: { kind: 'component', componentId: 'c_card000001' },
        nodeId: 'n_0000000002',
        newParentId: 'n_0000000001',
        index: 1,
        slotName: 'actions',
      },
      { op: 'page.update', pageId: 'p_home000001', name: 'Home', unset: ['title'] },
      { op: 'token.replace', group: 'spacing', from: 'gap-lg', with: { value: { px: 24 } } },
      { op: 'component.delete', componentId: 'c_card000001' },
      { op: 'workspace.update', darkMode: 'class' },
      {
        op: 'node.restoreValues',
        entries: [{ target, nodeId: 'n_0000000002', path: ['style', 'gap'], value: { px: 8 } }],
      },
    ];

    expect(samples.filter((sample) => !ok(sample))).toEqual([]);
  });

  it('rejects unknown operations and fields', () => {
    expect(ok({ op: 'eval', code: 'x' })).toBe(false);
    expect(ok({ op: 'remove', target, nodeId: 'n_0000000001', extra: 1 })).toBe(false);
  });

  it('allows states only at the base breakpoint [V-28]', () => {
    const setStyle = (scope: object) =>
      ok({ op: 'setStyle', target, nodeId: 'n_0000000001', scope, set: {} });

    expect(setStyle({ state: 'hover' })).toBe(true);
    expect(setStyle({ breakpoint: 'base', state: 'hover' })).toBe(true);
    expect(setStyle({ breakpoint: 'md', state: 'hover' })).toBe(false);
  });
});

describe('OperationBatchSchema', () => {
  const op = { op: 'remove', target, nodeId: 'n_0000000001' };
  const batch = (ops: unknown[]) =>
    OperationBatchSchema.safeParse({
      baseRevision: 3,
      ops,
      meta: { source: 'user', label: 'Delete' },
    }).success;

  it('holds 1 to 500 operations', () => {
    expect(batch([op])).toBe(true);
    expect(batch([])).toBe(false);
    expect(batch(Array.from({ length: 501 }, () => op))).toBe(false);
  });
});
