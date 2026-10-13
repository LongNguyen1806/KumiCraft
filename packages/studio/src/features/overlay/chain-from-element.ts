// Extracts ancestral node ID chain from a clicked DOM element (SPEC-04.1 section 8.2).

type DuckElement = {
  readonly getAttribute?: (name: string) => string | undefined;
  readonly parentElement?: unknown;
  readonly closest?: (selector: string) => unknown;
};

/**
 * Traverses upwards from `element.closest('[data-rc-node]')` to build the list of
 * ancestor node IDs from top (under root) to the deepest clicked node.
 * Eliminates the page root node ID if provided.
 */
export function chainFromElement(element: unknown, rootId?: string): string[] {
  if (!element || typeof element !== 'object') {
    return [];
  }

  const duck = element as DuckElement;
  if (typeof duck.closest !== 'function') {
    return [];
  }

  const target = (duck.closest('[data-rc-node]') ?? undefined) as DuckElement | undefined;
  if (target === undefined) {
    return [];
  }

  const ids: string[] = [];
  let curr: DuckElement | undefined = target;

  while (curr !== undefined) {
    const nodeId = curr.getAttribute?.('data-rc-node') ?? undefined;
    if (nodeId !== undefined && nodeId !== '' && (rootId === undefined || nodeId !== rootId)) {
      ids.push(nodeId);
    }

    const parent = (curr.parentElement ?? undefined) as DuckElement | undefined;
    curr =
      parent !== undefined && typeof parent.closest === 'function'
        ? (parent.closest('[data-rc-node]') ?? undefined)
        : undefined;
  }

  return ids.reverse();
}
