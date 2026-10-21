// Long-running tasks (SPEC-03 section 4.2, V-60 to V-62).
import { z } from 'zod';

import { AppErrorSchema } from './result.ts';

export const JOB_KINDS = ['project.install', 'agent.turn', 'agent.install', 'agent.login'] as const;
export const JobKindSchema = z.enum(JOB_KINDS);
export type JobKind = z.infer<typeof JobKindSchema>;

export const JOB_STATES = ['running', 'completed', 'failed', 'cancelled'] as const;
export const JobStateSchema = z.enum(JOB_STATES);
export type JobState = z.infer<typeof JobStateSchema>;

/** Newest output lines a job carries for the Studio (R-PJ-22; spec-log: not in SPEC-03 yet). */
export const MAX_JOB_LINES = 20;

export const JobIdSchema = z.string().min(1).max(64);

export const JobProgressSchema = z.strictObject({
  done: z.number().int().min(0),
  total: z.number().int().min(0),
  /** i18n key such as `jobs:install.running`, never a translated sentence (V-60). */
  stepKey: z.string().optional(),
});
export type JobProgress = z.infer<typeof JobProgressSchema>;

const JobLinesSchema = z.array(z.string()).max(MAX_JOB_LINES);

export const JobStatusSchema = z.strictObject({
  id: JobIdSchema,
  kind: JobKindSchema,
  state: JobStateSchema,
  progress: JobProgressSchema.optional(),
  lines: JobLinesSchema.optional(),
  result: z.unknown().optional(),
  error: AppErrorSchema.optional(),
  startedAt: z.string(),
  finishedAt: z.string().optional(),
});
export type JobStatus = z.infer<typeof JobStatusSchema>;

export const JobStartedSchema = z.strictObject({ jobId: JobIdSchema });
export type JobStarted = z.infer<typeof JobStartedSchema>;

export const JobProgressEventSchema = z.strictObject({
  jobId: JobIdSchema,
  kind: JobKindSchema,
  ...JobProgressSchema.shape,
  lines: JobLinesSchema.optional(),
});
export type JobProgressEvent = z.infer<typeof JobProgressEventSchema>;

export const JobCompletedEventSchema = z.strictObject({
  jobId: JobIdSchema,
  kind: JobKindSchema,
  result: z.unknown().optional(),
});
export type JobCompletedEvent = z.infer<typeof JobCompletedEventSchema>;

export const JobFailedEventSchema = z.strictObject({
  jobId: JobIdSchema,
  kind: JobKindSchema,
  error: AppErrorSchema,
});
export type JobFailedEvent = z.infer<typeof JobFailedEventSchema>;

export const JobCancelledEventSchema = z.strictObject({
  jobId: JobIdSchema,
  kind: JobKindSchema,
});
export type JobCancelledEvent = z.infer<typeof JobCancelledEventSchema>;
