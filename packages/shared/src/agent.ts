// Shared agent schemas and types for Phase 3 (R-AG-*, R-MR-*, S-118 to S-125).
import { z } from 'zod';

import { RelPathSchema } from './rel-path.ts';

export const AGENT_IDS = ['agy', 'claude'] as const;
export const AgentIdSchema = z.enum(AGENT_IDS);
export type AgentId = z.infer<typeof AgentIdSchema>;

export const AGENT_LOGIN_STATES = ['unknown', 'loggedIn', 'loggedOut'] as const;
export const AgentLoginStateSchema = z.enum(AGENT_LOGIN_STATES);
export type AgentLoginState = z.infer<typeof AgentLoginStateSchema>;

export const AgentStatusSchema = z.strictObject({
  id: AgentIdSchema,
  installed: z.boolean(),
  version: z.string().max(100).optional(),
  login: z.enum(AGENT_LOGIN_STATES),
  installCommand: z.array(z.string().min(1).max(2000)).min(1).max(10).optional(),
  docsUrl: z.url().max(500).optional(),
  loginAvailable: z.boolean(),
});
export type AgentStatus = z.infer<typeof AgentStatusSchema>;

export const AgentInstallRequestSchema = z.strictObject({
  command: z.array(z.string().min(1).max(2000)).min(1).max(10),
});
export type AgentInstallRequest = z.infer<typeof AgentInstallRequestSchema>;

export const AgentEventSchema = z.discriminatedUnion('kind', [
  z.strictObject({ kind: z.literal('message'), text: z.string().max(100_000) }),
  z.strictObject({
    kind: z.literal('tool'),
    name: z.string().min(1).max(200),
    target: z.string().max(1024).optional(),
  }),
  z.strictObject({ kind: z.literal('conversation'), id: z.string().min(1).max(200) }),
  z.strictObject({ kind: z.literal('error'), message: z.string().max(4000) }),
]);
export type AgentEvent = z.infer<typeof AgentEventSchema>;

export const TURN_STATES = ['running', 'completed', 'failed', 'cancelled'] as const;
export const TurnStateSchema = z.enum(TURN_STATES);
export type TurnState = z.infer<typeof TurnStateSchema>;

export const TURN_FILE_CHANGES = ['modified', 'created', 'deleted'] as const;
export const TurnFileChangeSchema = z.enum(TURN_FILE_CHANGES);
export type TurnFileChange = z.infer<typeof TurnFileChangeSchema>;

export const TurnFileSchema = z.strictObject({
  path: RelPathSchema,
  change: z.enum(TURN_FILE_CHANGES),
});
export type TurnFile = z.infer<typeof TurnFileSchema>;

/** Chat notice about a backend mirror (R-MR-03, S-118, S-124). */
export const TURN_NOTICE_CODES = ['backendSkipped', 'backendTooLarge', 'mirrorModified'] as const;
export const TurnNoticeCodeSchema = z.enum(TURN_NOTICE_CODES);
export type TurnNoticeCode = z.infer<typeof TurnNoticeCodeSchema>;

export const TurnNoticeSchema = z.strictObject({
  code: z.enum(TURN_NOTICE_CODES),
  backendId: z.string().regex(/^[A-Za-z0-9_-]{10}$/),
  label: z.string().min(1).max(64),
});
export type TurnNotice = z.infer<typeof TurnNoticeSchema>;

export const TurnSummarySchema = z.strictObject({
  id: z.string().regex(/^[A-Za-z0-9_-]{10}$/),
  agent: AgentIdSchema,
  startedAt: z.iso.datetime(),
  finishedAt: z.iso.datetime().optional(),
  prompt: z.string().min(1).max(20_000),
  state: z.enum(TURN_STATES),
  files: z.array(TurnFileSchema).max(5000),
  revertible: z.boolean(),
  notices: z.array(TurnNoticeSchema).max(20),
});
export type TurnSummary = z.infer<typeof TurnSummarySchema>;

/** Context of a turn (SRS FR-62, R-AG-13). */
export const TurnContextSchema = z.strictObject({
  element: z
    .strictObject({ loc: z.string().min(1).max(1100), tag: z.string().min(1).max(100) })
    .optional(),
  route: z.string().max(2048).optional(),
  frame: z
    .strictObject({ id: z.string().min(1).max(64), width: z.number().int().min(1).max(10_000) })
    .optional(),
});
export type TurnContext = z.infer<typeof TurnContextSchema>;

export const CHAT_IMAGE_KINDS = ['png', 'jpg', 'webp', 'gif'] as const;
export const ChatImageKindSchema = z.enum(CHAT_IMAGE_KINDS);
export type ChatImageKind = z.infer<typeof ChatImageKindSchema>;

export const ChatImageUploadSchema = z.strictObject({
  kind: ChatImageKindSchema,
  dataBase64: z.string().min(1).max(7_000_000), // about 5 MB once decoded
});
export type ChatImageUpload = z.infer<typeof ChatImageUploadSchema>;

export const ChatImageSchema = z.strictObject({ id: z.string().regex(/^[A-Za-z0-9_-]{10}$/) });
export type ChatImage = z.infer<typeof ChatImageSchema>;

export const StartTurnRequestSchema = z.strictObject({
  prompt: z.string().trim().min(1).max(20_000),
  context: TurnContextSchema,
  conversation: z.enum(['new', 'continue']),
  docs: z.array(RelPathSchema).max(10),
  images: z
    .array(z.string().regex(/^[A-Za-z0-9_-]{10}$/))
    .max(5)
    .optional(),
});
export type StartTurnRequest = z.infer<typeof StartTurnRequestSchema>;

export const TurnDiffSchema = z.strictObject({ diff: z.string() });
export type TurnDiff = z.infer<typeof TurnDiffSchema>;

export const ToolGapSchema = z.strictObject({
  need: z.string().min(1).max(200),
  why: z.string().max(2000),
  example: z.string().max(4000),
  count: z.number().int().min(1),
  lastAt: z.iso.datetime(),
});
export type ToolGap = z.infer<typeof ToolGapSchema>;

/** What an external agent sends when no tool does what it needs (R-AG-20). */
export const ToolGapReportSchema = z.strictObject({
  need: z.string().trim().min(1).max(200),
  why: z.string().max(2000),
  example: z.string().max(4000),
});
export type ToolGapReport = z.infer<typeof ToolGapReportSchema>;

export const AgentEventMessageSchema = z.strictObject({
  turnId: z.string().regex(/^[A-Za-z0-9_-]{10}$/),
  event: AgentEventSchema,
});
export type AgentEventMessage = z.infer<typeof AgentEventMessageSchema>;
