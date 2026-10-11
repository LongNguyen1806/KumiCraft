// Design nodes (SPEC-03 section 4): node types, the recursive node schema and the rules that need
// only the node itself (V-10, V-14, V-15, V-21, V-35, V-57 target, V-90, V-95, V-96).
import { z } from 'zod';

import { BindingSchema } from './binding.schema.ts';
import { type ContentKind, ContentPropsSchema } from './content.schema.ts';
import { InteractionSchema, type InteractionTrigger } from './interaction.schema.ts';
import { InteractionStateSchema, NodeIdSchema, ResponsiveKeySchema } from './primitives.schema.ts';
import { StateStylePropsSchema, StylePropsSchema } from './style.schema.ts';

export const NODE_TYPES = [
  'Stack',
  'Grid',
  'Section',
  'Container',
  'Text',
  'Heading',
  'Image',
  'Icon',
  'Link',
  'Divider',
  'Form',
  'Input',
  'Textarea',
  'Select',
  'Checkbox',
  'Radio',
  'Switch',
  'Button',
  'Table',
  'List',
  'DetailView',
  'Card',
  'Navbar',
  'Sidebar',
  'Footer',
  'Modal',
  'Tabs',
  'ComponentInstance',
  'Slot',
] as const;
export const NodeTypeSchema = z.enum(NODE_TYPES);
export type NodeType = z.infer<typeof NodeTypeSchema>;

/** Node types that may have `children` (SPEC-03 table 4.2). */
export const CONTAINER_TYPES: ReadonlySet<NodeType> = new Set([
  'Stack',
  'Grid',
  'Section',
  'Container',
  'Form',
  'List',
  'DetailView',
  'Card',
  'Navbar',
  'Sidebar',
  'Footer',
  'Modal',
  'Tabs',
]);

/** V-21: content kind required by each node type. */
export const CONTENT_KIND_BY_TYPE: Readonly<Record<NodeType, ContentKind>> = {
  Stack: 'none',
  Grid: 'none',
  Section: 'section',
  Container: 'container',
  Text: 'text',
  Heading: 'heading',
  Image: 'image',
  Icon: 'icon',
  Link: 'link',
  Divider: 'none',
  Form: 'none',
  Input: 'input',
  Textarea: 'textarea',
  Select: 'select',
  Checkbox: 'choice',
  Radio: 'choice',
  Switch: 'choice',
  Button: 'button',
  Table: 'table',
  List: 'list',
  DetailView: 'detail',
  Card: 'none',
  Navbar: 'none',
  Sidebar: 'none',
  Footer: 'none',
  Modal: 'modal',
  Tabs: 'tabs',
  ComponentInstance: 'instance',
  Slot: 'slot',
};

/** V-90: node types on which each trigger may be set (SPEC-03 section 6a.2). */
export const TRIGGER_NODE_TYPES: Readonly<Record<InteractionTrigger, ReadonlySet<NodeType>>> = {
  click: new Set([
    'Button',
    'Link',
    'Icon',
    'Image',
    'Card',
    'Stack',
    'Grid',
    'Heading',
    'Text',
    'ComponentInstance',
  ]),
  submitSuccess: new Set(['Form']),
  submitError: new Set(['Form']),
};

/** V-57: node types whose property a component prop may drive. */
export const PROP_REF_TARGET_TYPES = {
  text: new Set<NodeType>(['Text', 'Heading', 'Button', 'Link']),
  src: new Set<NodeType>(['Image']),
  alt: new Set<NodeType>(['Image']),
  href: new Set<NodeType>(['Link']),
} as const;

const MAX_INTERACTIONS_PER_NODE = 10; // V-96

const NodeBaseSchema = z.strictObject({
  id: NodeIdSchema,
  type: NodeTypeSchema,
  name: z.string().min(1).max(64).optional(),
  style: StylePropsSchema.optional(),
  responsive: z.partialRecord(ResponsiveKeySchema, StylePropsSchema).optional(),
  states: z.partialRecord(InteractionStateSchema, StateStylePropsSchema).optional(),
  content: ContentPropsSchema.optional(),
  bindings: z.record(z.string(), BindingSchema).optional(),
  hidden: z.boolean().optional(),
  locked: z.boolean().optional(),
  interactions: z.array(InteractionSchema).optional(),
  runtime: z.strictObject({ initiallyHidden: z.boolean().optional() }).optional(),
  propRef: z
    .strictObject({
      prop: z.string().regex(/^[a-z][A-Za-z0-9]{0,63}$/),
      target: z.enum(['text', 'src', 'href', 'alt']),
    })
    .optional(),
});

