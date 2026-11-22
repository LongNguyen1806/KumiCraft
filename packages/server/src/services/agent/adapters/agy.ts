// agy adapter: builds args and parses stream-json output (WP-3.03a, S-111, S-112).
import {
  type AgentEvent,
  AgentEventSchema,
  type AgentLoginState,
  type AgentModelOption,
} from '@kumicraft/shared';
import { z } from 'zod';

import type { ProcessOutput } from '../../../ports/process-port.ts';
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
    usage: z.looseObject({ total_tokens: z.number().optional() }).optional(),
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

export function parseAgyModels(output: ProcessOutput): readonly AgentModelOption[] {
  return output.stdout.split(/\r?\n/).flatMap((line) => {
    const [id = '', label = ''] = line.split('\t').map((part) => part.trim());
    return /^[A-Za-z0-9][\w.:/-]{0,79}$/.test(id) && label !== '' ? [{ id, label }] : [];
  });
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
  // Antigravity CLI reports the turn's tokens only: no plan limits (K9.5).
  const tokens = resultRes.success ? resultRes.data.result.usage?.total_tokens : undefined;
  if (tokens !== undefined) {
    return { kind: 'usage', usage: { tokens: Math.max(0, Math.round(tokens)) } };
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
      ...(turn.allowEdits !== false ? [] : ['--mode', 'plan']),
      ...turn.mirrorDirs.flatMap((d) => ['--add-dir', d]),
      ...(turn.conversationId !== undefined ? ['--conversation', turn.conversationId] : []),
      ...(turn.model !== undefined ? ['--model', turn.model] : []),
      ...(turn.effort !== undefined ? ['--effort', turn.effort] : []),
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
  // `agy models` prints `id<TAB>Name` per line after a "Fetching…" line.
  models: { args: ['models'], parse: parseAgyModels },
  loginProbe: {
    args: ['models'],
    classify(output: ProcessOutput): AgentLoginState {
      if (output.exitCode === 0) return 'loggedIn';
      if (/sign in/i.test(output.stdout) || /sign in/i.test(output.stderr)) {
        return 'loggedOut';
      }
      return 'unknown';
    },
  },
};
