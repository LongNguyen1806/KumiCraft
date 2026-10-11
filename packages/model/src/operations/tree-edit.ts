// Immutable edits of nested node trees. Only the nodes on the path from the root to the edit are
// copied; every other subtree is shared with the previous document (cheap undo snapshots).
import type { DesignDocument } from '../schema/document.schema.ts';
import type { DesignNode } from '../schema/node.schema.ts';
import type { TreeTarget } from './operation.schema.ts';

/** One step down a tree: into `children`, or into a named slot of a component instance. */
export type Step = { readonly slot?: string; readonly index: number };

export type Location = {
  readonly node: DesignNode;
  readonly parent: DesignNode | undefined;
  /** Steps from the root to the node. Empty for the root. */
  readonly steps: readonly Step[];
};

export function getTreeRoot(document: DesignDocument, target: TreeTarget): DesignNode | undefined {
  return target.kind === 'page'
    ? document.pages[target.pageId]?.root
    : document.components[target.componentId]?.root;
}

/** Returns `document` with the root of `target` replaced. The target must exist. */
export function setTreeRoot(
  document: DesignDocument,
  target: TreeTarget,
  root: DesignNode,
): DesignDocument {
  if (target.kind === 'page') {
    const page = document.pages[target.pageId];
    if (page === undefined) throw new Error(`Unknown page ${target.pageId}`);
    return { ...document, pages: { ...document.pages, [target.pageId]: { ...page, root } } };
  }
  const component = document.components[target.componentId];
  if (component === undefined) throw new Error(`Unknown component ${target.componentId}`);
  return {
    ...document,
    components: { ...document.components, [target.componentId]: { ...component, root } },
  };
}

export function childList(node: DesignNode, slot: string | undefined): readonly DesignNode[] {
  return slot === undefined ? (node.children ?? []) : (node.slots?.[slot] ?? []);
}

export function withChildList(
  node: DesignNode,
  slot: string | undefined,
  list: DesignNode[],
): DesignNode {
  if (slot === undefined) return { ...node, children: list };
  return { ...node, slots: { ...node.slots, [slot]: list } };
}

/** Depth-first search for `id`. */
export function findNode(root: DesignNode, id: string): Location | undefined {
  const search = (
    node: DesignNode,
    parent: DesignNode | undefined,
    steps: Step[],
  ): Location | undefined => {
    if (node.id === id) return { node, parent, steps };
    const lists: [string | undefined, readonly DesignNode[]][] = [
      [undefined, node.children ?? []],
      ...Object.entries(node.slots ?? {}),
    ];
    for (const [slot, list] of lists) {
      for (let i = 0; i < list.length; i++) {
        const child = list[i] as DesignNode;
        const found = search(child, node, [
          ...steps,
          slot === undefined ? { index: i } : { slot, index: i },
        ]);
        if (found !== undefined) return found;
      }
    }
    return undefined;
  };
  return search(root, undefined, []);
}

/** Replaces the node at `steps` by `update(node)`, copying only the path. */
export function updateAt(
  root: DesignNode,
  steps: readonly Step[],
  update: (node: DesignNode) => DesignNode,
): DesignNode {
  const [step, ...rest] = steps;
  if (step === undefined) return update(root);
  const list = [...childList(root, step.slot)];
  const child = list[step.index];
  if (child === undefined) throw new Error('Invalid tree path');
  list[step.index] = updateAt(child, rest, update);
  return withChildList(root, step.slot, list);
}

/** Inserts `node` at `index` in the children (or `slot`) of the node at `parentSteps`. */
export function insertAt(
  root: DesignNode,
  parentSteps: readonly Step[],
  slot: string | undefined,
  index: number,
  node: DesignNode,
): DesignNode {
  return updateAt(root, parentSteps, (parent) => {
    const list = [...childList(parent, slot)];
    list.splice(index, 0, node);
    return withChildList(parent, slot, list);
  });
}

/** Removes the node at `steps` (not the root). */
export function removeAt(root: DesignNode, steps: readonly Step[]): DesignNode {
  const last = steps.at(-1);
  if (last === undefined) throw new Error('Cannot remove the root');
  return updateAt(root, steps.slice(0, -1), (parent) => {
    const list = [...childList(parent, last.slot)];
    list.splice(last.index, 1);
    return withChildList(parent, last.slot, list);
  });
}

/** Every node id of a subtree, slots included. */
export function collectIds(node: DesignNode, into = new Set<string>()): Set<string> {
  into.add(node.id);
  for (const child of node.children ?? []) collectIds(child, into);
  for (const list of Object.values(node.slots ?? {}))
    for (const child of list) collectIds(child, into);
  return into;
}

/** Every node id used anywhere in the document (V-43). */
export function documentIds(document: DesignDocument): Set<string> {
  const ids = new Set<string>();
  for (const page of Object.values(document.pages)) collectIds(page.root, ids);
  for (const component of Object.values(document.components)) collectIds(component.root, ids);
  return ids;
}
