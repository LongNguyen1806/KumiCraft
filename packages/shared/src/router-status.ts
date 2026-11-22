import { z } from 'zod';

import { RelPathSchema } from './rel-path.ts';

/** `fileSystem`: pages are files in folders (Next.js `app/`, `pages/`), no route list to edit. */
export const RouterKindSchema = z.enum(['dataRouter', 'jsxRoutes', 'express', 'fileSystem']);
export type RouterKind = z.infer<typeof RouterKindSchema>;

export const RouterStatusSchema = z.discriminatedUnion('status', [
  z.strictObject({
    status: z.literal('found'),
    file: RelPathSchema,
    line: z.number().int().min(1),
    kind: RouterKindSchema,
    chosen: z.boolean(),
  }),
  z.strictObject({
    status: z.literal('ambiguous'),
    candidates: z.array(RelPathSchema).min(2).max(10),
  }),
  z.strictObject({
    status: z.literal('unsupported'),
    file: RelPathSchema,
    reason: z.enum(['generated', 'noRoutes', 'parseError']),
  }),
  z.strictObject({
    status: z.literal('none'),
    hasRouterPackage: z.boolean(),
  }),
]);
export type RouterStatus = z.infer<typeof RouterStatusSchema>;
