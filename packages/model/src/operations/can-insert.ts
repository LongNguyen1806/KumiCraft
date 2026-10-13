// canInsert: pure function checking whether a new node or moved nodes can be placed (SPEC-04.1 section 9.2).
import { err, ok, type Result } from '../result.ts';
import type { DesignDocument } from '../schema/document.schema.ts';
import type { DesignNode } from '../schema/node.schema.ts';
import { applyBatch, assignIds, type IdGenerator } from './batch.ts';
import type { DesignOperation, TreeTarget } from './operation.schema.ts';
import { findNode, getTreeRoot } from './tree-edit.ts';
import { validateOperation } from './validate-operation.ts';

export type CanInsertSubject =
  | { readonly kind: 'new'; readonly node: DesignNode }
  | { readonly kind: 'move'; readonly nodeIds: readonly string[] };

let counter = 0;
const fixedGenerator: IdGenerator = (kind) => {
  counter++;
  const padded = String(counter).padStart(10, '0');
  return kind === 'node'
    ? `n_${padded}`
    : kind === 'page'
      ? `p_${padded}`
      : `i_${padded.slice(0, 8)}`;
};

function canInsertNew(
  doc: DesignDocument,
  target: TreeTarget,
  parentId: string,
  node: DesignNode,
  index: number,
  slotName?: string,
): Result<void> {
  const rawOp: DesignOperation = {
    op: 'insert',
    target,
    parentId,
    index,
    node,
    ...(slotName !== undefined ? { slotName } : {}),
  };
  const { ops } = assignIds([rawOp], fixedGenerator);
  const assignedOp = ops[0];
  if (assignedOp === undefined) {
    return err({ code: 'E005', params: { op: 'insert' } });
  }
  return validateOperation(doc, assignedOp);
}

function canInsertMove(
  doc: DesignDocument,
  target: TreeTarget,
  parentId: string,
  nodeIds: readonly string[],
  index: number,
  slotName?: string,
): Result<void> {
  if (nodeIds.length === 0) return err({ code: 'E005', params: { op: 'move' } });
  const root = getTreeRoot(doc, target);
  if (root === undefined) return err({ code: 'E005', params: { op: 'move', rule: 'V-40' } });

  const locations = nodeIds.map((id) => findNode(root, id));
  if (locations.some((loc) => loc === undefined)) {
    return err({ code: 'E005', params: { op: 'move', rule: 'V-40' } });
  }

  const commonParentId = locations[0]?.parent?.id;
  if (!locations.every((loc) => loc?.parent?.id === commonParentId)) {
    return err({ code: 'E005', params: { op: 'move', rule: 'R-DD-05' } });
  }

  if (nodeIds.length === 1) {
    const nodeId = nodeIds[0] as string;
    const op: DesignOperation = {
      op: 'move',
      target,
      nodeId,
      newParentId: parentId,
      index,
      ...(slotName !== undefined ? { slotName } : {}),
    };
    return validateOperation(doc, op);
  }

  const moveOps: DesignOperation[] = nodeIds.map((nodeId, i) => ({
    op: 'move',
    target,
    nodeId,
    newParentId: parentId,
    index: index + i,
    ...(slotName !== undefined ? { slotName } : {}),
  }));
  const batchResult = applyBatch(doc, moveOps);
  return batchResult.ok ? ok(undefined) : err(batchResult.error);
}

/**
 * Checks whether `subject` can be inserted/moved into `parentId` at `index` (and optional `slotName`).
 * Calls validateOperation under the hood so no structural validation rules are duplicated.
 */
export function canInsert(
  doc: DesignDocument,
  target: TreeTarget,
  parentId: string,
  subject: CanInsertSubject,
  index: number,
  slotName?: string,
): Result<void> {
  const root = getTreeRoot(doc, target);
  if (root === undefined) {
    return err({
      code: 'E005',
      params: { op: subject.kind === 'new' ? 'insert' : 'move', rule: 'V-40' },
    });
  }

  return subject.kind === 'new'
    ? canInsertNew(doc, target, parentId, subject.node, index, slotName)
    : canInsertMove(doc, target, parentId, subject.nodeIds, index, slotName);
}
