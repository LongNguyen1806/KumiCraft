// Agent detection and resolution service (WP-3.03a, R-AG-10, S-110).
import { tmpdir } from 'node:os';

import type { AgentId, AgentStatus } from '@reactcraft/shared';

import type { ProcessPort } from '../ports/process-port.ts';
import { err, ok, type Result } from '../shared/result.ts';
import type { Settings } from '../shared/user-config.ts';
import type { AgentAdapter, AgentCommand } from './agent-types.ts';

export type AgentServiceDeps = {
  readonly process: ProcessPort;
  readonly settings: () => Settings;
  readonly commands?: Partial<Record<AgentId, AgentCommand>> | undefined;
  readonly detectTimeoutMs?: number | undefined;
  /** Injected by the composition root: core must not import adapters (SPEC-01 section 3.2). */
  readonly adapters: Readonly<Record<AgentId, AgentAdapter>>;
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
};

function resolveAdapter(deps: AgentServiceDeps, id: AgentId): AgentAdapter {
  return deps.adapters[id];
}

function resolveCommand(deps: AgentServiceDeps, id: AgentId): AgentCommand {
  return deps.commands?.[id] ?? resolveAdapter(deps, id).defaultCommand;
}

async function detectAgent(
  deps: AgentServiceDeps,
  agentId: AgentId,
  command: AgentCommand,
): Promise<AgentStatus> {
  const timeoutMs = deps.detectTimeoutMs ?? 5000;
  try {
    const handle = deps.process.spawn(command.command, [...command.prefixArgs, '--version'], {
      cwd: tmpdir(),
      timeoutMs,
    });
    const result = await handle.wait();
    if (result.exitCode === 0) {
      const firstLine = (result.stdout.split(/\r?\n/)[0] ?? '').trim();
      if (/^v?\d+\.\d+/.test(firstLine)) {
        return {
          id: agentId,
          installed: true,
          version: firstLine.slice(0, 100),
          login: 'unknown',
        };
      }
    }
  } catch {
    // Process spawn failure or timeout -> treat as not installed
  }
  return {
    id: agentId,
    installed: false,
    login: 'unknown',
  };
}

function resolvePreferred(
  deps: AgentServiceDeps,
  statusMap: Map<AgentId, AgentStatus>,
  target: 'agy' | 'claude',
) {
  const status = statusMap.get(target);
  if (status !== undefined && status.installed) {
    return ok({
      adapter: resolveAdapter(deps, target),
      command: resolveCommand(deps, target),
      status,
    });
  }
  return err({
    code: 'E026' as const,
    params: { agent: target, reason: 'notInstalled' },
  });
}

function resolveAuto(deps: AgentServiceDeps, statusMap: Map<AgentId, AgentStatus>) {
  const agy = statusMap.get('agy');
  if (agy !== undefined && agy.installed) {
    return ok({
      adapter: resolveAdapter(deps, 'agy'),
      command: resolveCommand(deps, 'agy'),
      status: agy,
    });
  }
  const claude = statusMap.get('claude');
  if (claude !== undefined && claude.installed) {
    return ok({
      adapter: resolveAdapter(deps, 'claude'),
      command: resolveCommand(deps, 'claude'),
      status: claude,
    });
  }
  return err({
    code: 'E026' as const,
    params: { agent: 'agy', reason: 'notInstalled' },
  });
}

export function createAgentService(deps: AgentServiceDeps): AgentService {
  const statuses = async (): Promise<readonly AgentStatus[]> => {
    const [agyStatus, claudeStatus] = await Promise.all([
      detectAgent(deps, 'agy', resolveCommand(deps, 'agy')),
      detectAgent(deps, 'claude', resolveCommand(deps, 'claude')),
    ]);
    return [agyStatus, claudeStatus];
  };

  const resolve = async () => {
    const list = await statuses();
    const map = new Map(list.map((s) => [s.id, s]));
    const preferred = deps.settings().agent.preferred;
    if (preferred === 'agy' || preferred === 'claude') {
      return resolvePreferred(deps, map, preferred);
    }
    return resolveAuto(deps, map);
  };

  return { statuses, resolve };
}
