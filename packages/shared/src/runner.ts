// Runner types and schemas for dev server lifecycle and IPC (SPEC-03 section 5.4, SPEC-04 M-RN).
import { z } from 'zod';

import { AppErrorSchema } from './result.ts';

export const RUNNER_STATES = ['stopped', 'starting', 'ready', 'error', 'crashed'] as const;
export const RunnerStateSchema = z.enum(RUNNER_STATES);
export type RunnerState = z.infer<typeof RunnerStateSchema>;

export const RUNNER_ERROR_REASONS = [
  'notInstalled',
  'viteNotFound',
  'config',
  'portInUse',
  'timeout',
  'crashed',
  'entryNotFound',
  'noListen',
] as const;
export const RunnerErrorReasonSchema = z.enum(RUNNER_ERROR_REASONS);
export type RunnerErrorReason = z.infer<typeof RunnerErrorReasonSchema>;

export const RunnerStatusSchema = z.strictObject({
  state: RunnerStateSchema,
  origin: z.url().optional(),
  nonce: z.string().optional(),
  error: AppErrorSchema.optional(),
  startedAt: z.string().optional(),
  /** When ready: the project's own port was busy, so the Canvas runs on another (R-RN-04). */
  busyPort: z.number().int().optional(),
});
export type RunnerStatus = z.infer<typeof RunnerStatusSchema>;

export const RunnerOptionsSchema = z.strictObject({
  root: z.string().min(1),
  sourceDir: z.string().min(1),
  /** Used when the project's own port is busy (R-RN-04). */
  port: z.number().int().min(1024).max(65535),
  /** The port the user picked (`devPort`); absent: the runner reads it from the project. */
  projectPort: z.number().int().min(1024).max(65535).optional(),
  nonce: z.string().min(1),
  studioOrigin: z.url(),
  host: z.literal('127.0.0.1'),
  /** Drafts folder the Bridge plugin serves at `/__kumicraft/draft` (R-DR-12). */
  draftsDir: z.string().min(1).optional(),
  /** Global CSS entries loaded by the draft page (R-DR-12, Round S1). */
  globalCss: z.array(z.string().min(1)).optional(),
  serverEntry: z.string().min(1).optional(),
  viewsDir: z.string().min(1).optional(),
});
export type RunnerOptions = z.infer<typeof RunnerOptionsSchema>;

/** IPC messages between server and runner child process (SPEC-04 R-RN-02, R-RN-03). */
export const RunnerToChildMessageSchema = z.discriminatedUnion('type', [
  z.strictObject({
    type: z.literal('start'),
    options: RunnerOptionsSchema,
  }),
  z.strictObject({
    type: z.literal('stop'),
  }),
  /** Files KumiCraft wrote: the dev server reads them again (K9.5, a watcher can miss one). */
  z.strictObject({
    type: z.literal('filesWritten'),
    files: z.array(z.string().min(1).max(4096)).max(500),
  }),
]);
export type RunnerToChildMessage = z.infer<typeof RunnerToChildMessageSchema>;

export const RunnerToParentMessageSchema = z.discriminatedUnion('type', [
  z.strictObject({
    type: z.literal('ready'),
    port: z.number().int(),
    busyPort: z.number().int().optional(),
  }),
  z.strictObject({
    type: z.literal('error'),
    reason: z.enum(['viteNotFound', 'config', 'entryNotFound', 'noListen']),
    message: z.string().optional(),
    file: z.string().optional(),
    line: z.number().int().optional(),
  }),
]);
export type RunnerToParentMessage = z.infer<typeof RunnerToParentMessageSchema>;
