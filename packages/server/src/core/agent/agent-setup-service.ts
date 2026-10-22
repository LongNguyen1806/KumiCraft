// Agent installation and login management service (WP-3.06b, R-AG-10, R-AG-21).
import type { AgentId } from '@reactcraft/shared';

import type { JobContext, JobService } from '../jobs/job-service.ts';
import type { ProcessPort } from '../ports/process-port.ts';
import { checkInstallCommand } from '../project/project-install.ts';
import { err, ok, type Result } from '../shared/result.ts';
import type { AgentService } from './agent-service.ts';

export type AgentSetupDeps = {
  readonly process: ProcessPort;
  readonly jobs: JobService;
  readonly agents: AgentService;
  readonly homeDir: string;
  readonly plans: Partial<
    Record<AgentId, { readonly installCommand: readonly string[]; readonly docsUrl: string }>
  >;
  /** Terminal launch argv for agent command; undefined when platform cannot launch terminal. */
  readonly terminal: (agentCommand: string) => readonly string[] | undefined;
  readonly loginWaitMs?: number | undefined;
};

export type AgentSetupService = {
  startInstall(id: AgentId, command: readonly string[]): Result<{ readonly jobId: string }>;
  openLogin(id: AgentId): Promise<Result<void>>;
};

async function executeInstallProcess(
  deps: AgentSetupDeps,
  exe: string,
  args: readonly string[],
  ctx: JobContext,
): Promise<Result<void>> {
  const handle = deps.process.spawn(exe, args, {
    cwd: deps.homeDir,
    timeoutMs: 600_000,
  });
  handle.onLine((line) => {
    ctx.reportLine(line);
  });
  const onAbort = () => {
    void handle.kill();
  };
  ctx.signal.addEventListener('abort', onAbort, { once: true });
  try {
    const outcome = await handle.wait();
    if (outcome.exitCode === 124) {
      return err({ code: 'E020', params: { timeout: 600 } });
    }
    if (outcome.exitCode === 127) {
      return err({ code: 'E021', params: { missing: 'installer' } });
    }
    if (outcome.exitCode !== 0) {
      const details = outcome.lines.slice(-200).map((message) => ({ message }));
      return err({ code: 'E028', details });
    }
    await deps.agents.statuses();
    return ok(undefined);
  } finally {
    ctx.signal.removeEventListener('abort', onAbort);
  }
}

async function waitForTerminalWindow(
  process: ProcessPort,
  homeDir: string,
  termArgv: readonly string[],
  loginWaitMs = 3000,
): Promise<Result<void>> {
  const [termExe, ...termArgs] = termArgv;
  if (termExe === undefined) {
    return err({ code: 'E021', params: { missing: 'terminal' } });
  }

  const handle = process.spawn(termExe, termArgs, { cwd: homeDir });
  let timer: NodeJS.Timeout | undefined;
  const timeoutPromise = new Promise<{ readonly timedOut: true }>((resolve) => {
    timer = setTimeout(() => {
      resolve({ timedOut: true });
    }, loginWaitMs);
  });

  try {
    const result = await Promise.race([handle.wait(), timeoutPromise]);
    if ('timedOut' in result) {
      return ok(undefined);
    }
    if (result.exitCode === 127) {
      return err({ code: 'E021', params: { missing: 'terminal' } });
    }
    if (result.exitCode !== 0) {
      const details = result.lines.slice(-200).map((message) => ({ message }));
      return err({ code: 'E028', details });
    }
    return ok(undefined);
  } finally {
    if (timer !== undefined) {
      clearTimeout(timer);
    }
  }
}

export function createAgentSetupService(deps: AgentSetupDeps): AgentSetupService {
  const startInstall = (
    id: AgentId,
    command: readonly string[],
  ): Result<{ readonly jobId: string }> => {
    const plan = deps.plans[id];
    const checked = checkInstallCommand(command, plan?.installCommand);
    if (!checked.ok) {
      return checked;
    }
    const { exe, args } = checked.value;
    return deps.jobs.start('agent.install', 'jobs:agentInstall.running', (ctx) =>
      executeInstallProcess(deps, exe, args, ctx),
    );
  };

  const openLogin = async (id: AgentId): Promise<Result<void>> => {
    const command = await deps.agents.commandOf(id);
    if (command === undefined) {
      return err({ code: 'E021', params: { missing: 'agent' } });
    }
    if (command.prefixArgs.length > 0) {
      return err({ code: 'E021', params: { missing: 'terminal' } });
    }
    const termArgv = deps.terminal(command.command);
    if (termArgv === undefined || termArgv.length === 0) {
      return err({ code: 'E021', params: { missing: 'terminal' } });
    }
    return waitForTerminalWindow(deps.process, deps.homeDir, termArgv, deps.loginWaitMs);
  };

  return { startInstall, openLogin };
}
