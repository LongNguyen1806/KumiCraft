// Checks of node-tree operations before they are applied (SPEC-03 section 7.3: V-40 to V-46),
// plus V-20 (the page root is never removed, moved or wrapped).
import type { ErrorDetail } from '../result.ts';
import type { DesignDocument } from '../schema/document.schema.ts';
import { CONTAINER_TYPES, type DesignNode } from '../schema/node.schema.ts';
import type { DesignOperation, OperationOf, TreeTarget } from './operation.schema.ts';
import {
  childList,
  collectIds,
  documentIds,
  findNode,
  getTreeRoot,
  type Location,
} from './tree-edit.ts';

type Details = ErrorDetail[];

const detail = (rule: string, message: string): ErrorDetail => ({ rule, message });

function locateIn(
  document: DesignDocument,
  target: TreeTarget,
  id: string,
  out: Details,
): Location | undefined {
  const root = getTreeRoot(document, target);
  if (root === undefined) {
    out.push(detail('V-40', 'The target page or component does not exist'));
    return undefined;
  }
  const found = findNode(root, id);
  if (found === undefined) out.push(detail('V-40', `Node ${id} does not exist`));
  return found;
}

/** Where a child may go: a container's children, or a named slot of a component instance. */
function checkParent(parent: DesignNode, slotName: string | undefined, out: Details) {
  if (
    slotName === undefined ? !CONTAINER_TYPES.has(parent.type) : parent.type !== 'ComponentInstance'
  ) {
    out.push(detail('V-10', `${parent.type} cannot hold this child here`));
  }
}

function checkNewIds(document: DesignDocument, subtree: DesignNode, out: Details) {
  const existing = documentIds(document);
  let count = 0;
  const ids = new Set<string>();
  const visit = (node: DesignNode) => {
    count++;
    ids.add(node.id);
    node.children?.forEach(visit);
    for (const list of Object.values(node.slots ?? {})) list.forEach(visit);
  };
  visit(subtree);
  if (ids.size !== count || [...ids].some((id) => existing.has(id))) {
    out.push(detail('V-43', 'Inserted node ids must be new and unique'));
  }
}

function checkInsert(document: DesignDocument, op: OperationOf<'insert'>, out: Details) {
  const parent = locateIn(document, op.target, op.parentId, out);
  if (parent === undefined) return;
  checkParent(parent.node, op.slotName, out);
  if (op.index > childList(parent.node, op.slotName).length)
    out.push(detail('V-41', 'Index out of range'));
  checkNewIds(document, op.node, out);
}

function checkMove(document: DesignDocument, op: OperationOf<'move'>, out: Details) {
  const moving = locateIn(document, op.target, op.nodeId, out);
  const parent = locateIn(document, op.target, op.newParentId, out);
  if (moving === undefined || parent === undefined) return;
  if (moving.parent === undefined) {
    out.push(detail('V-20', 'The root cannot be moved'));
    return;
  }
  if (collectIds(moving.node).has(op.newParentId)) {
    out.push(detail('V-42', 'A node cannot move into itself or its descendants'));
    return;
  }
  checkParent(parent.node, op.slotName, out);
  const siblings = childList(parent.node, op.slotName);
  // V-41: the index counts after the node left its old place.
  const size = siblings.length - (siblings.some((child) => child.id === op.nodeId) ? 1 : 0);
  if (op.index > size) out.push(detail('V-41', 'Index out of range'));
}

