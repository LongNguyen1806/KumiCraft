// Schemas and types for project file tree operations (SPEC-04 K3b, spec-log #70).
import { z } from 'zod';

import { RelPathSchema } from './rel-path.ts';

export const FileTreeEntrySchema = z.strictObject({
  name: z.string().min(1).max(255),
  path: RelPathSchema,
  kind: z.enum(['file', 'directory']),
  hidden: z.boolean(),
});
export type FileTreeEntry = z.infer<typeof FileTreeEntrySchema>;

export const FileTreeListingSchema = z.strictObject({
  dir: z.string().max(1024),
  entries: z.array(FileTreeEntrySchema).max(2000),
  truncated: z.boolean(),
});
export type FileTreeListing = z.infer<typeof FileTreeListingSchema>;

export const FileCreateSchema = z.strictObject({
  path: RelPathSchema,
  kind: z.enum(['file', 'directory']),
});
export type FileCreate = z.infer<typeof FileCreateSchema>;

export const FileRenameSchema = z.strictObject({
  from: RelPathSchema,
  to: RelPathSchema,
});
export type FileRename = z.infer<typeof FileRenameSchema>;

export const FileDeleteSchema = z.strictObject({
  path: RelPathSchema,
});
export type FileDelete = z.infer<typeof FileDeleteSchema>;

export const FileImportersSchema = z.strictObject({
  importers: z.array(RelPathSchema).max(200),
  truncated: z.boolean(),
});
export type FileImporters = z.infer<typeof FileImportersSchema>;
