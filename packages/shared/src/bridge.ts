// Schemas and types for Bridge protocol (SPEC-03 section 7, V-110..114).
import { z } from 'zod';

import { ElementGuardSchema, InsertTargetSchema } from './source.ts';

export const ElementRefSchema = z.strictObject({
  loc: z.string().min(1),
  index: z.number().int().min(0),
});
export type ElementRef = z.infer<typeof ElementRefSchema>;

export const RectSchema = z.strictObject({
  x: z.number(),
  y: z.number(),
  width: z.number(),
  height: z.number(),
});
export type Rect = z.infer<typeof RectSchema>;

export const ElementInfoSchema = z.strictObject({
  ref: ElementRefSchema,
  found: z.boolean(),
  tag: z.string().min(1),
  rect: RectSchema.optional(),
  instances: z.number().int().min(1),
  domClass: z.string().max(4000).optional(),
});
export type ElementInfo = z.infer<typeof ElementInfoSchema>;

export const TreeNodeSchema = z.strictObject({
  ref: ElementRefSchema,
  parent: z.number().int().min(0).optional(),
  tag: z.string().min(1),
  label: z.string().max(100).optional(),
  instances: z.number().int().min(1),
});
export type TreeNode = z.infer<typeof TreeNodeSchema>;

/** V-110..V-114: Bridge message envelope. */
export const BridgeEnvelopeSchema = z.strictObject({
  rc: z.literal(1),
  nonce: z.string().min(1),
  type: z.string().min(1),
  payload: z.unknown(),
});
export type BridgeEnvelope = z.infer<typeof BridgeEnvelopeSchema>;

// Payloads from Bridge to Studio
export const BridgeReadyPayloadSchema = z.strictObject({
  bridgeVersion: z.string().min(1),
  route: z.string(),
});
export type BridgeReadyPayload = z.infer<typeof BridgeReadyPayloadSchema>;

export const BridgeHoverPayloadSchema = z.strictObject({
  ref: ElementRefSchema.optional(),
});
export type BridgeHoverPayload = z.infer<typeof BridgeHoverPayloadSchema>;

export const BridgeSelectPayloadSchema = z.strictObject({
  refs: z.array(ElementRefSchema),
});
export type BridgeSelectPayload = z.infer<typeof BridgeSelectPayloadSchema>;

export const BridgeSelectionInfoPayloadSchema = z.strictObject({
  items: z.array(ElementInfoSchema),
});
export type BridgeSelectionInfoPayload = z.infer<typeof BridgeSelectionInfoPayloadSchema>;

export const BridgeTreePayloadSchema = z.strictObject({
  nodes: z.array(TreeNodeSchema).max(5000),
  truncated: z.boolean().optional(),
});
export type BridgeTreePayload = z.infer<typeof BridgeTreePayloadSchema>;

export const BridgeRoutePayloadSchema = z.strictObject({
  route: z.string(),
});
export type BridgeRoutePayload = z.infer<typeof BridgeRoutePayloadSchema>;

export const BridgeRuntimeErrorPayloadSchema = z.strictObject({
  message: z.string().max(2000),
  stack: z.string().max(8000).optional(),
});
export type BridgeRuntimeErrorPayload = z.infer<typeof BridgeRuntimeErrorPayloadSchema>;

export const BridgeShortcutPayloadSchema = z.strictObject({
  key: z.string(),
  ctrl: z.boolean(),
  meta: z.boolean(),
  shift: z.boolean(),
  alt: z.boolean(),
});
export type BridgeShortcutPayload = z.infer<typeof BridgeShortcutPayloadSchema>;

export const BridgeTextEditRequestPayloadSchema = z.strictObject({
  ref: ElementRefSchema,
});
export type BridgeTextEditRequestPayload = z.infer<typeof BridgeTextEditRequestPayloadSchema>;

export const BridgeTextCommitPayloadSchema = z.strictObject({
  ref: ElementRefSchema,
  text: z.string(),
});
export type BridgeTextCommitPayload = z.infer<typeof BridgeTextCommitPayloadSchema>;

export const BridgeTextCancelPayloadSchema = z.strictObject({
  ref: ElementRefSchema,
});
export type BridgeTextCancelPayload = z.infer<typeof BridgeTextCancelPayloadSchema>;

// Payloads from Studio to Bridge
export const StudioSetModePayloadSchema = z.strictObject({
  mode: z.enum(['design', 'preview']),
});
export type StudioSetModePayload = z.infer<typeof StudioSetModePayloadSchema>;

export const StudioSelectPayloadSchema = z.strictObject({
  refs: z.array(ElementRefSchema),
  reveal: z.boolean(),
});
export type StudioSelectPayload = z.infer<typeof StudioSelectPayloadSchema>;

export const StudioHighlightPayloadSchema = z.strictObject({
  ref: ElementRefSchema.optional(),
});
export type StudioHighlightPayload = z.infer<typeof StudioHighlightPayloadSchema>;

export const StudioTextEditStartPayloadSchema = z.strictObject({
  ref: ElementRefSchema,
});
export type StudioTextEditStartPayload = z.infer<typeof StudioTextEditStartPayloadSchema>;

export const StudioTextEditEndPayloadSchema = z.strictObject({
  ref: ElementRefSchema,
});
export type StudioTextEditEndPayload = z.infer<typeof StudioTextEditEndPayloadSchema>;

export const BridgeBuildErrorPayloadSchema = z.strictObject({
  message: z.string().max(2000),
  /** Relative to the project root (R-BR-17). */
  file: z.string().max(1024).optional(),
  line: z.number().int().min(1).optional(),
  column: z.number().int().min(1).optional(),
});
export type BridgeBuildErrorPayload = z.infer<typeof BridgeBuildErrorPayloadSchema>;

export const StudioNavigatePayloadSchema = z.strictObject({
  route: z.string().min(1).max(2048),
});
export type StudioNavigatePayload = z.infer<typeof StudioNavigatePayloadSchema>;

export const DropRectSchema = z.strictObject({
  x: z.number(),
  y: z.number(),
  width: z.number(),
  height: z.number(),
});
export type DropRect = z.infer<typeof DropRectSchema>;

// Bridge -> Studio. {} = currently no valid drop target (spec-log #21).
export const BridgeDropTargetPayloadSchema = z.union([
  z.strictObject({ target: InsertTargetSchema, rect: DropRectSchema, label: z.string().max(100) }),
  z.strictObject({}),
]);
export type BridgeDropTargetPayload = z.infer<typeof BridgeDropTargetPayloadSchema>;

// Bridge -> Studio, when dropping a drag inside Canvas (R-DD-14).
export const BridgeMoveIntentPayloadSchema = z.strictObject({
  elements: z.array(ElementGuardSchema).min(1).max(50),
  target: InsertTargetSchema,
});
export type BridgeMoveIntentPayload = z.infer<typeof BridgeMoveIntentPayloadSchema>;

// Studio -> Bridge (R-DD-10). x, y are iframe viewport coords, already divided by zoom.
export const StudioDragOverPayloadSchema = z.strictObject({
  x: z.number(),
  y: z.number(),
  source: z.enum(['library', 'layer']),
  refs: z.array(ElementRefSchema).max(50).optional(),
});
export type StudioDragOverPayload = z.infer<typeof StudioDragOverPayloadSchema>;

export const StudioDragEndPayloadSchema = z.strictObject({ drop: z.boolean() });
export type StudioDragEndPayload = z.infer<typeof StudioDragEndPayloadSchema>;
