import { describe, expect, it } from 'vitest';

import allNodes from '../../../../fixtures/designs/all-nodes.json' with { type: 'json' };
import type { DesignDocument, Page } from '../schema/document.schema.ts';
import type { DesignNode } from '../schema/node.schema.ts';
import { node } from '../schema/test-support.ts';
import { walkTree } from '../schema/tree.ts';
import type { DesignOperation } from './operation.schema.ts';
import { validateOperation } from './validate-operation.ts';

const document = allNodes as unknown as DesignDocument;
const HOME = 'p_home000001';
const home = { kind: 'page', pageId: HOME } as const;
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

/** The rule codes reported, or [] when the operation is valid. */
function rules(op: DesignOperation, doc: DesignDocument = document): string[] {
  const result = validateOperation(doc, op);
  if (result.ok) return [];
  expect(result.error.code).toBe('E005');
  return [...new Set((result.error.details ?? []).map((detail) => detail.rule ?? 'none'))];
}

const section = first('Section');
const card = first('Card');
const modal = first('Modal');

describe('validateOperation accepts valid operations', () => {
  it('on nodes, pages, tokens and the workspace', () => {
    const ops: DesignOperation[] = [
      {
        op: 'setStyle',
        target: home,
        nodeId: card.id,
        scope: { breakpoint: 'md' },
        set: { gap: { px: 4 } },
      },
      { op: 'insert', target: home, parentId: root.id, index: 0, node: node('Divider') },
      {
        op: 'move',
        target: home,
        nodeId: (section.children?.[0] as DesignNode).id,
        newParentId: section.id,
        index: 2,
      },
      { op: 'page.update', pageId: HOME, title: 'Shop' },
      { op: 'token.set', group: 'spacing', name: '8', entry: { value: { px: 32 } } },
      { op: 'workspace.update', name: 'Renamed' },
    ];

    expect(ops.map((op) => rules(op))).toEqual(ops.map(() => []));
  });
});

