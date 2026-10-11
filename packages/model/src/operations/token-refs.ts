// Where a design token is used: style values (base, breakpoints, states, gradient stops) and the
// colour of rich-text runs. Used by token.rename, token.replace and V-47.
import type { DesignDocument } from '../schema/document.schema.ts';
import type { DesignNode } from '../schema/node.schema.ts';
import type { TokenGroup } from '../schema/primitives.schema.ts';
import type { TreeTarget } from './operation.schema.ts';

export type TokenUse = {
  readonly target: TreeTarget;
  readonly nodeId: string;
  /** Path inside the node, for example `['responsive', 'md', 'padding', 'top']`. */
  readonly path: readonly (string | number)[];
};

type Path = (string | number)[];

function scan(value: unknown, path: Path, ref: string, out: Path[]) {
  if (value === ref) {
    out.push(path);
  } else if (Array.isArray(value)) {
    value.forEach((item, i) => {
      scan(item, [...path, i], ref, out);
    });
  } else if (value instanceof Object) {
    for (const [key, item] of Object.entries(value)) scan(item, [...path, key], ref, out);
  }
}

function usesInNode(node: DesignNode, ref: string): Path[] {
  const paths: Path[] = [];
  scan(node.style, ['style'], ref, paths);
  scan(node.responsive, ['responsive'], ref, paths);
  scan(node.states, ['states'], ref, paths);
  if (node.content !== undefined && 'runs' in node.content) {
    node.content.runs?.forEach((run, i) => {
      if (run.color === ref) paths.push(['content', 'runs', i, 'color']);
    });
  }
  return paths;
}

function trees(document: DesignDocument): { target: TreeTarget; root: DesignNode }[] {
  return [
    ...Object.values(document.pages).map((page) => ({
      target: { kind: 'page', pageId: page.id } as const,
      root: page.root,
    })),
    ...Object.values(document.components).map((component) => ({
      target: { kind: 'component', componentId: component.id } as const,
      root: component.root,
    })),
  ];
}

/** Every place that references `token:<group>.<name>`, in document order. */
export function findTokenUses(
  document: DesignDocument,
  group: TokenGroup,
  name: string,
): TokenUse[] {
  const ref = `token:${group}.${name}`;
  const uses: TokenUse[] = [];
  for (const { target, root } of trees(document)) {
    const visit = (node: DesignNode) => {
      for (const path of usesInNode(node, ref)) uses.push({ target, nodeId: node.id, path });
      node.children?.forEach(visit);
      for (const list of Object.values(node.slots ?? {})) list.forEach(visit);
    };
    visit(root);
  }
  return uses;
}
