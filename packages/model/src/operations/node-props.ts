// apply and invert for operations that change one node's properties (SPEC-03 section 7.2).
import type { DesignDocument } from '../schema/document.schema.ts';
import type { DesignNode } from '../schema/node.schema.ts';
import type { DesignOperation, OperationOf, StyleScope, TreeTarget } from './operation.schema.ts';
import { getPath, inversePatch, omit, patchObject, type Plain, setPath } from './patch.ts';
import { findNode, getTreeRoot, setTreeRoot, updateAt } from './tree-edit.ts';

export function getNode(document: DesignDocument, target: TreeTarget, nodeId: string): DesignNode {
  const root = getTreeRoot(document, target);
  const found = root === undefined ? undefined : findNode(root, nodeId);
  if (found === undefined) throw new Error(`Unknown node ${nodeId}`);
  return found.node;
}

export function updateNode(
  document: DesignDocument,
  target: TreeTarget,
  nodeId: string,
  update: (node: DesignNode) => DesignNode,
): DesignDocument {
  const root = getTreeRoot(document, target);
  const found = root === undefined ? undefined : findNode(root, nodeId);
  if (root === undefined || found === undefined) throw new Error(`Unknown node ${nodeId}`);
  return setTreeRoot(document, target, updateAt(root, found.steps, update));
}

/** Copy of `node` with `key` set, or removed when `value` is undefined. */
function assign<K extends keyof DesignNode>(
  node: DesignNode,
  key: K,
  value: DesignNode[K] | undefined,
): DesignNode {
  return value === undefined ? omit(node, [key]) : { ...node, [key]: value };
}

const nonEmpty = (keys: string[]) => (keys.length === 0 ? {} : { unset: keys });

// --- setStyle ---

export function styleAt(node: DesignNode, scope: StyleScope): Plain | undefined {
  const breakpoint = scope.breakpoint ?? 'base';
  if (scope.state !== undefined) return node.states?.[scope.state];
  return breakpoint === 'base' ? node.style : node.responsive?.[breakpoint];
}

export function withStyleAt(
  node: DesignNode,
  scope: StyleScope,
  style: Plain | undefined,
): DesignNode {
  const breakpoint = scope.breakpoint ?? 'base';
  if (scope.state !== undefined) {
    return assign(
      node,
      'states',
      patchObject(node.states, { [scope.state]: style }) as DesignNode['states'],
    );
  }
  if (breakpoint === 'base') return assign(node, 'style', style as DesignNode['style']);
  return assign(
    node,
    'responsive',
    patchObject(node.responsive, { [breakpoint]: style }) as DesignNode['responsive'],
  );
}

export const applySetStyle = (document: DesignDocument, op: OperationOf<'setStyle'>) =>
  updateNode(document, op.target, op.nodeId, (node) =>
    withStyleAt(node, op.scope, patchObject(styleAt(node, op.scope), op.set, op.unset)),
  );

export function invertSetStyle(
  document: DesignDocument,
  op: OperationOf<'setStyle'>,
): DesignOperation {
  const { set, unset } = inversePatch(
    styleAt(getNode(document, op.target, op.nodeId), op.scope),
    op.set,
    op.unset,
  );
  return {
    op: 'setStyle',
    target: op.target,
    nodeId: op.nodeId,
    scope: op.scope,
    set,
    ...nonEmpty(unset),
  };
}

// --- setContent (never changes kind, V-46) ---

export const applySetContent = (document: DesignDocument, op: OperationOf<'setContent'>) =>
  updateNode(document, op.target, op.nodeId, (node) =>
    assign(node, 'content', patchObject(node.content, op.set, op.unset) as DesignNode['content']),
  );

export function invertSetContent(
  document: DesignDocument,
  op: OperationOf<'setContent'>,
): DesignOperation {
  const { set, unset } = inversePatch(
    getNode(document, op.target, op.nodeId).content,
    op.set,
    op.unset,
  );
  return { op: 'setContent', target: op.target, nodeId: op.nodeId, set, ...nonEmpty(unset) };
}

// --- setBinding ---

