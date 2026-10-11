// Shared state of validateDocument: an index of the document and a walk over every node tree
// (pages and component definitions) that knows each node's ancestors.
import type { ErrorDetail } from '../../result.ts';
import type { DesignDocument, Endpoint, Entity, Page, UserComponent } from '../document.schema.ts';
import type { DesignNode } from '../node.schema.ts';
import type { TokenGroup } from '../primitives.schema.ts';

export type ValidateOptions = {
  /** Names of the Lucide icons bundled with ReactCraft (V-25). Omit to skip the check. */
  readonly iconNames?: ReadonlySet<string>;
  /** File names inside `.reactcraft/assets/` (V-24). Omit to skip the check. */
  readonly assetNames?: ReadonlySet<string>;
  /**
   * Check node rules only in these trees (`pages.<id>`, `components.<id>`). Omit to check every
   * tree. Operation validation uses it to re-check only the tree an operation changed (PB-01).
   */
  readonly trees?: ReadonlySet<string>;
};

export type Tree =
  | { readonly kind: 'page'; readonly page: Page; readonly path: string }
  | { readonly kind: 'component'; readonly component: UserComponent; readonly path: string };

export type NodeVisit = {
  readonly node: DesignNode;
  /** Ancestors from the root down to the parent. Empty for the root. */
  readonly ancestors: readonly DesignNode[];
  readonly tree: Tree;
  /** Dotted path from the document root, for example `pages.p_1.root.children.0`. */
  readonly path: string;
};

export type DocumentIndex = {
  readonly document: DesignDocument;
  readonly options: ValidateOptions;
  readonly tokens: ReadonlyMap<TokenGroup, ReadonlySet<string>>;
  readonly entities: ReadonlyMap<string, Entity>;
  readonly endpoints: ReadonlyMap<string, Endpoint>;
  /** Every node of every tree, in document order. */
  readonly visits: readonly NodeVisit[];
  /** Nodes by id, per tree path (ids are unique inside a tree). */
  readonly nodesByTree: ReadonlyMap<string, ReadonlyMap<string, NodeVisit>>;
};

export type Report = (detail: ErrorDetail) => void;

function walk(tree: Tree, root: DesignNode, visits: NodeVisit[]) {
  const visit = (node: DesignNode, ancestors: readonly DesignNode[], path: string) => {
    visits.push({ node, ancestors, tree, path });
    const inside = [...ancestors, node];
    node.children?.forEach((child, i) => {
      visit(child, inside, `${path}.children.${String(i)}`);
    });
    for (const [name, nodes] of Object.entries(node.slots ?? {})) {
      nodes.forEach((child, i) => {
        visit(child, inside, `${path}.slots.${name}.${String(i)}`);
      });
    }
  };
  visit(root, [], `${tree.path}.root`);
}

export function buildIndex(document: DesignDocument, options: ValidateOptions): DocumentIndex {
  const visits: NodeVisit[] = [];
  const isInScope = (path: string) => options.trees === undefined || options.trees.has(path);
  for (const [id, page] of Object.entries(document.pages)) {
    const path = `pages.${id}`;
    if (isInScope(path)) walk({ kind: 'page', page, path }, page.root, visits);
  }
  for (const [id, component] of Object.entries(document.components)) {
    const path = `components.${id}`;
    if (isInScope(path)) walk({ kind: 'component', component, path }, component.root, visits);
  }

  const nodesByTree = new Map<string, Map<string, NodeVisit>>();
  for (const visit of visits) {
    const nodes = nodesByTree.get(visit.tree.path) ?? new Map<string, NodeVisit>();
    nodes.set(visit.node.id, visit);
    nodesByTree.set(visit.tree.path, nodes);
  }

  const { tokens, dataSources } = document;
  return {
    document,
    options,
    tokens: new Map(
      (Object.keys(tokens) as (keyof typeof tokens)[])
        .filter((group): group is TokenGroup => group !== 'schemaVersion')
        .map((group) => [group, new Set(Object.keys(tokens[group]))]),
    ),
    entities: new Map(dataSources.entities.map((entity) => [entity.id, entity])),
    endpoints: new Map(dataSources.endpoints.map((endpoint) => [endpoint.id, endpoint])),
    visits,
    nodesByTree,
  };
}

/** Collects every string found anywhere inside `value`, with its relative path. */
export function collectStrings(
  value: unknown,
  path: string,
  out: { path: string; value: string }[] = [],
) {
  if (typeof value === 'string') {
    out.push({ path, value });
  } else if (Array.isArray(value)) {
    value.forEach((item, i) => collectStrings(item, `${path}.${String(i)}`, out));
  } else if (value instanceof Object) {
    for (const [key, item] of Object.entries(value)) collectStrings(item, `${path}.${key}`, out);
  }
  return out;
}
