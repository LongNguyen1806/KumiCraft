// On-demand build check of the open project (SPEC-04 M-BC, K9 stage C).
import { z } from 'zod';

import { RelPathSchema } from './rel-path.ts';

export const BUILD_PROBLEM_SOURCES = ['tsc', 'vite', 'pug'] as const;
export const BuildProblemSourceSchema = z.enum(BUILD_PROBLEM_SOURCES);
export type BuildProblemSource = z.infer<typeof BuildProblemSourceSchema>;

/** Most problems one check returns; the rest only count in `total`. */
export const MAX_BUILD_PROBLEMS = 200;

/**
 * One error of the check. `file` is absent when the tool names no file inside the project (a
 * broken config, a missing package): the message alone is shown then.
 */
export const BuildProblemSchema = z.strictObject({
  file: RelPathSchema.optional(),
  line: z.number().int().min(1).optional(),
  column: z.number().int().min(1).optional(),
  message: z.string().max(2000),
  source: BuildProblemSourceSchema,
});
export type BuildProblem = z.infer<typeof BuildProblemSchema>;

export const BuildCheckResultSchema = z.strictObject({
  ok: z.boolean(),
  problems: z.array(BuildProblemSchema).max(MAX_BUILD_PROBLEMS),
  /** Every problem found, also those past MAX_BUILD_PROBLEMS. */
  total: z.number().int().min(0),
  durationMs: z.number().int().min(0),
});
export type BuildCheckResult = z.infer<typeof BuildCheckResultSchema>;
