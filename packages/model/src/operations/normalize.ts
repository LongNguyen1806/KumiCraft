// Flat form of a node tree used by the Studio and the server at run time (SPEC-03 section 5).
// Invariant: denormalize(normalize(x)) equals x for every valid tree.
import type { DesignNode } from '../schema/node.schema.ts';

export type NodeRecord = Omit<DesignNode, 'children' | 'slots'> & {
  readonly parentId?: string;
  /** Set when the node sits in a slot of its parent component instance. */
  readonly slotName?: string;
  readonly childIds: readonly string[];
  readonly slotChildIds?: Readonly<Record<string, readonly string[]>>;
  /** Whether the stored node had a `children` array (kept for an exact round trip). */
  readonly hasChildren?: true;
};

export type NormalizedTree = {
  readonly rootId: string;
  readonly nodes: Readonly<Record<string, NodeRecord>>;
};

export function normalize(root: DesignNode): NormalizedTree {
  const nodes: Record<string, NodeRecord> = {};
  const visit = (node: DesignNode, parentId: string | undefined, slotName: string | undefined) => {
    const { children, slots, ...rest } = node;
    nodes[node.id] = {
      ...rest,
      ...(parentId === undefined ? {} : { parentId }),
      ...(slotName === undefined ? {} : { slotName }),
      childIds: (children ?? []).map((child) => child.id),
      ...(children === undefined ? {} : { hasChildren: true }),
      ...(slots === undefined
        ? {}
        : {
            slotChildIds: Object.fromEntries(
              Object.entries(slots).map(([name, list]) => [name, list.map((c) => c.id)]),
            ),
          }),
    };
    for (const child of children ?? []) visit(child, node.id, undefined);
    for (const [name, list] of Object.entries(slots ?? {}))
      for (const child of list) visit(child, node.id, name);
  };
  visit(root, undefined, undefined);
  return { rootId: root.id, nodes };
}

export function denormalize(tree: NormalizedTree): DesignNode {
  const build = (id: string): DesignNode => {
    const record = tree.nodes[id];
    if (record === undefined) throw new Error(`Missing node ${id}`);
    const { parentId, slotName, childIds, slotChildIds, hasChildren, ...rest } = record;
    const node: DesignNode = { ...rest };
    if (hasChildren === true) node.children = childIds.map(build);
    if (slotChildIds !== undefined) {
      node.slots = Object.fromEntries(
        Object.entries(slotChildIds).map(([name, ids]) => [name, ids.map(build)]),
      );
    }
    return node;
  };
  return build(tree.rootId);
}
