// Builders shared by the schema tests. Not exported from the package.
import type { z } from 'zod';

import type { DesignNode } from './node.schema.ts';

let counter = 0;

/** A fresh, valid node id. */
export const nodeId = (): string => `n_${String(++counter).padStart(10, '0')}`;

/** A node with the content its type needs by default. */
export function node(type: DesignNode['type'], extra: Partial<DesignNode> = {}): DesignNode {
  const content: Partial<Record<DesignNode['type'], DesignNode['content']>> = {
    Text: { kind: 'text', text: 'Hello' },
    Heading: { kind: 'heading', text: 'Title', level: 2 },
    Image: { kind: 'image', src: 'asset:a.png', alt: 'A' },
    Link: { kind: 'link', text: 'Go', href: '/go' },
    Button: { kind: 'button', text: 'Buy', variant: 'primary' },
    List: { kind: 'list', emptyText: 'None' },
    Tabs: { kind: 'tabs', items: [{ id: 'a', label: 'A' }] },
    Section: { kind: 'section' },
    Container: { kind: 'container', maxWidth: 'xl' },
    Modal: { kind: 'modal', title: 'Dialog' },
    Slot: { kind: 'slot', name: 'actions' },
    ComponentInstance: { kind: 'instance', componentId: 'c_0000000001', propValues: {} },
  };
  return { id: nodeId(), type, content: content[type] ?? { kind: 'none' }, ...extra };
}

/** Rule codes (`V-xx`) reported by a failed parse. */
export function rulesOf(result: z.ZodSafeParseResult<unknown>): string[] {
  if (result.success) return [];
  return [
    ...new Set(
      result.error.issues.flatMap((issue) => {
        const rule = (issue as { params?: { rule?: unknown } }).params?.rule;
        if (typeof rule === 'string') return [rule];
        const fromMessage = /\((V-\d+)\)/.exec(issue.message)?.[1];
        return fromMessage === undefined ? [] : [fromMessage];
      }),
    ),
  ];
}