export const applySetBinding = (document: DesignDocument, op: OperationOf<'setBinding'>) =>
  updateNode(document, op.target, op.nodeId, (node) =>
    assign(
      node,
      'bindings',
      patchObject(node.bindings, { [op.key]: op.binding }) as DesignNode['bindings'],
    ),
  );

export function invertSetBinding(
  document: DesignDocument,
  op: OperationOf<'setBinding'>,
): DesignOperation {
  const old = getNode(document, op.target, op.nodeId).bindings?.[op.key];
  return {
    op: 'setBinding',
    target: op.target,
    nodeId: op.nodeId,
    key: op.key,
    ...(old === undefined ? {} : { binding: old }),
  };
}

// --- setNodeMeta ---

const META_KEYS = ['name', 'hidden', 'locked'] as const;

function metaPatch(op: OperationOf<'setNodeMeta'>): Plain {
  return Object.fromEntries(
    META_KEYS.filter((key) => op[key] !== undefined).map((key) => [key, op[key]]),
  );
}

export const applySetNodeMeta = (document: DesignDocument, op: OperationOf<'setNodeMeta'>) =>
  updateNode(document, op.target, op.nodeId, (node) => {
    return omit({ ...node, ...metaPatch(op) }, op.unset ?? []);
  });

export function invertSetNodeMeta(
  document: DesignDocument,
  op: OperationOf<'setNodeMeta'>,
): DesignOperation {
  const { set, unset } = inversePatch(
    getNode(document, op.target, op.nodeId),
    metaPatch(op),
    op.unset,
  );
  return {
    op: 'setNodeMeta',
    target: op.target,
    nodeId: op.nodeId,
    ...(set as Pick<DesignNode, 'name' | 'hidden' | 'locked'>),
    ...(unset.length === 0 ? {} : { unset: unset as (typeof META_KEYS)[number][] }),
  };
}

// --- setInteractions, setRuntime ---

export const applySetInteractions = (
  document: DesignDocument,
  op: OperationOf<'setInteractions'>,
) =>
  updateNode(document, op.target, op.nodeId, (node) =>
    assign(node, 'interactions', op.interactions.length === 0 ? undefined : op.interactions),
  );

export function invertSetInteractions(
  document: DesignDocument,
  op: OperationOf<'setInteractions'>,
): DesignOperation {
  const old = getNode(document, op.target, op.nodeId).interactions ?? [];
  return { op: 'setInteractions', target: op.target, nodeId: op.nodeId, interactions: old };
}

export const applySetRuntime = (document: DesignDocument, op: OperationOf<'setRuntime'>) =>
  updateNode(document, op.target, op.nodeId, (node) =>
    assign(
      node,
      'runtime',
      op.initiallyHidden === undefined ? undefined : { initiallyHidden: op.initiallyHidden },
    ),
  );

export function invertSetRuntime(
  document: DesignDocument,
  op: OperationOf<'setRuntime'>,
): DesignOperation {
  const old = getNode(document, op.target, op.nodeId).runtime?.initiallyHidden;
  return {
    op: 'setRuntime',
    target: op.target,
    nodeId: op.nodeId,
    ...(old === undefined ? {} : { initiallyHidden: old }),
  };
}

// --- node.restoreValues (inverse of token.replace) ---

export function applyRestoreValues(
  document: DesignDocument,
  op: OperationOf<'node.restoreValues'>,
): DesignDocument {
  return op.entries.reduce(
    (doc, entry) =>
      updateNode(
        doc,
        entry.target,
        entry.nodeId,
        (node) => setPath(node, entry.path, entry.value) as DesignNode,
      ),
    document,
  );
}

export function invertRestoreValues(
  document: DesignDocument,
  op: OperationOf<'node.restoreValues'>,
): DesignOperation {
  return {
    op: 'node.restoreValues',
    entries: op.entries.map((entry) => {
      const value = getPath(getNode(document, entry.target, entry.nodeId), entry.path);
      return {
        target: entry.target,
        nodeId: entry.nodeId,
        path: entry.path,
        ...(value === undefined ? {} : { value }),
      };
    }),
  };
}
