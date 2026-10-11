// apply and invert for operations that change the shape of a node tree (SPEC-03 section 7.2):
// insert, remove, move, wrap, unwrap. Operations are validated before they are applied.
import type { DesignDocument } from '../schema/document.schema.ts';
import type { DesignNode } from '../schema/node.schema.ts';
import type { DesignOperation, OperationOf, TreeTarget } from './operation.schema.ts';
import { omit } from './patch.ts';
import {
  childList,
  findNode,
  getTreeRoot,
  insertAt,
  type Location,
  removeAt,
  setTreeRoot,
  type Step,
  updateAt,
  withChildList,
} from './tree-edit.ts';

function treeOf(document: DesignDocument, target: TreeTarget): DesignNode {
  const root = getTreeRoot(document, target);
  if (root === undefined) throw new Error('Unknown tree');
  return root;
}

function locate(root: DesignNode, id: string): Location {
  const found = findNode(root, id);
  if (found === undefined) throw new Error(`Unknown node ${id}`);
  return found;
}

/** The last step and the parent of a non-root node. */
function position(location: Location): { step: Step; parent: DesignNode } {
  const step = location.steps.at(-1);
  if (step === undefined || location.parent === undefined)
    throw new Error('The root has no position');
  return { step, parent: location.parent };
}

const slotOf = (step: Step) => (step.slot === undefined ? {} : { slotName: step.slot });

// --- insert, remove ---

export function applyInsert(document: DesignDocument, op: OperationOf<'insert'>): DesignDocument {
  const root = treeOf(document, op.target);
  const parent = locate(root, op.parentId);
  return setTreeRoot(
    document,
    op.target,
    insertAt(root, parent.steps, op.slotName, op.index, op.node),
  );
}

export const invertInsert = (
  _document: DesignDocument,
  op: OperationOf<'insert'>,
): DesignOperation => ({
  op: 'remove',
  target: op.target,
  nodeId: op.node.id,
});

export function applyRemove(document: DesignDocument, op: OperationOf<'remove'>): DesignDocument {
  const root = treeOf(document, op.target);
  return setTreeRoot(document, op.target, removeAt(root, locate(root, op.nodeId).steps));
}

export function invertRemove(document: DesignDocument, op: OperationOf<'remove'>): DesignOperation {
  const location = locate(treeOf(document, op.target), op.nodeId);
  const { step, parent } = position(location);
  return {
    op: 'insert',
    target: op.target,
    parentId: parent.id,
    index: step.index,
    node: location.node,
    ...slotOf(step),
  };
}

// --- move (index counts after the node left its old place, V-41) ---

export function applyMove(document: DesignDocument, op: OperationOf<'move'>): DesignDocument {
  const root = treeOf(document, op.target);
  const location = locate(root, op.nodeId);
  const without = removeAt(root, location.steps);
  const parent = locate(without, op.newParentId);
  return setTreeRoot(
    document,
    op.target,
    insertAt(without, parent.steps, op.slotName, op.index, location.node),
  );
}

export function invertMove(document: DesignDocument, op: OperationOf<'move'>): DesignOperation {
  const { step, parent } = position(locate(treeOf(document, op.target), op.nodeId));
  return {
    op: 'move',
    target: op.target,
    nodeId: op.nodeId,
    newParentId: parent.id,
    index: step.index,
    ...slotOf(step),
  };
}

// --- wrap, unwrap ---

export function applyWrap(document: DesignDocument, op: OperationOf<'wrap'>): DesignDocument {
  const root = treeOf(document, op.target);
  const first = locate(root, op.nodeIds[0] as string);
  const { step } = position(first);
  const updated = updateAt(root, first.steps.slice(0, -1), (parent) => {
    const list = [...childList(parent, step.slot)];
    const taken = list.splice(step.index, op.nodeIds.length);
    list.splice(step.index, 0, { ...op.wrapper, children: taken });
    return withChildList(parent, step.slot, list);
  });
  return setTreeRoot(document, op.target, updated);
}

export const invertWrap = (
  _document: DesignDocument,
  op: OperationOf<'wrap'>,
): DesignOperation => ({
  op: 'unwrap',
  target: op.target,
  wrapperId: op.wrapper.id,
});

export function applyUnwrap(document: DesignDocument, op: OperationOf<'unwrap'>): DesignDocument {
  const root = treeOf(document, op.target);
  const wrapper = locate(root, op.wrapperId);
  const { step } = position(wrapper);
  const updated = updateAt(root, wrapper.steps.slice(0, -1), (parent) => {
    const list = [...childList(parent, step.slot)];
    list.splice(step.index, 1, ...(wrapper.node.children ?? []));
    return withChildList(parent, step.slot, list);
  });
  return setTreeRoot(document, op.target, updated);
}

export function invertUnwrap(document: DesignDocument, op: OperationOf<'unwrap'>): DesignOperation {
  const wrapper = locate(treeOf(document, op.target), op.wrapperId).node;
  return {
    op: 'wrap',
    target: op.target,
    nodeIds: (wrapper.children ?? []).map((child) => child.id),
    wrapper: omit(wrapper, ['children']),
  };
}