function checkWrap(document: DesignDocument, op: OperationOf<'wrap'>, out: Details) {
  const nodes = op.nodeIds.map((id) => locateIn(document, op.target, id, out));
  if (nodes.some((location) => location === undefined)) return;
  const locations = nodes as Location[];
  const first = locations[0] as Location;
  const parentId = first.parent?.id;
  const step = first.steps.at(-1);
  const isRun = locations.every((location, i) => {
    const s = location.steps.at(-1);
    return (
      location.parent?.id === parentId &&
      s?.slot === step?.slot &&
      s?.index === (step?.index ?? 0) + i
    );
  });
  if (parentId === undefined || !isRun)
    out.push(detail('V-44', 'Wrapped nodes must be adjacent siblings, in order'));
  if (!CONTAINER_TYPES.has(op.wrapper.type) || (op.wrapper.children?.length ?? 0) > 0) {
    out.push(detail('V-44', 'The wrapper is an empty container'));
  }
  checkNewIds(document, op.wrapper, out);
}

function checkUnwrap(document: DesignDocument, op: OperationOf<'unwrap'>, out: Details) {
  const wrapper = locateIn(document, op.target, op.wrapperId, out);
  if (wrapper === undefined) return;
  if (wrapper.parent === undefined) out.push(detail('V-20', 'The root cannot be unwrapped'));
  if ((wrapper.node.children?.length ?? 0) === 0)
    out.push(detail('V-44', 'Only a container with children can be unwrapped'));
}

/** Node ids an interaction action points at. */
function actionTargets(node: DesignNode): string[] {
  const actions = [
    ...(node.interactions ?? []).flatMap((interaction) => interaction.actions),
    ...(node.content?.kind === 'table'
      ? [
          ...(node.content.rowClick ?? []),
          ...(node.content.rowActions ?? []).flatMap((a) => a.actions),
        ]
      : []),
  ];
  return actions.flatMap((action) => {
    if ('targetId' in action) return [action.targetId];
    if ('modalId' in action && action.modalId !== undefined) return [action.modalId];
    if ('tabsId' in action) return [action.tabsId];
    return [];
  });
}

/** V-98: a node (or a descendant) that another node's interaction targets cannot be removed. */
function checkStillTargeted(
  document: DesignDocument,
  target: TreeTarget,
  removed: DesignNode,
  out: Details,
) {
  const root = getTreeRoot(document, target);
  if (root === undefined) return;
  const removedIds = collectIds(removed);
  const referencedBy: string[] = [];
  const visit = (node: DesignNode) => {
    if (!removedIds.has(node.id) && actionTargets(node).some((id) => removedIds.has(id)))
      referencedBy.push(node.id);
    node.children?.forEach(visit);
    for (const list of Object.values(node.slots ?? {})) list.forEach(visit);
  };
  visit(root);
  if (referencedBy.length > 0) {
    out.push({
      rule: 'V-98',
      message: 'Other interactions target this node',
      path: referencedBy.join(','),
    });
  }
}

/** V-40 to V-46 and V-98 for node operations. Returns no detail for other operations. */
export function precheckTree(document: DesignDocument, op: DesignOperation): Details {
  const out: Details = [];
  switch (op.op) {
    case 'insert':
      checkInsert(document, op, out);
      break;
    case 'move':
      checkMove(document, op, out);
      break;
    case 'wrap':
      checkWrap(document, op, out);
      break;
    case 'unwrap':
      checkUnwrap(document, op, out);
      break;
    case 'remove': {
      const location = locateIn(document, op.target, op.nodeId, out);
      if (location !== undefined && location.parent === undefined)
        out.push(detail('V-20', 'The root cannot be removed'));
      if (location !== undefined) checkStillTargeted(document, op.target, location.node, out);
      break;
    }
    case 'setContent':
      if ('kind' in op.set || (op.unset ?? []).includes('kind'))
        out.push(detail('V-46', 'setContent cannot change kind'));
      locateIn(document, op.target, op.nodeId, out);
      break;
    case 'setStyle':
    case 'setBinding':
    case 'setNodeMeta':
    case 'setInteractions':
    case 'setRuntime':
      locateIn(document, op.target, op.nodeId, out);
      break;
    case 'node.restoreValues':
      for (const entry of op.entries) locateIn(document, entry.target, entry.nodeId, out);
      break;
    default:
      break;
  }
  return out;
}
