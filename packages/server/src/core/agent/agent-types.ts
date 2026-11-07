// Agent types and adapter interface (WP-3.03a, SPEC-06 section 5, S-111, S-112).
import type {
  AgentEffort,
  AgentEvent,
  AgentId,
  AgentLoginState,
  AgentModelOption,
} from '@kumicraft/shared';

import type { ProcessOutput } from '../ports/process-port.ts';

/** How to start an agent: the real CLI name, or (tests only) `node fake-agent.mjs` (R-QA-12). */
export type AgentCommand = { readonly command: string; readonly prefixArgs: readonly string[] };

export type AgentTurnArgs = {
  readonly prompt: string;
  readonly mirrorDirs: readonly string[];
  readonly allowEdits?: boolean | undefined;
  readonly conversationId?: string | undefined;
  /** The user's pick for this agent (K9.5); absent: the CLI's default. Checked by the schema. */
  readonly model?: string | undefined;
  readonly effort?: AgentEffort | undefined;
};

export interface AgentAdapter {
  readonly id: AgentId;
  /** Default command when no test command is configured. */
  readonly defaultCommand: AgentCommand;
  /** S-111, S-112: fixed args, never a flag that widens the agent's permissions. */
  buildArgs(turn: AgentTurnArgs): readonly string[];
  /** One stdout line → a standard event; anything not understood → undefined. Never throws. */
  parseLine(line: string): AgentEvent | undefined;
  /**
   * The models the user can pick in the chat (K9.5): a fixed list, or a command whose output
   * lists them. Absent: the agent's default only.
   */
  readonly models?:
    | readonly AgentModelOption[]
    | {
        readonly args: readonly string[];
        parse(output: ProcessOutput): readonly AgentModelOption[];
      }
    | undefined;
  /** Fast query for login status without spending an AI turn (VG-17). Absent means login = 'unknown'. */
  readonly loginProbe?:
    | {
        readonly args: readonly string[];
        classify(output: ProcessOutput): AgentLoginState;
      }
    | undefined;
}
