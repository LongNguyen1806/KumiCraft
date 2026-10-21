// Agent endpoints (WP-3.05a, R-AG-10, R-AG-11, R-AG-15, R-AG-16).
import {
  type AgentStatus,
  AgentStatusSchema,
  JobStartedSchema,
  type StartTurnRequest,
  TurnDiffSchema,
  type TurnSummary,
  TurnSummarySchema,
} from '@reactcraft/shared';

import {
  apiGet,
  apiPost,
  parseResponse,
  type ResponseSchema,
  type SafeParseResult,
} from './http.ts';

function arraySchema<T>(itemSchema: ResponseSchema<T>): ResponseSchema<readonly T[]> {
  return {
    safeParse(data: unknown): SafeParseResult<readonly T[]> {
      if (!Array.isArray(data)) {
        return {
          success: false,
          error: { issues: [{ path: [], message: 'Expected array' }] },
        };
      }
      const result: T[] = [];
      for (let i = 0; i < data.length; i += 1) {
        const itemResult = itemSchema.safeParse(data[i]);
        if (!itemResult.success) {
          return {
            success: false,
            error: {
              issues: itemResult.error.issues.map((issue) => ({
                path: [i, ...issue.path],
                message: issue.message,
              })),
            },
          };
        }
        result.push(itemResult.data);
      }
      return { success: true, data: result };
    },
  };
}

const AgentStatusesSchema = arraySchema(AgentStatusSchema);
const TurnSummariesSchema = arraySchema(TurnSummarySchema);

export async function fetchAgents(): Promise<readonly AgentStatus[]> {
  return parseResponse(AgentStatusesSchema, await apiGet('agents'));
}

export async function startTurn(request: StartTurnRequest): Promise<{ readonly jobId: string }> {
  return parseResponse(JobStartedSchema, await apiPost('agent/turns', request));
}

export async function fetchTurns(): Promise<readonly TurnSummary[]> {
  return parseResponse(TurnSummariesSchema, await apiGet('agent/turns'));
}

export async function fetchTurnDiff(turnId: string, file: string): Promise<string> {
  const qs = `file=${encodeURIComponent(file)}`;
  const url = `agent/turns/${encodeURIComponent(turnId)}/diff?${qs}`;
  const parsed = parseResponse(TurnDiffSchema, await apiGet(url));
  return parsed.diff;
}

export async function revertTurn(turnId: string): Promise<TurnSummary> {
  const url = `agent/turns/${encodeURIComponent(turnId)}/revert`;
  return parseResponse(TurnSummarySchema, await apiPost(url));
}
