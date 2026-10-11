// Interactions: "when <trigger> on <node> run <actions>" from a closed set (SPEC-03 section 6a).
// Rules that need the document (V-90 to V-94, V-96 per node, V-98) live in validateDocument.
import { z } from 'zod';

import { EndpointIdSchema, NodeIdSchema, PageIdSchema } from './primitives.schema.ts';

/** V-97: URLs opened by an interaction. */
export const OPEN_URL_PATTERN = /^(https:\/\/|http:\/\/|mailto:|tel:)/;

export const InteractionTriggerSchema = z.enum(['click', 'submitSuccess', 'submitError']);
export type InteractionTrigger = z.infer<typeof InteractionTriggerSchema>;

export const ParamSourceSchema = z.discriminatedUnion('kind', [
  z.strictObject({ kind: z.literal('field'), field: z.string().min(1) }),
  z.strictObject({ kind: z.literal('static'), value: z.string() }),
]);
export type ParamSource = z.infer<typeof ParamSourceSchema>;

export const InteractionActionSchema = z.discriminatedUnion('type', [
  z.strictObject({
    type: z.literal('navigate'),
    pageId: PageIdSchema,
    params: z.record(z.string(), ParamSourceSchema).optional(),
  }),
  z.strictObject({
    type: z.literal('openUrl'),
    url: z.string().regex(OPEN_URL_PATTERN, { message: 'URL scheme not allowed (V-97)' }),
    newTab: z.boolean(),
  }),
  z.strictObject({ type: z.literal('openModal'), modalId: NodeIdSchema }),
  z.strictObject({ type: z.literal('closeModal'), modalId: NodeIdSchema.optional() }),
  z.strictObject({ type: z.enum(['show', 'hide', 'toggle']), targetId: NodeIdSchema }),
  z.strictObject({ type: z.literal('scrollTo'), targetId: NodeIdSchema }),
  z.strictObject({ type: z.literal('switchTab'), tabsId: NodeIdSchema, tabId: z.string().min(1) }),
  z.strictObject({
    type: z.literal('showToast'),
    message: z.string().min(1).max(500),
    tone: z.enum(['success', 'error', 'info']),
  }),
  z.strictObject({ type: z.literal('refreshData'), targetId: NodeIdSchema }),
  z.strictObject({
    type: z.literal('deleteRecord'),
    endpoint: EndpointIdSchema,
    confirm: z.strictObject({ title: z.string().min(1), message: z.string().min(1) }),
  }),
]);
export type InteractionAction = z.infer<typeof InteractionActionSchema>;

/** V-96: at most 5 actions per interaction. */
export const InteractionActionsSchema = z.array(InteractionActionSchema).min(1).max(5);

export const InteractionSchema = z.strictObject({
  id: z.string().regex(/^i_[A-Za-z0-9_-]{8}$/),
  trigger: InteractionTriggerSchema,
  actions: InteractionActionsSchema,
});
export type Interaction = z.infer<typeof InteractionSchema>;
