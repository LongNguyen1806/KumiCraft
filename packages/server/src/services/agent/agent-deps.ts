// What the agent service needs from the server (R-AG-10).
import type { AgentId } from '@kumicraft/shared';

import type { ProcessPort } from '../../ports/process-port.ts';
import type { Settings } from '../config/user-config.ts';
import type { AgentAdapter, AgentCommand } from './agent-types.ts';

export type AgentServiceDeps = {
  readonly process: ProcessPort;
  readonly settings: () => Settings;
  readonly commands?: Partial<Record<AgentId, AgentCommand>> | undefined;
  readonly fallbackCommands?: Partial<Record<AgentId, AgentCommand>> | undefined;
  readonly detectTimeoutMs?: number | undefined;
  /** Injected by the composition root: core must not import adapters (SPEC-01 section 3.2). */
  readonly adapters: Readonly<Record<AgentId, AgentAdapter>>;
  readonly plans?:
    | Partial<
        Record<AgentId, { readonly installCommand: readonly string[]; readonly docsUrl: string }>
      >
    | undefined;
  readonly terminalAvailable?: boolean | undefined;
};
