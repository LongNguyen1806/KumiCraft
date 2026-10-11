// Operation engine (SPEC-03 section 7.4): one apply and one invert per operation kind. The table is
// typed by kind, so adding an operation without its handlers is a compile error.
import type { DesignDocument } from '../schema/document.schema.ts';
import * as doc from './document-ops.ts';
import * as props from './node-props.ts';
import * as tree from './node-tree.ts';
import type { DesignOperation, OperationKind, OperationOf } from './operation.schema.ts';

type Handler<K extends OperationKind> = {
  readonly apply: (document: DesignDocument, op: OperationOf<K>) => DesignDocument;
  readonly invert: (document: DesignDocument, op: OperationOf<K>) => DesignOperation;
};

const HANDLERS: { readonly [K in OperationKind]: Handler<K> } = {
  insert: { apply: tree.applyInsert, invert: tree.invertInsert },
  remove: { apply: tree.applyRemove, invert: tree.invertRemove },
  move: { apply: tree.applyMove, invert: tree.invertMove },
  wrap: { apply: tree.applyWrap, invert: tree.invertWrap },
  unwrap: { apply: tree.applyUnwrap, invert: tree.invertUnwrap },
  setStyle: { apply: props.applySetStyle, invert: props.invertSetStyle },
  setContent: { apply: props.applySetContent, invert: props.invertSetContent },
  setBinding: { apply: props.applySetBinding, invert: props.invertSetBinding },
  setNodeMeta: { apply: props.applySetNodeMeta, invert: props.invertSetNodeMeta },
  setInteractions: { apply: props.applySetInteractions, invert: props.invertSetInteractions },
  setRuntime: { apply: props.applySetRuntime, invert: props.invertSetRuntime },
  'node.restoreValues': { apply: props.applyRestoreValues, invert: props.invertRestoreValues },
  'page.create': { apply: doc.applyPageCreate, invert: doc.invertPageCreate },
  'page.delete': { apply: doc.applyPageDelete, invert: doc.invertPageDelete },
  'page.update': { apply: doc.applyPageUpdate, invert: doc.invertPageUpdate },
  'page.reorder': { apply: doc.applyPageReorder, invert: doc.invertPageReorder },
  'token.set': { apply: doc.applyTokenSet, invert: doc.invertTokenSet },
  'token.delete': { apply: doc.applyTokenDelete, invert: doc.invertTokenDelete },
  'token.rename': { apply: doc.applyTokenRename, invert: doc.invertTokenRename },
  'token.replace': { apply: doc.applyTokenReplace, invert: doc.invertTokenReplace },
  'component.create': { apply: doc.applyComponentCreate, invert: doc.invertComponentCreate },
  'component.delete': { apply: doc.applyComponentDelete, invert: doc.invertComponentDelete },
  'component.update': { apply: doc.applyComponentUpdate, invert: doc.invertComponentUpdate },
  'workspace.update': { apply: doc.applyWorkspaceUpdate, invert: doc.invertWorkspaceUpdate },
};

const handlerOf = <K extends OperationKind>(op: OperationOf<K>): Handler<K> => HANDLERS[op.op];

/**
 * Applies a validated operation. The input document is never changed; untouched parts of the
 * tree are shared with the result.
 */
export function applyOperation(document: DesignDocument, op: DesignOperation): DesignDocument {
  return handlerOf(op).apply(document, op);
}

/**
 * The operation that undoes `op`, computed from the document **before** `op` is applied:
 * `applyOperation(applyOperation(d, op), invertOperation(d, op))` equals `d`.
 */
export function invertOperation(document: DesignDocument, op: DesignOperation): DesignOperation {
  return handlerOf(op).invert(document, op);
}
