// Element tree of one JSX file, read from the source for external AI agents (R-AG-19, round 7a).
import { z } from 'zod';

/** Most nodes one tree answer carries; past it the tree is cut and `truncated` is set. */
export const PAGE_TREE_MAX_NODES = 2000;
export const PAGE_TREE_MAX_DEPTH = 40;

export const PAGE_TREE_NODE_KINDS = ['element', 'component', 'fragment'] as const;

export type PageTreeNode = {
  /** Same `file:line:column` the Bridge puts on the element in the Canvas. */
  readonly loc: string;
  readonly tag: string;
  readonly kind: (typeof PAGE_TREE_NODE_KINDS)[number];
  /** Only when className is a plain string. */
  readonly className?: string | undefined;
  /** Static text directly inside the element, cut to 80 characters. */
  readonly text?: string | undefined;
  readonly children: readonly PageTreeNode[];
};

export const PageTreeNodeSchema: z.ZodType<PageTreeNode> = z.lazy(() =>
  z.strictObject({
    loc: z.string().min(1),
    tag: z.string().min(1).max(200),
    kind: z.enum(PAGE_TREE_NODE_KINDS),
    className: z.string().optional(),
    text: z.string().max(80).optional(),
    children: z.array(PageTreeNodeSchema).readonly(),
  }),
);

export const PageTreeSchema = z.strictObject({
  file: z.string().min(1),
  roots: z.array(PageTreeNodeSchema).readonly(),
  truncated: z.boolean(),
});
export type PageTree = z.infer<typeof PageTreeSchema>;
