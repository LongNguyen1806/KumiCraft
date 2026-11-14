// Schemas for K9.8-1 interaction & state edits: text runs, SelectGroup, Dark mode, Toast, LoadingButton, Links, ScrollSpy.
import { z } from 'zod';

import { RelPathSchema } from './rel-path.ts';
import { StyleSystemIdSchema } from './responsive.ts';

const ElementGuardSchema = z.strictObject({
  loc: z.string().min(1),
  tag: z.string().min(1),
});

export const TextRunNodeSchema = z.discriminatedUnion('kind', [
  z.strictObject({
    kind: z.literal('text'),
    runIndex: z.number().int().min(0),
    value: z.string(),
  }),
  z.strictObject({
    kind: z.literal('element'),
    tag: z.string().min(1),
    iconName: z.string().optional(),
  }),
  z.strictObject({
    kind: z.literal('expression'),
    code: z.string().max(200),
  }),
]);
export type TextRunNode = z.infer<typeof TextRunNodeSchema>;

export const SetTextRunEditSchema = z.strictObject({
  kind: z.literal('setTextRun'),
  loc: z.string().min(1),
  tag: z.string().min(1),
  index: z.number().int().min(0),
  before: z.string(),
  after: z.string(),
});
export type SetTextRunEdit = z.infer<typeof SetTextRunEditSchema>;

export const SelectGroupModeSchema = z.enum(['single', 'multiple']);
export type SelectGroupMode = z.infer<typeof SelectGroupModeSchema>;

export const MakeSelectGroupActionSchema = z.strictObject({
  action: z.literal('makeSelectGroup'),
  elements: z.array(ElementGuardSchema).min(2).max(50),
  mode: SelectGroupModeSchema,
  styleSystem: StyleSystemIdSchema.optional(),
});
export type MakeSelectGroupAction = z.infer<typeof MakeSelectGroupActionSchema>;

export const LinkSelectContentActionSchema = z.strictObject({
  action: z.literal('linkSelectContent'),
  group: ElementGuardSchema,
  items: z.array(ElementGuardSchema).min(1).max(50),
  target: ElementGuardSchema,
  defaultLabelPrefix: z.string().max(60).optional(),
});
export type LinkSelectContentAction = z.infer<typeof LinkSelectContentActionSchema>;

export const RemoveSelectGroupActionSchema = z.strictObject({
  action: z.literal('removeSelectGroup'),
  group: ElementGuardSchema,
  styleSystem: StyleSystemIdSchema.optional(),
});
export type RemoveSelectGroupAction = z.infer<typeof RemoveSelectGroupActionSchema>;

export const ToastVariantSchema = z.enum(['success', 'error', 'info']);
export type ToastVariant = z.infer<typeof ToastVariantSchema>;

export const ToastPositionSchema = z.enum([
  'bottom-right',
  'bottom-left',
  'top-right',
  'top-left',
  'top-center',
  'bottom-center',
]);
export type ToastPosition = z.infer<typeof ToastPositionSchema>;

export const AddToastOnClickActionSchema = z.strictObject({
  action: z.literal('addToastOnClick'),
  element: ElementGuardSchema,
  message: z.string().min(1).max(200),
  subtext: z.string().max(200).optional(),
  variant: ToastVariantSchema.optional(),
  durationMs: z.number().int().min(1000).max(15000).optional(),
  position: ToastPositionSchema.optional(),
});
export type AddToastOnClickAction = z.infer<typeof AddToastOnClickActionSchema>;

export const MakeLoadingButtonActionSchema = z.strictObject({
  action: z.literal('makeLoadingButton'),
  element: ElementGuardSchema,
  loadingText: z.string().max(100).optional(),
});
export type MakeLoadingButtonAction = z.infer<typeof MakeLoadingButtonActionSchema>;

export const MarkActiveNavActionSchema = z.strictObject({
  action: z.literal('markActiveNav'),
  element: ElementGuardSchema,
});
export type MarkActiveNavAction = z.infer<typeof MarkActiveNavActionSchema>;

export const SetLinkTargetActionSchema = z.strictObject({
  action: z.literal('setLinkTarget'),
  element: ElementGuardSchema,
  targetKind: z.enum(['section', 'route', 'external']),
  target: z.string().min(1).max(500),
  newTab: z.boolean().optional(),
});
export type SetLinkTargetAction = z.infer<typeof SetLinkTargetActionSchema>;

export const InteractionActionSchema = z.discriminatedUnion('action', [
  MakeSelectGroupActionSchema,
  LinkSelectContentActionSchema,
  RemoveSelectGroupActionSchema,
  AddToastOnClickActionSchema,
  MakeLoadingButtonActionSchema,
  MarkActiveNavActionSchema,
  SetLinkTargetActionSchema,
]);
export type InteractionAction = z.infer<typeof InteractionActionSchema>;

export const InteractionResultSchema = z.strictObject({
  changed: z.boolean(),
  files: z.array(RelPathSchema),
  locs: z.array(z.string()),
  groupLoc: z.string().optional(),
  itemValues: z.array(z.string()).optional(),
  selectedClassesExtracted: z.record(z.string(), z.string()).optional(),
});
export type InteractionResult = z.infer<typeof InteractionResultSchema>;

export const EnableDarkModeRequestSchema = z.strictObject({
  checkOnly: z.boolean().optional(),
});
export type EnableDarkModeRequest = z.infer<typeof EnableDarkModeRequestSchema>;

export const EnableDarkModeResultSchema = z.strictObject({
  enabled: z.boolean(),
  changed: z.boolean(),
  files: z.array(RelPathSchema),
  themeFile: RelPathSchema.optional(),
  entryFile: RelPathSchema.optional(),
  cssFile: RelPathSchema.optional(),
  manualHint: z.string().max(500).optional(),
});
export type EnableDarkModeResult = z.infer<typeof EnableDarkModeResultSchema>;

export const ApplySmoothScrollRequestSchema = z.strictObject({
  enabled: z.boolean(),
  targetLoc: z.string().min(1).optional(),
  targetTag: z.string().min(1).optional(),
  headerHeightPx: z.number().int().min(0).max(600).optional(),
});
export type ApplySmoothScrollRequest = z.infer<typeof ApplySmoothScrollRequestSchema>;

export const ApplySmoothScrollResultSchema = z.strictObject({
  changed: z.boolean(),
  enabled: z.boolean(),
  files: z.array(RelPathSchema),
  /** The project already scrolls smoothly by itself: no second rule was added (QA K9.8-1). */
  alreadySmooth: z.boolean().optional(),
});
export type ApplySmoothScrollResult = z.infer<typeof ApplySmoothScrollResultSchema>;