describe('validateOperation rejects', () => {
  it('unknown nodes and out-of-range indexes [V-40, V-41]', () => {
    expect(rules({ op: 'remove', target: home, nodeId: 'n_missing000' })).toEqual(['V-40']);
    expect(
      rules({ op: 'insert', target: home, parentId: root.id, index: 99, node: node('Divider') }),
    ).toEqual(['V-41']);
    const sibling = section.children?.[0] as DesignNode;
    expect(
      rules({ op: 'move', target: home, nodeId: sibling.id, newParentId: section.id, index: 3 }),
    ).toEqual(['V-41']);
  });

  it('moves into itself, duplicate ids and removing the root [V-42, V-43, V-20]', () => {
    expect(
      rules({
        op: 'move',
        target: home,
        nodeId: section.id,
        newParentId: (section.children?.[0] as DesignNode).id,
        index: 0,
      }),
    ).toEqual(['V-42']);
    expect(
      rules({
        op: 'insert',
        target: home,
        parentId: root.id,
        index: 0,
        node: { ...node('Divider'), id: card.id },
      }),
    ).toEqual(['V-43']);
    expect(rules({ op: 'remove', target: home, nodeId: root.id })).toEqual(['V-20']);
  });

  it('wraps of non-adjacent nodes or into a non-empty wrapper [V-44]', () => {
    const [a, , c] = section.children ?? [];
    const ids = [(a as DesignNode).id, (c as DesignNode).id];
    expect(rules({ op: 'wrap', target: home, nodeIds: ids, wrapper: node('Stack') })).toEqual([
      'V-44',
    ]);
    const full = node('Stack', { children: [node('Text')] });
    expect(
      rules({ op: 'wrap', target: home, nodeIds: [(a as DesignNode).id], wrapper: full }),
    ).toEqual(['V-44']);
  });

  it('content kind changes [V-46]', () => {
    expect(
      rules({ op: 'setContent', target: home, nodeId: first('Text').id, set: { kind: 'heading' } }),
    ).toEqual(['V-46']);
  });

  it('deleting used tokens and components, or the last page [V-47, V-48, V-49]', () => {
    expect(rules({ op: 'token.delete', group: 'spacing', name: '4' })).toEqual(['V-47']);
    expect(rules({ op: 'component.delete', componentId: 'c_card000001' })).toEqual(['V-48']);
    const onePage = {
      ...document,
      pages: { [HOME]: document.pages[HOME] as Page },
      workspace: { ...document.workspace, pageOrder: [HOME] },
    };
    expect(rules({ op: 'page.delete', pageId: HOME }, onePage)).toEqual(['V-49']);
  });

  it('changing the responsive mode while nodes have responsive values [V-08]', () => {
    expect(rules({ op: 'workspace.update', responsiveMode: 'mobile-first' })).toEqual(['V-08']);
  });

  it('removing a node that an interaction targets [V-98]', () => {
    expect(rules({ op: 'remove', target: home, nodeId: modal.id })).toEqual(['V-98']);
  });

  it('results that break document rules [V-11, V-26, V-30, V-06, V-09]', () => {
    expect(
      rules({ op: 'insert', target: home, parentId: card.id, index: 0, node: node('Section') }),
    ).toEqual(['V-11']);
    expect(
      rules({
        op: 'setStyle',
        target: home,
        nodeId: first('Text').id,
        scope: {},
        set: { gap: { px: 4 } },
      }),
    ).toEqual(['V-26']);
    expect(
      rules({
        op: 'setBinding',
        target: home,
        nodeId: first('Text', (n) => n.content?.kind === 'text' && n.content.runs === undefined).id,
        key: 'text',
        binding: { source: 'ds_missing', field: 'x' },
      }),
    ).toEqual(['V-30']);
    expect(rules({ op: 'page.update', pageId: HOME, route: '/products/new' })).toEqual(['V-06']);
    expect(rules({ op: 'workspace.update', primaryFrameId: 'missing' })).toEqual(['V-09']);
  });

  it('unknown style properties and malformed operations', () => {
    expect(
      rules({
        op: 'setStyle',
        target: home,
        nodeId: card.id,
        scope: {},
        set: { color: '#000000' },
      }),
    ).toEqual(['none']);
    expect(rules({ op: 'explode' } as unknown as DesignOperation)).toEqual(['none']);
  });

  it('page operations on missing pages, clashing ids or bad indexes [V-40, V-41, V-43]', () => {
    const page = {
      schemaVersion: 1,
      id: HOME,
      name: 'Dup',
      route: '/dup',
      root: node('Stack'),
    } as const;
    expect(rules({ op: 'page.create', page, index: 0 })).toEqual(['V-40']);
    const reused = { ...page, id: 'p_newp000001', root: { ...node('Stack'), id: root.id } };
    expect(rules({ op: 'page.create', page: reused, index: 9 })).toEqual(['V-41', 'V-43']);
    expect(rules({ op: 'page.delete', pageId: 'p_none000001' })).toEqual(['V-40']);
    expect(rules({ op: 'page.update', pageId: 'p_none000001', name: 'X' })).toEqual(['V-40']);
    expect(rules({ op: 'page.reorder', pageId: HOME, index: 3 })).toEqual(['V-41']);
  });

  it('token renames and replaces that name missing or clashing tokens [V-40]', () => {
    expect(rules({ op: 'token.rename', group: 'spacing', from: 'none', to: 'x' })).toEqual([
      'V-40',
    ]);
    expect(rules({ op: 'token.rename', group: 'spacing', from: '2', to: '4' })).toEqual(['V-40']);
    expect(
      rules({ op: 'token.replace', group: 'spacing', from: '2', with: { token: '2' } }),
    ).toEqual(['V-40']);
    expect(
      rules({ op: 'token.replace', group: 'spacing', from: 'none', with: { value: { px: 1 } } }),
    ).toEqual(['V-40']);
    expect(rules({ op: 'token.delete', group: 'radius', name: 'none' })).toEqual(['V-40']);
  });

  it('component operations on missing or clashing components [V-40, V-43]', () => {
    const component = document.components['c_card000001'];
    expect(rules({ op: 'component.create', component: component as never })).toEqual([
      'V-40',
      'V-43',
    ]);
    expect(rules({ op: 'component.update', componentId: 'c_none000001', name: 'X' })).toEqual([
      'V-40',
    ]);
    expect(rules({ op: 'component.delete', componentId: 'c_none000001' })).toEqual(['V-40']);
  });

  it('reports the operation and the first rule in params', () => {
    const result = validateOperation(document, { op: 'remove', target: home, nodeId: root.id });

    expect(result).toMatchObject({
      ok: false,
      error: { code: 'E005', params: { op: 'remove', rule: 'V-20' } },
    });
  });
});
