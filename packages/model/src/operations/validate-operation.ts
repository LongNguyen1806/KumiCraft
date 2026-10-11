// validateOperation (SPEC-03 section 7.4): checks an operation against the current document
// before it is applied. Node operations re-check only the tree they change, which keeps one
// operation on a 500-node page within PB-01 (5 ms).
import { err, type ErrorDetail, ok, type Result } from '../result.ts';
import {
  type DesignDocument,
  DesignDocumentSchema,
  PageSchema,
  UserComponentSchema,
} from '../schema/document.schema.ts';
import {
  issuesToDetails,
  validateDocument,
  type ValidateOptions,
} from '../schema/validate/validate-document.ts';
import { applyOperation } from './engine.ts';
import {
  type DesignOperation,
  DesignOperationSchema,
  type OperationKind,
  type TreeTarget,
} from './operation.schema.ts';
import { precheckDocument } from './precheck-document.ts';
import { precheckTree } from './precheck-tree.ts';

const TREE_OPERATIONS: ReadonlySet<OperationKind> = new Set([
  'insert',
  'remove',
  'move',
  'wrap',
  'unwrap',
  'setStyle',
  'setContent',
  'setBinding',
  'setNodeMeta',
  'setInteractions',
  'setRuntime',
  'node.restoreValues',
]);

const treePath = (target: TreeTarget) =>
  target.kind === 'page' ? `pages.${target.pageId}` : `components.${target.componentId}`;

function changedTrees(op: DesignOperation): TreeTarget[] {
  if (op.op === 'node.restoreValues') return op.entries.map((entry) => entry.target);
  return 'target' in op ? [op.target] : [];
}

/** Rules of the document after the operation: the changed trees only, or everything. */
function checkAfter(
  next: DesignDocument,
  op: DesignOperation,
  options: ValidateOptions,
): ErrorDetail[] {
  if (!TREE_OPERATIONS.has(op.op)) {
    const parsed = DesignDocumentSchema.safeParse(next);
    return parsed.success
      ? [...validateDocument(next, options)]
      : issuesToDetails(parsed.error.issues);
  }
  const targets = changedTrees(op);
  const details: ErrorDetail[] = [];
  for (const target of targets) {
    const parsed =
      target.kind === 'page'
        ? PageSchema.safeParse(next.pages[target.pageId])
        : UserComponentSchema.safeParse(next.components[target.componentId]);
    if (!parsed.success) {
      details.push(
        ...issuesToDetails(parsed.error.issues).map((d) => ({
          ...d,
          path: `${treePath(target)}.${d.path ?? ''}`,
        })),
      );
    }
  }
  if (details.length > 0) return details;
  return [...validateDocument(next, { ...options, trees: new Set(targets.map(treePath)) })];
}

const failure = (op: string, details: readonly ErrorDetail[]) =>
  err({
    code: 'E005',
    params: { op, ...(details[0]?.rule === undefined ? {} : { rule: details[0].rule }) },
    details,
  });

/**
 * Checks `op` against `document`: the operation's own rules (V-39 to V-49, V-98), then every
 * document rule on the result.
 *
 * @returns ok, or E005 (Invalid Design Operation) with `params.op`, `params.rule` and `details`.
 */
export function validateOperation(
  document: DesignDocument,
  op: DesignOperation,
  options: ValidateOptions = {},
): Result<void> {
  const parsed = DesignOperationSchema.safeParse(op);
  if (!parsed.success)
    return failure(String((op as { op?: unknown }).op), issuesToDetails(parsed.error.issues));
  const before = [...precheckTree(document, op), ...precheckDocument(document, op)];
  if (before.length > 0) return failure(op.op, before);
  const after = checkAfter(applyOperation(document, op), op, options);
  return after.length > 0 ? failure(op.op, after) : ok(undefined);
}
