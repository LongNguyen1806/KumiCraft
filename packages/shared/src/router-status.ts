import { z } from 'zod';

import { RelPathSchema } from './rel-path.ts';

export const RouterKindSchema = z.enum(['dataRouter', 'jsxRoutes', 'express']);
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
