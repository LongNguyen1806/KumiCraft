// The agent a turn runs with, once its command and login are known (R-AG-11).
import type { AgentStatus } from '@kumicraft/shared';

import type { AgentAdapter, AgentCommand } from './agent-types.ts';

export type ResolvedAgent = {
  readonly adapter: AgentAdapter;
  readonly command: AgentCommand;
  readonly status: AgentStatus;
};
