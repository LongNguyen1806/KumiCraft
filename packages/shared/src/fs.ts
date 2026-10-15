// Types and schemas for directory browser (/fs/directories, SPEC-03 section 5.1, S-27).
import { z } from 'zod';

export const DirectoryListingEntrySchema = z.strictObject({
  name: z.string().min(1),
  path: z.string().min(1),
  isProject: z.boolean(),
});
export type DirectoryListingEntry = z.infer<typeof DirectoryListingEntrySchema>;

export const DirectoryListingSchema = z.strictObject({
  path: z.string().min(1),
  parent: z.string().optional(),
  roots: z.array(z.string()).optional(),
  entries: z.array(DirectoryListingEntrySchema),
  truncated: z.literal(true).optional(),
});
export type DirectoryListing = z.infer<typeof DirectoryListingSchema>;
