// Projects opened before, kept in the user's config (R-PJ-25).
import { z } from 'zod';

/** A project opened before, newest first, kept in the user's config (R-PJ-25). */
export const RecentProjectSchema = z.strictObject({
  path: z.string().min(1).max(1024),
  name: z.string().max(200),
  openedAt: z.string().max(40),
});
export type RecentProject = z.infer<typeof RecentProjectSchema>;
export const RecentProjectsSchema = z.array(RecentProjectSchema).max(8);