export type DesignNode = z.infer<typeof NodeBaseSchema> & {
  children?: DesignNode[] | undefined;
  slots?: Record<string, DesignNode[]> | undefined;
};

type Issue = {
  readonly rule: string;
  readonly message: string;
  readonly path?: (string | number)[];
};

function contentRules(node: DesignNode): Issue[] {
  const issues: Issue[] = [];
  const expected = CONTENT_KIND_BY_TYPE[node.type];
  const actual = node.content?.kind ?? 'none';
  if (actual !== expected) {
    issues.push({
      rule: 'V-21',
      message: `${node.type} needs content kind "${expected}"`,
      path: ['content'],
    });
  }
  const content = node.content;
  if (
    content !== undefined &&
    'runs' in content &&
    content.runs !== undefined &&
    node.bindings?.['text']
  ) {
    issues.push({
      rule: 'V-35',
      message: 'A node with a text binding cannot have runs',
      path: ['content', 'runs'],
    });
  }
  if (content?.kind === 'link') {
    const hasClick = node.interactions?.some((i) => i.trigger === 'click') ?? false;
    if ((content.href !== '') === hasClick) {
      issues.push({
        rule: 'V-95',
        message: 'A link uses either href or a click interaction',
        path: ['content', 'href'],
      });
    }
  }
  return issues;
}

function structureRules(node: DesignNode): Issue[] {
  const issues: Issue[] = [];
  const children = node.children ?? [];
  if (children.length > 0 && !CONTAINER_TYPES.has(node.type)) {
    issues.push({ rule: 'V-10', message: `${node.type} cannot have children`, path: ['children'] });
  }
  if (node.slots !== undefined && node.type !== 'ComponentInstance') {
    issues.push({ rule: 'V-18', message: 'Only a ComponentInstance has slots', path: ['slots'] });
  }
  if (node.type === 'List' && children.length !== 1) {
    issues.push({ rule: 'V-14', message: 'A List has exactly one child', path: ['children'] });
  }
  if (node.type === 'Tabs') {
    const items = node.content?.kind === 'tabs' ? node.content.items.length : 0;
    if (children.length !== items || children.some((child) => child.type !== 'Stack')) {
      issues.push({ rule: 'V-15', message: 'Tabs holds one Stack per item', path: ['children'] });
    }
  }
  return issues;
}

function interactionRules(node: DesignNode): Issue[] {
  const issues: Issue[] = [];
  const interactions = node.interactions ?? [];
  if (interactions.length > MAX_INTERACTIONS_PER_NODE) {
    issues.push({
      rule: 'V-96',
      message: 'At most 10 interactions per node',
      path: ['interactions'],
    });
  }
  interactions.forEach((interaction, i) => {
    if (!TRIGGER_NODE_TYPES[interaction.trigger].has(node.type)) {
      issues.push({
        rule: 'V-90',
        message: `Trigger "${interaction.trigger}" is not valid on ${node.type}`,
        path: ['interactions', i, 'trigger'],
      });
    }
  });
  if (node.propRef !== undefined) {
    const { target } = node.propRef;
    if (!PROP_REF_TARGET_TYPES[target].has(node.type) || node.bindings?.[target] !== undefined) {
      issues.push({
        rule: 'V-57',
        message: `propRef "${target}" does not fit ${node.type}`,
        path: ['propRef'],
      });
    }
  }
  return issues;
}

/** Rules that need only one node. Returned issues carry the rule code (for example `V-21`). */
export function checkNodeRules(node: DesignNode): readonly Issue[] {
  return [...contentRules(node), ...structureRules(node), ...interactionRules(node)];
}

export const DesignNodeSchema: z.ZodType<DesignNode> = z.lazy(() =>
  NodeBaseSchema.extend({
    children: z.array(DesignNodeSchema).optional(),
    slots: z.record(z.string(), z.array(DesignNodeSchema)).optional(),
  }).superRefine((node, ctx) => {
    for (const issue of checkNodeRules(node)) {
      ctx.addIssue({
        code: 'custom',
        message: `${issue.message} (${issue.rule})`,
        path: issue.path ?? [],
        params: { rule: issue.rule },
      });
    }
  }),
);
