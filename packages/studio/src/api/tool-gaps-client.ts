// Tool gaps reported by external AI agents over MCP (R-AG-20).
import { type ToolGap, ToolGapSchema } from '@kumicraft/shared';

import { arraySchema } from './agent-client.ts';
import { apiGet, parseResponse } from './http.ts';

const ToolGapsSchema = arraySchema(ToolGapSchema);

export async function fetchToolGaps(): Promise<readonly ToolGap[]> {
  return parseResponse(ToolGapsSchema, await apiGet('tool-gaps'));
}
