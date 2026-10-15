// Schemas and types for History Undo/Redo (SPEC-03 section 5.6, SPEC-04 section 7).
import { z } from 'zod';

import { RelPathSchema } from './rel-path.ts';

export const HistoryLabelSchema = z.strictObject({
  key: z.string().min(1),
  params: z.record(z.string(), z.string()).optional(),
});
export type HistoryLabel = z.infer<typeof HistoryLabelSchema>;

export const HistoryStateSchema = z.strictObject({
  undo: HistoryLabelSchema.optional(),
  redo: HistoryLabelSchema.optional(),
  undoCount: z.number().int().min(0),
  redoCount: z.number().int().min(0),
});
export type HistoryState = z.infer<typeof HistoryStateSchema>;

export const HistoryStepSchema = z.strictObject({
  state: HistoryStateSchema,
  files: z.array(RelPathSchema),
});
export type HistoryStep = z.infer<typeof HistoryStepSchema>;
