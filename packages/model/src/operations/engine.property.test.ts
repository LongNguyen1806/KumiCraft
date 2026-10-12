// SPEC-07 WP-1.02 output: for every operation kind, applying the inverse restores the document.
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';

import allNodes from '../../../../fixtures/designs/all-nodes.json' with { type: 'json' };
import type { DesignDocument, Page } from '../schema/document.schema.ts';
import { CONTAINER_TYPES, type DesignNode } from '../schema/node.schema.ts';
import { walkTree } from '../schema/tree.ts';
import { applyBatch } from './batch.ts';
import { applyOperation, invertOperation } from './engine.ts';
import type { DesignOperation } from './operation.schema.ts';
import { validateOperation } from './validate-operation.ts';

const document = allNodes as unknown as DesignDocument;
const HOME = 'p_home000001';
const target = { kind: 'page', pageId: HOME } as const;
const root = (document.pages[HOME] as Page).root;

const nodes: DesignNode[] = [];
walkTree(root, (node) => nodes.push(node));
const nonRoot = nodes.filter((node) => node.id !== root.id);
const containers = nodes.filter((node) => CONTAINER_TYPES.has(node.type));
const wrappable = containers.filter(
  (node) => node.id !== root.id && (node.children?.length ?? 0) > 0,
);

let counter = 0;
const freshId = () => `n_prop${String(++counter).padStart(6, '0')}`;

const hex = fc.integer({ min: 0, max: 0xffffff }).map((n) => `#${n.toString(16).padStart(6, '0')}`);
const scope = fc.constantFrom(
  {},
  { breakpoint: 'md' as const },
  { breakpoint: 'sm' as const },
  { state: 'hover' as const },
);
const styleSet = fc.oneof(
  fc.record({ opacity: fc.integer({ min: 0, max: 20 }).map((n) => n * 5) }),
  fc.record({ background: hex }),
  fc.record({ textColor: hex }),
  fc.record({ radius: fc.integer({ min: 0, max: 64 }).map((px) => ({ px })) }),
);

const opArb: fc.Arbitrary<DesignOperation> = fc.oneof(
  fc
    .record({ node: fc.constantFrom(...nodes), scope, set: styleSet, drop: fc.boolean() })
    .map(({ node, scope: s, set, drop }): DesignOperation => ({
      op: 'setStyle',
      target,
      nodeId: node.id,
      scope: s,
      set,
      ...(drop ? { unset: ['shadow', 'opacity'] } : {}),
    })),
  fc
    .record({
      node: fc.constantFrom(...nodes),
      name: fc.string({ minLength: 1, maxLength: 20 }),
      hidden: fc.boolean(),
    })
    .map(({ node, name, hidden }): DesignOperation => ({
      op: 'setNodeMeta',
      target,
      nodeId: node.id,
      name,
      hidden,
    })),
  fc
    .record({
      node: fc.constantFrom(...nodes),
      hidden: fc.option(fc.boolean(), { nil: undefined }),
    })
    .map(({ node, hidden }): DesignOperation => ({
      op: 'setRuntime',
      target,
      nodeId: node.id,
      ...(hidden === undefined ? {} : { initiallyHidden: hidden }),
    })),
  fc
    .record({ parent: fc.constantFrom(...containers), index: fc.nat(6), text: fc.boolean() })
    .map(({ parent, index, text }): DesignOperation => ({
      op: 'insert',
      target,
      parentId: parent.id,
      index,
      node: text
        ? { id: freshId(), type: 'Text', content: { kind: 'text', text: 'Hi' } }
        : { id: freshId(), type: 'Divider', content: { kind: 'none' } },
    })),
  fc
    .constantFrom(...nonRoot)
    .map((node): DesignOperation => ({ op: 'remove', target, nodeId: node.id })),
  fc
    .record({
      node: fc.constantFrom(...nonRoot),
      parent: fc.constantFrom(...containers),
      index: fc.nat(6),
    })
    .map(({ node, parent, index }): DesignOperation => ({
      op: 'move',
      target,
      nodeId: node.id,
      newParentId: parent.id,
      index,
    })),
  fc
    .record({
      parent: fc.constantFrom(...wrappable),
      start: fc.nat(4),
      length: fc.integer({ min: 1, max: 2 }),
    })
    .map(({ parent, start, length }): DesignOperation => ({
      op: 'wrap',
      target,
      nodeIds: (parent.children ?? []).slice(start, start + length).map((child) => child.id),
      wrapper: { id: freshId(), type: 'Stack', content: { kind: 'none' } },
    })),
  fc
    .constantFrom(...wrappable)
    .map((node): DesignOperation => ({ op: 'unwrap', target, wrapperId: node.id })),
  fc
    .record({ name: fc.constantFrom('2', '9', 'xl'), px: fc.integer({ min: 0, max: 64 }) })
    .map(({ name, px }): DesignOperation => ({
      op: 'token.set',
      group: 'spacing',
      name,
      entry: { value: { px } },
    })),
  fc
    .record({ page: fc.constantFrom(...document.workspace.pageOrder), index: fc.nat(2) })
    .map(({ page, index }): DesignOperation => ({ op: 'page.reorder', pageId: page, index })),
  fc
    .string({ minLength: 1, maxLength: 30 })
    .map((name): DesignOperation => ({ op: 'workspace.update', name })),
);

describe('operation inverses (property)', () => {
  it('apply then invert restores the document, for every valid generated operation', () => {
    fc.assert(
      fc.property(opArb, (op) => {
        fc.pre(validateOperation(document, op).ok);
        const inverse = invertOperation(document, op);

        const restored = applyOperation(applyOperation(document, op), inverse);

        expect(restored).toEqual(document);
      }),
      { numRuns: 400 },
    );
  }, 30_000);

  it('undoing a whole batch restores the document', () => {
    fc.assert(
      fc.property(fc.array(opArb, { minLength: 1, maxLength: 6 }), (ops) => {
        const result = applyBatch(document, ops);
        fc.pre(result.ok);

        const restored = result.value.inverse.reduce(applyOperation, result.value.doc);

        expect(restored).toEqual(document);
      }),
      { numRuns: 150 },
    );
  }, 30_000);

  it('generates valid operations of every kind, so the properties are not vacuous', () => {
    const validKinds = new Set(
      fc
        .sample(opArb, 2000)
        .filter((op) => validateOperation(document, op).ok)
        .map((op) => op.op),
    );

    expect([...validKinds].sort()).toEqual(
      [
        'insert',
        'move',
        'page.reorder',
        'remove',
        'setNodeMeta',
        'setRuntime',
        'setStyle',
        'token.set',
        'unwrap',
        'workspace.update',
        'wrap',
      ].sort(),
    );
  }, 30_000);
});
