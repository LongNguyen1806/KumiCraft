// agy adapter: builds args and parses stream-json output (WP-3.03a, S-111, S-112).
import { type AgentEvent, AgentEventSchema } from '@reactcraft/shared';
import { z } from 'zod';

import type { AgentAdapter, AgentCommand, AgentTurnArgs } from '../agent-types.ts';

const AGY_DEFAULT_COMMAND: AgentCommand = {
  command: 'agy',
  prefixArgs: [],
};

const AgyInitSchema = z.looseObject({
  event: z.literal('init'),
  conversation_id: z.string().min(1),
});

const AgyStepUpdateAgentResponseSchema = z.looseObject({
  event: z.literal('step_update'),
  step_update: z.looseObject({
    step_type: z.literal('agent_response'),
    text_delta: z.string().min(1),
  }),
});

const AgyStepUpdateToolSchema = z.looseObject({
  event: z.literal('step_update'),
  step_update: z.looseObject({
    step_type: z.literal('tool'),
    state: z.string(),
    tool_name: z.string().min(1),
    tool_info: z
      .looseObject({
        parameters: z.record(z.string(), z.unknown()).optional(),
      })
      .optional(),
  }),
});

const AgyResultSchema = z.looseObject({
  event: z.literal('result'),
  result: z.looseObject({
    status: z.string(),
  }),
});

function resolveToolTarget(parameters?: Record<string, unknown>): string | undefined {
  if (parameters === undefined) return undefined;
  const candidate =
    parameters['Path'] ??
    parameters['TargetFile'] ??
    parameters['AbsolutePath'] ??
    parameters['CommandLine'];
  if (typeof candidate === 'string' && candidate.length > 0) {
    return candidate.slice(0, 1024);
  }
  return undefined;
}

function parseAgyJson(data: unknown): AgentEvent | undefined {
  const initRes = AgyInitSchema.safeParse(data);
  if (initRes.success) {
    return { kind: 'conversation', id: initRes.data.conversation_id };
  }
  const respRes = AgyStepUpdateAgentResponseSchema.safeParse(data);
  if (respRes.success) {
    return { kind: 'message', text: respRes.data.step_update.text_delta };
  }
  const toolRes = AgyStepUpdateToolSchema.safeParse(data);
  if (toolRes.success) {
    if (toolRes.data.step_update.state === 'ACTIVE') {
      const target = resolveToolTarget(toolRes.data.step_update.tool_info?.parameters);
      return {
        kind: 'tool',
        name: toolRes.data.step_update.tool_name.slice(0, 200),
        ...(target !== undefined ? { target } : {}),
      };
    }
    return undefined;
  }
  const resultRes = AgyResultSchema.safeParse(data);
  if (resultRes.success && resultRes.data.result.status !== 'SUCCESS') {
    return { kind: 'error', message: `agy: ${resultRes.data.result.status}`.slice(0, 4000) };
  }
  return undefined;
}

export const agyAdapter: AgentAdapter = {
  id: 'agy',
  defaultCommand: AGY_DEFAULT_COMMAND,
  buildArgs(turn: AgentTurnArgs): readonly string[] {
    return [
      '-p',
      turn.prompt,
      '--output-format',
      'stream-json',
      ...turn.mirrorDirs.flatMap((d) => ['--add-dir', d]),
      ...(turn.conversationId !== undefined ? ['--conversation', turn.conversationId] : []),
    ];
  },
  parseLine(line: string): AgentEvent | undefined {
    if (line.trim() === '') return undefined;
    try {
      const raw: unknown = JSON.parse(line);
      const candidate = parseAgyJson(raw);
      if (candidate === undefined) return undefined;
      const validated = AgentEventSchema.safeParse(candidate);
      return validated.success ? validated.data : undefined;
    } catch {
      return undefined;
    }
  },
};
