import { z } from 'zod';

import { RelPathSchema } from './rel-path.ts';
import {
  type RouterKind,
  RouterKindSchema,
  type RouterStatus,
  RouterStatusSchema,
} from './router-status.ts';

export { type RouterKind, RouterKindSchema, type RouterStatus, RouterStatusSchema };

/** A page of the project as its router declares it (SPEC-04 M-PG). */
export const PageInfoSchema = z.strictObject({
  path: z.string().min(1),
  component: z.string().optional(),
  file: RelPathSchema.optional(),
  /** The path has `:param`; the user gives a value before navigating (R-PG-15). */
  dynamic: z.boolean(),
});
export type PageInfo = z.infer<typeof PageInfoSchema>;

export const PagesInfoSchema = z.strictObject({
  /** The project follows R-PG-10, so pages can be added, renamed and removed (Phase 2). */
  convention: z.boolean(),
  routesFile: RelPathSchema.optional(),
  router: RouterStatusSchema,
  pages: z.array(PageInfoSchema),
});
export type PagesInfo = z.infer<typeof PagesInfoSchema>;

export const AddPageSchema = z.strictObject({
  name: z.string().trim().min(1).max(64),
  path: z.string().max(200).optional(),
  dir: RelPathSchema.optional(),
  fileName: z.string().max(100).optional(),
});
export type AddPage = z.infer<typeof AddPageSchema>;

export const RenamePageSchema = z.strictObject({
  path: z.string().min(1),
  newPath: z.string().max(200).optional(),
  newName: z.string().trim().min(1).max(64).optional(),
});
export type RenamePage = z.infer<typeof RenamePageSchema>;

export const DeletePageSchema = z.strictObject({ path: z.string().min(1) });
export type DeletePage = z.infer<typeof DeletePageSchema>;
