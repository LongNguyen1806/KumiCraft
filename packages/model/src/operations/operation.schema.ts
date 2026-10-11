// Design Operations (SPEC-03 section 7.2). Payloads that set node, token or page values are checked
// in depth after they are applied, by the schemas of the node, the tokens or the page, so each rule
// lives in one place.
import { z } from 'zod';

import { BindingSchema } from '../schema/binding.schema.ts';
import {
  ComponentPropDefSchema,
  PageSchema,
  UserComponentSchema,
} from '../schema/document.schema.ts';
import { InteractionSchema } from '../schema/interaction.schema.ts';
import { DesignNodeSchema } from '../schema/node.schema.ts';
import {
  BreakpointSchema,
  ComponentIdSchema,
  FrameSchema,
  InteractionStateSchema,
  NodeIdSchema,
  PageIdSchema,
  ResponsiveModeSchema,
  TOKEN_NAME_PATTERN,
  TokenGroupSchema,
} from '../schema/primitives.schema.ts';

export const TreeTargetSchema = z.discriminatedUnion('kind', [
  z.strictObject({ kind: z.literal('page'), pageId: PageIdSchema }),
  z.strictObject({ kind: z.literal('component'), componentId: ComponentIdSchema }),
]);
export type TreeTarget = z.infer<typeof TreeTargetSchema>;

/** Where a style change goes. No breakpoint means `base`; a state needs `base` (V-28). */
export const StyleScopeSchema = z
  .strictObject({
    breakpoint: BreakpointSchema.optional(),
    state: InteractionStateSchema.optional(),
  })
  .refine((scope) => scope.state === undefined || (scope.breakpoint ?? 'base') === 'base', {
    message: 'States apply at the base breakpoint only (V-28)',
  });
export type StyleScope = z.infer<typeof StyleScopeSchema>;

const index = z.int().min(0);
const target = TreeTargetSchema;
const nodeId = NodeIdSchema;
const tokenName = z.string().regex(TOKEN_NAME_PATTERN);
const slotName = z.string().regex(/^[a-z][A-Za-z0-9]{0,31}$/);
/** Partial object whose values are checked once applied. */
const partial = z.record(z.string(), z.unknown());

/** A value path inside a node, for example `['style', 'padding', 'top']`. */
const valuePath = z.array(z.union([z.string(), z.int().min(0)])).min(1);

export const DesignOperationSchema = z.discriminatedUnion('op', [
  // --- Node tree ---
  z.strictObject({
    op: z.literal('insert'),
    target,
    parentId: nodeId,
    index,
    node: DesignNodeSchema,
    slotName: slotName.optional(),
  }),
  z.strictObject({ op: z.literal('remove'), target, nodeId }),
  z.strictObject({
    op: z.literal('move'),
    target,
    nodeId,
    newParentId: nodeId,
    index,
    slotName: slotName.optional(),
  }),
  z.strictObject({
    op: z.literal('setStyle'),
    target,
    nodeId,
    scope: StyleScopeSchema,
    set: partial,
    unset: z.array(z.string()).optional(),
  }),
  z.strictObject({
    op: z.literal('setContent'),
    target,
    nodeId,
    set: partial,
    unset: z.array(z.string()).optional(),
  }),
  z.strictObject({
    op: z.literal('setBinding'),
    target,
    nodeId,
    key: z.string().min(1),
    binding: BindingSchema.optional(),
  }),
  z.strictObject({
    op: z.literal('setNodeMeta'),
    target,
    nodeId,
    name: z.string().min(1).max(64).optional(),
    hidden: z.boolean().optional(),
    locked: z.boolean().optional(),
    unset: z.array(z.enum(['name', 'hidden', 'locked'])).optional(),
  }),
  z.strictObject({
    op: z.literal('wrap'),
    target,
    nodeIds: z.array(nodeId).min(1),
    wrapper: DesignNodeSchema,
  }),
  z.strictObject({ op: z.literal('unwrap'), target, wrapperId: nodeId }),
  z.strictObject({
    op: z.literal('setInteractions'),
    target,
    nodeId,
    interactions: z.array(InteractionSchema),
  }),
  z.strictObject({
    op: z.literal('setRuntime'),
    target,
    nodeId,
    initiallyHidden: z.boolean().optional(),
  }),
  // Internal: restores recorded values (inverse of token.replace).
  z.strictObject({
    op: z.literal('node.restoreValues'),
    entries: z.array(
      z.strictObject({ target, nodeId, path: valuePath, value: z.unknown().optional() }),
    ),
  }),

  // --- Pages ---
  z.strictObject({ op: z.literal('page.create'), page: PageSchema, index }),
  z.strictObject({ op: z.literal('page.delete'), pageId: PageIdSchema }),
  z.strictObject({
    op: z.literal('page.update'),
    pageId: PageIdSchema,
    name: z.string().min(1).max(64).optional(),
    route: z.string().optional(),
    title: z.string().min(1).max(70).optional(),
    description: z.string().min(1).max(300).optional(),
    unset: z.array(z.enum(['title', 'description'])).optional(),
  }),
  z.strictObject({ op: z.literal('page.reorder'), pageId: PageIdSchema, index }),

  // --- Tokens ---
  z.strictObject({
    op: z.literal('token.set'),
    group: TokenGroupSchema,
    name: tokenName,
    entry: z.unknown(),
  }),
  z.strictObject({ op: z.literal('token.delete'), group: TokenGroupSchema, name: tokenName }),
  z.strictObject({
    op: z.literal('token.rename'),
    group: TokenGroupSchema,
    from: tokenName,
    to: tokenName,
  }),
  /** `with` is another token name of the group, or a literal value such as `{ px: 16 }`. */
  z.strictObject({
    op: z.literal('token.replace'),
    group: TokenGroupSchema,
    from: tokenName,
    with: z.union([z.strictObject({ token: tokenName }), z.strictObject({ value: z.unknown() })]),
  }),

  // --- Components ---
  z.strictObject({ op: z.literal('component.create'), component: UserComponentSchema }),
  z.strictObject({ op: z.literal('component.delete'), componentId: ComponentIdSchema }),
  z.strictObject({
    op: z.literal('component.update'),
    componentId: ComponentIdSchema,
    name: z.string().optional(),
    props: z.array(ComponentPropDefSchema).optional(),
  }),

  // --- Workspace ---
  z.strictObject({
    op: z.literal('workspace.update'),
    name: z.string().min(1).max(64).optional(),
    responsiveMode: ResponsiveModeSchema.optional(),
    frames: z.array(FrameSchema).optional(),
    primaryFrameId: z.string().optional(),
    contentLocale: z.string().optional(),
    darkMode: z.enum(['none', 'media', 'class']).optional(),
  }),
]);
export type DesignOperation = z.infer<typeof DesignOperationSchema>;
export type OperationKind = DesignOperation['op'];
/** The operation of kind `K`. */
export type OperationOf<K extends OperationKind> = Extract<DesignOperation, { op: K }>;

/** SPEC-03 section 7.5: a batch sent by the Studio or proposed by the AI. */
export const OperationBatchSchema = z.strictObject({
  baseRevision: z.int().min(0),
  ops: z.array(DesignOperationSchema).min(1).max(500),
  meta: z.strictObject({
    source: z.enum(['user', 'ai']),
    label: z.string().min(1).max(200),
    aiProposalId: z.string().min(1).optional(),
  }),
});
export type OperationBatch = z.infer<typeof OperationBatchSchema>;
