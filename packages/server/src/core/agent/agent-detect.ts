// Agent CLI version and login detection (WP-3.06b, R-AG-10, R-AG-21).
import { tmpdir } from 'node:os';

import type { AgentId, AgentLoginState, AgentStatus } from '@reactcraft/shared';

import type { ProcessPort } from '../ports/process-port.ts';
import type { AgentServiceDeps } from './agent-service.ts';
import type { AgentAdapter, AgentCommand } from './agent-types.ts';

export type DetectResult = {
  readonly status: AgentStatus;
  readonly command?: AgentCommand | undefined;
};

async function probeVersion(
  process: ProcessPort,
  command: AgentCommand,
  timeoutMs: number,
): Promise<string | undefined> {
  try {
    const handle = process.spawn(command.command, [...command.prefixArgs, '--version'], {
      cwd: tmpdir(),
      timeoutMs,
    });
    const result = await handle.wait();
    if (result.exitCode === 0) {
      const firstLine = (result.stdout.split(/\r?\n/)[0] ?? '').trim();
      if (/^v?\d+\.\d+/.test(firstLine)) {
        return firstLine.slice(0, 100);
      }
    }
  } catch {
    // Process spawn failure or timeout
  }
  return undefined;
}

async function probeLogin(
  process: ProcessPort,
  command: AgentCommand,
  adapter: AgentAdapter,
): Promise<AgentLoginState> {
  if (adapter.loginProbe === undefined) {
    return 'unknown';
  }
  try {
    const handle = process.spawn(
      command.command,
      [...command.prefixArgs, ...adapter.loginProbe.args],
      {
        cwd: tmpdir(),
        timeoutMs: 10_000,
      },
    );
    const output = await handle.wait();
    return adapter.loginProbe.classify(output);
  } catch {
    return 'unknown';
  }
}

export async function detectSingleAgent(
  deps: AgentServiceDeps,
  agentId: AgentId,
): Promise<DetectResult> {
  const timeoutMs = deps.detectTimeoutMs ?? 5000;
  const adapter = deps.adapters[agentId];
  const primaryCommand = deps.commands?.[agentId] ?? adapter.defaultCommand;

  let version = await probeVersion(deps.process, primaryCommand, timeoutMs);
  let winningCommand: AgentCommand | undefined = version !== undefined ? primaryCommand : undefined;

  if (version === undefined && deps.commands?.[agentId] === undefined) {
    const fallback = deps.fallbackCommands?.[agentId];
    if (fallback !== undefined) {
      version = await probeVersion(deps.process, fallback, timeoutMs);
      if (version !== undefined) {
        winningCommand = fallback;
      }
    }
  }

  const plan = deps.plans?.[agentId];

  if (version === undefined || winningCommand === undefined) {
    return {
      status: {
        id: agentId,
        installed: false,
        login: 'unknown',
        ...(plan !== undefined
          ? { installCommand: [...plan.installCommand], docsUrl: plan.docsUrl }
          : {}),
        loginAvailable: false,
      },
    };
  }

  const login = await probeLogin(deps.process, winningCommand, adapter);
  return {
    status: {
      id: agentId,
      installed: true,
      version,
      login,
      ...(plan !== undefined
        ? { installCommand: [...plan.installCommand], docsUrl: plan.docsUrl }
        : {}),
      loginAvailable: Boolean(deps.terminalAvailable),
    },
    command: winningCommand,
  };
}
