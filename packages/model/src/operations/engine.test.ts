import { describe, expect, it } from 'vitest';

import allNodes from '../../../../fixtures/designs/all-nodes.json' with { type: 'json' };
import type { DesignDocument, Page } from '../schema/document.schema.ts';
import type { DesignNode } from '../schema/node.schema.ts';
import { node } from '../schema/test-support.ts';
import { walkTree } from '../schema/tree.ts';
import { applyOperation, invertOperation } from './engine.ts';
import type { DesignOperation } from './operation.schema.ts';
import { findTokenUses } from './token-refs.ts';

const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

function deepFreeze<T>(value: T): T {
  if (value instanceof Object && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const item of Object.values(value)) deepFreeze(item);
  }
  return value;
}

/** Frozen: any in-place change by the engine throws. */
const document = deepFreeze(clone(allNodes) as unknown as DesignDocument);
const HOME = 'p_home000001';
const FORM = 'p_form000001';
const CARD = 'c_card000001';
const home = { kind: 'page', pageId: HOME } as const;
const homeRoot = (document.pages[HOME] as Page).root;

function first(
  type: DesignNode['type'],
  root = homeRoot,
  where: (n: DesignNode) => boolean = () => true,
): DesignNode {
  let found: DesignNode | undefined;
  walkTree(root, (n) => {
    if (found === undefined && n.type === type && where(n)) found = n;
  });
  if (found === undefined) throw new Error(`No ${type}`);
  return found;
}

/** Applies `op`, checks something changed, then checks that its inverse restores the document. */
function roundTrip(op: DesignOperation): DesignDocument {
  const inverse = invertOperation(document, op);
  const next = applyOperation(document, op);

  expect(next).not.toEqual(document);
  expect(applyOperation(next, inverse)).toEqual(document);
  return next;
}

const section = first('Section');
const instance = first('ComponentInstance');

describe('node tree operations', () => {
  it('insert and remove', () => {
    const divider = node('Divider');
    const next = roundTrip({
      op: 'insert',
      target: home,
      parentId: homeRoot.id,
      index: 0,
      node: divider,
    });

    expect((next.pages[HOME] as Page).root.children?.[0]).toBe(divider);
    roundTrip({ op: 'remove', target: home, nodeId: first('Text').id });
    roundTrip({
      op: 'remove',
      target: home,
      nodeId: (instance.slots?.['actions']?.[0] as DesignNode).id,
    });
  });

  it('move across parents, inside one parent and into a slot', () => {
    const button = first('Button', section);
    roundTrip({ op: 'move', target: home, nodeId: button.id, newParentId: homeRoot.id, index: 1 });
    roundTrip({
      op: 'move',
      target: home,
      nodeId: (section.children?.[0] as DesignNode).id,
      newParentId: section.id,
      index: 2,
    });
    roundTrip({
      op: 'move',
      target: home,
      nodeId: button.id,
      newParentId: instance.id,
      index: 0,
      slotName: 'actions',
    });
  });

  it('wrap adjacent siblings and unwrap a container', () => {
    const [a, b] = section.children ?? [];
    const wrapper = node('Stack', { style: { direction: 'row' } });
    const next = roundTrip({
      op: 'wrap',
      target: home,
      nodeIds: [(a as DesignNode).id, (b as DesignNode).id],
      wrapper,
    });

    expect(
      first('Stack', (next.pages[HOME] as Page).root, (n) => n.id === wrapper.id).children,
    ).toEqual([a, b]);
    roundTrip({ op: 'unwrap', target: home, wrapperId: first('Container').id });
  });
});

