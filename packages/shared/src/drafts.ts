// Types and schemas for draft pages and components (SPEC-03 section 5.4).
import { z } from 'zod';

import { RelPathSchema } from './rel-path.ts';

export const DraftInfoSchema = z.strictObject({
  name: z.string(),
  file: RelPathSchema,
  free: z.boolean(),
  inUse: z.boolean(),
});
export type DraftInfo = z.infer<typeof DraftInfoSchema>;

export const DraftsInfoSchema = z.strictObject({
  drafts: z.array(DraftInfoSchema),
  dir: RelPathSchema,
  ignored: z.boolean(),
});
export type DraftsInfo = z.infer<typeof DraftsInfoSchema>;

export const CreateDraftSchema = z.strictObject({
  name: z.string().trim().max(64).optional(),
  free: z.boolean(),
});
export type CreateDraft = z.infer<typeof CreateDraftSchema>;

export const RenameDraftSchema = z.strictObject({
  file: RelPathSchema,
  newName: z.string().trim().min(1).max(64),
});
export type RenameDraft = z.infer<typeof RenameDraftSchema>;

export const DraftFileSchema = z.strictObject({ file: RelPathSchema });
export type DraftFile = z.infer<typeof DraftFileSchema>;

export const PromoteDraftSchema = z.strictObject({
  file: RelPathSchema,
  as: z.enum(['page', 'component']),
  name: z.string().trim().min(1).max(64),
  dir: RelPathSchema.optional(),
  fileName: z.string().max(100).optional(),
  path: z.string().max(200).optional(),
  keepDraft: z.boolean(),
});
export type PromoteDraft = z.infer<typeof PromoteDraftSchema>;
