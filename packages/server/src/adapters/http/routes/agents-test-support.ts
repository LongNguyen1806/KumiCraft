// Test support and doubles for agent routes (WP-3.03a, WP-3.06b, R-AG-10, R-AG-21).
import type { AgentId, AgentStatus } from '@kumicraft/shared';
import type { FastifyInstance } from 'fastify';

import { createSessionInfoProvider } from '../../../kernel/session.ts';
import { createEventBus, type EventBusPort } from '../../../ports/event-bus-port.ts';
import type {
  ChildProcessHandle,
  ProcessOutput,
  ProcessPort,
} from '../../../ports/process-port.ts';
import type { AgentService } from '../../../services/agent/agent-service.ts';
import {
  type AgentSetupService,
  createAgentSetupService,
} from '../../../services/agent/agent-setup-service.ts';
import type { AgentCommand } from '../../../services/agent/agent-types.ts';
import { createJobService, type JobService } from '../../../services/jobs/job-service.ts';
import { platform, silentLogger } from '../../../services/workspace/test-support.ts';
import { createHttpApp } from '../create-http-app.ts';

export const PORT = 50240;
export const TOKEN = 'test-token-agents';
export const HEADERS = {
  authorization: `Bearer ${TOKEN}`,
  host: `127.0.0.1:${String(PORT)}`,
  'content-type': 'application/json',
};

export const AGY_INSTALL_CMD = [
  'powershell',
  '-Command',
  'irm https://app.agy.ai/install.ps1 | iex',
];

export const DEFAULT_PLANS = {
  agy: {
    installCommand: AGY_INSTALL_CMD,
    docsUrl: 'https://docs.agy.ai',
  },
};

export type SpawnRecord = { cmd: string; args: readonly string[]; killed: boolean };

export type AppContext = {
  app: FastifyInstance;
  jobs: JobService;
  eventBus: EventBusPort;
  spawned: SpawnRecord[];
  agentService: AgentService;
};

const JOB_END_TYPES: readonly string[] = ['job.completed', 'job.failed', 'job.cancelled'];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && Boolean(value);
}

export function waitForJobEnd(
  jobs: JobService,
  eventBus: EventBusPort,
  jobId: string,
): Promise<void> {
  const current = jobs.get(jobId);
  if (
    current.ok &&
    (current.value.state === 'completed' ||
      current.value.state === 'failed' ||
      current.value.state === 'cancelled')
  ) {
    return Promise.resolve();
  }
  return new Promise((resolve) => {
    const unsub = eventBus.subscribe((ev) => {
      if (
        JOB_END_TYPES.includes(ev.type) &&
        isRecord(ev.payload) &&
        ev.payload['jobId'] === jobId
      ) {
        unsub();
        resolve();
      }
    });
  });
}

export function createMockProcess(
  spawned: SpawnRecord[],
  behavior: {
    exitCode?: number | undefined;
    lines?: readonly string[] | undefined;
    hang?: boolean | undefined;
  },
): ProcessPort {
  return {
    spawn(cmd: string, args: readonly string[]): ChildProcessHandle {
      const record: SpawnRecord = { cmd, args, killed: false };
      spawned.push(record);
      let resolveWait: ((val: ProcessOutput) => void) | undefined;
      const waitPromise = new Promise<ProcessOutput>((resolve) => {
        resolveWait = resolve;
        if (!behavior.hang) {
          resolve({
            exitCode: behavior.exitCode ?? 0,
            stdout: (behavior.lines ?? []).join('\n'),
            stderr: '',
            lines: behavior.lines ?? [],
          });
        }
      });
      return {
        onLine(cb: (line: string) => void): void {
          for (const l of behavior.lines ?? []) cb(l);
        },
        wait: () => waitPromise,
        kill(): Promise<void> {
          record.killed = true;
          resolveWait?.({ exitCode: 1, stdout: '', stderr: '', lines: [] });
          return Promise.resolve();
        },
      };
    },
  };
}

export async function buildTestApp(options: {
  statuses?: () => Promise<AgentStatus[]>;
  commandOf?: (id: AgentId) => Promise<AgentCommand | undefined>;
  terminal?: (cmd: string) => readonly string[] | undefined;
  behavior?: { exitCode?: number; lines?: readonly string[]; hang?: boolean };
  loginWaitMs?: number;
}): Promise<AppContext> {
  const spawned: SpawnRecord[] = [];
  const proc = createMockProcess(spawned, options.behavior ?? {});
  const eventBus = createEventBus();
  const jobs = createJobService({
    system: { now: () => new Date() },
    logger: silentLogger,
    eventBus,
  });

  const agentService: AgentService = {
    statuses: options.statuses ?? (() => Promise.resolve([])),
    resolve: () => Promise.reject(new Error('unused')),
    commandOf: options.commandOf ?? (() => Promise.resolve(undefined)),
    models: () => Promise.resolve([]),
  };

  const setupService: AgentSetupService = createAgentSetupService({
    process: proc,
    jobs,
    agents: agentService,
    homeDir: 'C:\\Users\\Test',
    plans: DEFAULT_PLANS,
    terminal: options.terminal ?? ((cmd) => ['cmd.exe', '/c', 'start', '', cmd]),
    loginWaitMs: options.loginWaitMs ?? 50,
  });

  const app = await createHttpApp({
    logLevel: 'silent',
    security: { port: PORT, sessionToken: TOKEN, trustedOrigins: [] },
    getSessionInfo: createSessionInfoProvider({
      version: '1.0.0',
      platform,
      features: [],
      readProject: () => ({ state: 'none', suggestedPath: '' }),
    }),
    agentRoutes: { agentService, setupService },
    jobRoutes: { jobService: jobs },
  });

  return { app, jobs, eventBus, spawned, agentService };
}
