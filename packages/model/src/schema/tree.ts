// Walks a nested node tree: children first in order, then the slots of component instances.

/** The parts of a node needed to walk a tree. */
export type TreeNode = {
  readonly children?: readonly TreeNode[] | undefined;
  readonly slots?: Readonly<Record<string, readonly TreeNode[]>> | undefined;
};

export type VisitContext<N> = {
  readonly depth: number;
  readonly parent: N | undefined;
  /** Property path from the root, for error reports (for example `children.0.slots.actions.1`). */
  readonly path: readonly (string | number)[];
};

/** Calls `visit` for every node, depth first. The root has depth 1. */
export function walkTree<N extends TreeNode>(
  root: N,
  visit: (node: N, context: VisitContext<N>) => void,
): void {
  const stack: { node: N; context: VisitContext<N> }[] = [
    { node: root, context: { depth: 1, parent: undefined, path: [] } },
  ];
  while (stack.length > 0) {
    const { node, context } = stack.pop() as { node: N; context: VisitContext<N> };
    visit(node, context);
    const next: { node: N; context: VisitContext<N> }[] = [];
    const push = (child: TreeNode, path: readonly (string | number)[]) => {
      next.push({ node: child as N, context: { depth: context.depth + 1, parent: node, path } });
    };
    node.children?.forEach((child, i) => {
      push(child, [...context.path, 'children', i]);
    });
    for (const [name, nodes] of Object.entries(node.slots ?? {})) {
      nodes.forEach((child, i) => {
        push(child, [...context.path, 'slots', name, i]);
      });
    }
    // Reverse so that the first child is visited first.
    stack.push(...next.reverse());
  }
}
