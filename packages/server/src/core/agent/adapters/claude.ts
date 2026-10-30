// claude adapter: builds args and parses stream-json output (WP-3.03a, S-111, S-112).
import { type AgentEvent, AgentEventSchema, type AgentLoginState } from '@kumicraft/shared';
import { z } from 'zod';

import type { ProcessOutput } from '../../ports/process-port.ts';
import type { AgentAdapter, AgentCommand, AgentTurnArgs } from '../agent-types.ts';

const CLAUDE_DEFAULT_COMMAND: AgentCommand = {
  command: 'claude',
  prefixArgs: [],
};

const ClaudeInitSchema = z.looseObject({
  type: z.literal('system'),
  subtype: z.literal('init'),
  session_id: z.string().min(1),
});

const ClaudeContentItemSchema = z.discriminatedUnion('type', [
  z.looseObject({
    type: z.literal('text'),
    text: z.string().min(1),
  }),
  z.looseObject({
    type: z.literal('tool_use'),
    name: z.string().min(1),
    input: z.record(z.string(), z.unknown()).optional(),
  }),
]);

const ClaudeAssistantSchema = z.looseObject({
  type: z.literal('assistant'),
  message: z.looseObject({
    content: z.array(z.unknown()),
  }),
});

const ClaudeResultErrorSchema = z.looseObject({
  type: z.literal('result'),
  is_error: z.literal(true),
  result: z.string().optional(),
  subtype: z.string().optional(),
});

const ClaudeAuthStatusSchema = z.looseObject({ loggedIn: z.boolean() });

/** `claude auth status` prints JSON with `loggedIn` (Claude Code 2.1+, VG-17); older builds: unknown. */
function classifyAuthStatus(output: ProcessOutput): AgentLoginState {
  try {
    const parsed = ClaudeAuthStatusSchema.safeParse(JSON.parse(output.stdout));
    if (!parsed.success) return 'unknown';
    return parsed.data.loggedIn ? 'loggedIn' : 'loggedOut';
  } catch {
    return 'unknown';
  }
}

function parseAssistantMessage(content: readonly unknown[]): AgentEvent | undefined {
  for (const item of content) {
    const parsed = ClaudeContentItemSchema.safeParse(item);
    if (parsed.success) {
      if (parsed.data.type === 'text') {
        return { kind: 'message', text: parsed.data.text };
      }
      const input = parsed.data.input;
      const targetCandidate =
        input !== undefined ? (input['file_path'] ?? input['path'] ?? input['command']) : undefined;
      const target =
        typeof targetCandidate === 'string' && targetCandidate.length > 0
          ? targetCandidate.slice(0, 1024)
          : undefined;
      return {
        kind: 'tool',
        name: parsed.data.name.slice(0, 200),
        ...(target !== undefined ? { target } : {}),
      };
    }
  }
  return undefined;
}

function parseClaudeJson(data: unknown): AgentEvent | undefined {
  const initRes = ClaudeInitSchema.safeParse(data);
  if (initRes.success) {
    return { kind: 'conversation', id: initRes.data.session_id };
  }
  const assistantRes = ClaudeAssistantSchema.safeParse(data);
  if (assistantRes.success) {
    return parseAssistantMessage(assistantRes.data.message.content);
  }
  const errorRes = ClaudeResultErrorSchema.safeParse(data);
  if (errorRes.success) {
    const detail = errorRes.data.result ?? errorRes.data.subtype ?? 'unknown';
    return { kind: 'error', message: `claude: ${detail}`.slice(0, 4000) };
  }
  return undefined;
}

export const claudeAdapter: AgentAdapter = {
  id: 'claude',
  defaultCommand: CLAUDE_DEFAULT_COMMAND,
  buildArgs(turn: AgentTurnArgs): readonly string[] {
    return [
      '-p',
      turn.prompt,
      '--output-format',
      'stream-json',
      '--verbose',
      ...turn.mirrorDirs.flatMap((d) => ['--add-dir', d]),
      ...(turn.conversationId !== undefined ? ['--resume', turn.conversationId] : []),
    ];
  },
  loginProbe: { args: ['auth', 'status'], classify: classifyAuthStatus },
  parseLine(line: string): AgentEvent | undefined {
    if (line.trim() === '') return undefined;
    try {
      const raw: unknown = JSON.parse(line);
      const candidate = parseClaudeJson(raw);
      if (candidate === undefined) return undefined;
      const validated = AgentEventSchema.safeParse(candidate);
      return validated.success ? validated.data : undefined;
    } catch {
      return undefined;
    }
  },
};
