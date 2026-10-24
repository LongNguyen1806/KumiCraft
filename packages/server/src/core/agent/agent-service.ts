// Agent detection and resolution service (WP-3.03a, WP-3.06b, R-AG-10, R-AG-21, S-110).
import { AGENT_IDS, type AgentId, type AgentStatus } from '@kumicraft/shared';

import type { ProcessPort } from '../ports/process-port.ts';
import { err, ok, type Result } from '../shared/result.ts';
import type { Settings } from '../shared/user-config.ts';
import { detectSingleAgent } from './agent-detect.ts';
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

export type AgentService = {
  statuses(): Promise<readonly AgentStatus[]>;
  resolve(): Promise<
    Result<{
      readonly adapter: AgentAdapter;
      readonly command: AgentCommand;
      readonly status: AgentStatus;
    }>
  >;
  commandOf(id: AgentId): Promise<AgentCommand | undefined>;
};

function resolveAdapter(deps: AgentServiceDeps, id: AgentId): AgentAdapter {
  return deps.adapters[id];
}

function resolveCommand(deps: AgentServiceDeps, id: AgentId): AgentCommand {
  return deps.commands?.[id] ?? resolveAdapter(deps, id).defaultCommand;
}

function resolvePreferred(
  deps: AgentServiceDeps,
  statusMap: Map<AgentId, AgentStatus>,
  commandsMap: Map<AgentId, AgentCommand>,
  target: 'agy' | 'claude',
) {
  const status = statusMap.get(target);
  if (status === undefined || !status.installed) {
    return err({
      code: 'E026' as const,
      params: { agent: target, reason: 'notInstalled' },
    });
  }
  if (status.login === 'loggedOut') {
    return err({
      code: 'E026' as const,
      params: { agent: target, reason: 'notLoggedIn' },
    });
  }
  const cmd = commandsMap.get(target) ?? resolveCommand(deps, target);
  return ok({
    adapter: resolveAdapter(deps, target),
    command: cmd,
    status,
  });
}

function resolveAuto(
  deps: AgentServiceDeps,
  statusMap: Map<AgentId, AgentStatus>,
  commandsMap: Map<AgentId, AgentCommand>,
) {
  const agy = statusMap.get('agy');
  const claude = statusMap.get('claude');

  const installedList: AgentStatus[] = [];
  if (agy?.installed) installedList.push(agy);
  if (claude?.installed) installedList.push(claude);

  if (installedList.length === 0) {
    return err({
      code: 'E026' as const,
      params: { agent: 'agy', reason: 'notInstalled' },
    });
  }

  const available = installedList.find((s) => s.login !== 'loggedOut');
  if (available !== undefined) {
    const cmd = commandsMap.get(available.id) ?? resolveCommand(deps, available.id);
    return ok({
      adapter: resolveAdapter(deps, available.id),
      command: cmd,
      status: available,
    });
  }

  const first = installedList[0];
  const firstId = first !== undefined ? first.id : 'agy';
  return err({
    code: 'E026' as const,
    params: { agent: firstId, reason: 'notLoggedIn' },
  });
}

export function createAgentService(deps: AgentServiceDeps): AgentService {
  let activeCommands = new Map<AgentId, AgentCommand>();
  let hasDetected = false;

  const statuses = async (): Promise<readonly AgentStatus[]> => {
    const results = await Promise.all(AGENT_IDS.map((id) => detectSingleAgent(deps, id)));
    const newCommands = new Map<AgentId, AgentCommand>();
    const list = results.map((r) => {
      if (r.command !== undefined) {
        newCommands.set(r.status.id, r.command);
      }
      return r.status;
    });
    activeCommands = newCommands;
    hasDetected = true;
    return list;
  };

  const commandOf = async (id: AgentId): Promise<AgentCommand | undefined> => {
    if (!hasDetected || activeCommands.get(id) === undefined) {
      await statuses();
    }
    return activeCommands.get(id);
  };

  const resolve = async () => {
    const list = await statuses();
    const map = new Map(list.map((s) => [s.id, s]));
    const preferred = deps.settings().agent.preferred;
    if (preferred === 'agy' || preferred === 'claude') {
      return resolvePreferred(deps, map, activeCommands, preferred);
    }
    return resolveAuto(deps, map, activeCommands);
  };

  return { statuses, resolve, commandOf };
}