describe('node property operations', () => {
  const card = first('Card');

  it('setStyle at base, a breakpoint and a state, with unset', () => {
    roundTrip({
      op: 'setStyle',
      target: home,
      nodeId: card.id,
      scope: {},
      set: { gap: { px: 4 } },
      unset: ['radius'],
    });
    roundTrip({
      op: 'setStyle',
      target: home,
      nodeId: card.id,
      scope: { breakpoint: 'md' },
      set: { gap: { px: 2 } },
    });
    const next = roundTrip({
      op: 'setStyle',
      target: home,
      nodeId: card.id,
      scope: { state: 'hover' },
      unset: ['shadow'],
      set: {},
    });
    expect(
      first('Card', (next.pages[HOME] as Page).root, (n) => n.id === card.id).states,
    ).toBeUndefined();
  });

  it('setContent, setBinding, setNodeMeta', () => {
    const text = first('Text');
    roundTrip({
      op: 'setContent',
      target: home,
      nodeId: text.id,
      set: { text: 'New' },
      unset: ['runs'],
    });
    roundTrip({
      op: 'setBinding',
      target: home,
      nodeId: text.id,
      key: 'text',
      binding: { source: 'ds_products', field: 'name' },
    });
    const bound = first('Heading', homeRoot, (n) => n.bindings !== undefined);
    roundTrip({ op: 'setBinding', target: home, nodeId: bound.id, key: 'text' });
    const hidden = first('Text', homeRoot, (n) => n.hidden === true);
    roundTrip({
      op: 'setNodeMeta',
      target: home,
      nodeId: hidden.id,
      name: 'Renamed',
      unset: ['hidden', 'locked'],
    });
  });

  it('setInteractions and setRuntime', () => {
    const button = first('Button', homeRoot, (n) => n.interactions !== undefined);
    roundTrip({ op: 'setInteractions', target: home, nodeId: button.id, interactions: [] });
    roundTrip({ op: 'setRuntime', target: home, nodeId: card.id, initiallyHidden: true });
    roundTrip({
      op: 'setRuntime',
      target: home,
      nodeId: first('Stack', homeRoot, (n) => n.runtime !== undefined).id,
    });
  });

  it('node.restoreValues sets and removes values by path', () => {
    roundTrip({
      op: 'node.restoreValues',
      entries: [
        { target: home, nodeId: card.id, path: ['style', 'gap'], value: { px: 1 } },
        { target: home, nodeId: card.id, path: ['style', 'radius'] },
      ],
    });
  });
});

describe('document operations', () => {
  it('pages: create, delete, update, reorder', () => {
    const page: Page = {
      schemaVersion: 1,
      id: 'p_newp000001',
      name: 'New',
      route: '/new',
      root: node('Stack'),
    };
    const next = roundTrip({ op: 'page.create', page, index: 1 });
    expect(next.workspace.pageOrder[1]).toBe(page.id);
    roundTrip({ op: 'page.delete', pageId: FORM });
    roundTrip({ op: 'page.update', pageId: HOME, name: 'Home', unset: ['description'] });
    roundTrip({ op: 'page.update', pageId: FORM, title: 'Add product' });
    roundTrip({ op: 'page.reorder', pageId: HOME, index: 2 });
  });

  it('tokens: set, delete, rename and replace update every use', () => {
    roundTrip({ op: 'token.set', group: 'spacing', name: '8', entry: { value: { px: 32 } } });
    roundTrip({ op: 'token.set', group: 'color', name: 'primary', entry: { value: '#000000' } });
    roundTrip({ op: 'token.delete', group: 'radius', name: 'lg' });

    const uses = findTokenUses(document, 'spacing', '4').length;
    const renamed = roundTrip({ op: 'token.rename', group: 'spacing', from: '4', to: 'md' });
    expect(findTokenUses(renamed, 'spacing', 'md')).toHaveLength(uses);
    expect(findTokenUses(renamed, 'spacing', '4')).toHaveLength(0);

    const replaced = roundTrip({
      op: 'token.replace',
      group: 'spacing',
      from: '2',
      with: { value: { px: 8 } },
    });
    expect(findTokenUses(replaced, 'spacing', '2')).toHaveLength(0);
    roundTrip({ op: 'token.replace', group: 'color', from: 'muted', with: { token: 'text' } });
  });

  it('components and workspace', () => {
    const component = document.components[CARD];
    roundTrip({ op: 'component.update', componentId: CARD, name: 'ProductTile', props: [] });
    roundTrip({ op: 'component.delete', componentId: CARD });
    roundTrip({
      op: 'component.create',
      component: { ...clone(component), id: 'c_copy000001', name: 'Copy' } as never,
    });
    roundTrip({ op: 'workspace.update', name: 'Renamed', darkMode: 'none' });
  });
});
