// End-to-end execution of agent turns (WP-3.03b, R-AG-11 to R-AG-17, S-32, S-110 to S-118).
import type {
  AgentStatus,
  BackendInfo,
  CurrentConversation,
  ForgetConversationResult,
  ProjectInfo,
  StartTurnRequest,
  TurnNotice,
  TurnSummary,
} from '@kumicraft/shared';
import { nanoid } from 'nanoid';

import type { JobContext, JobService } from '../jobs/job-service.ts';
import type { MirrorResult, MirrorService } from '../mirror/mirror-types.ts';
import type { EventBusPort } from '../ports/event-bus-port.ts';
import type { FileSystemPort } from '../ports/file-system-port.ts';
import type { LoggerPort } from '../ports/logger-port.ts';
import type { ProcessPort } from '../ports/process-port.ts';
import { type AppError, err, ok, type Result } from '../shared/result.ts';
import type { AgentService } from './agent-service.ts';
import type { AgentAdapter, AgentCommand } from './agent-types.ts';
import type { ChatImageStore } from './chat-images.ts';
import { buildPrompt } from './prompt.ts';
import { forgetInProject, resumeInProject } from './session-forget.ts';
import type { TurnSnapshotStore } from './snapshot/snapshot-types.ts';
import { computeAdapterArgs, runningSummary } from './turn-args.ts';
import { type AgentRun, createReplyCollector, redactEventSecrets } from './turn-events.ts';
import { settleInterruptedTurns } from './turn-interrupted.ts';
import type { TurnStore } from './turn-store.ts';

export const AGENT_TURN_TIMEOUT_MS = 30 * 60 * 1000;

export type ResolvedAgent = {
  readonly adapter: AgentAdapter;
  readonly command: AgentCommand;
  readonly status: AgentStatus;
};

export type TurnRunnerDeps = {
  readonly fs: FileSystemPort;
  readonly process: ProcessPort;
  readonly jobs: JobService;
  readonly agents: Pick<AgentService, 'resolve'>;
  readonly mirror: Pick<MirrorService, 'refresh' | 'check'>;
  readonly snapshots: TurnSnapshotStore;
  readonly store: TurnStore;
  readonly project: () => Result<ProjectInfo>;
  readonly eventBus?: EventBusPort | undefined;
  readonly logger: LoggerPort;
  readonly now: () => Date;
  readonly newTurnId?: () => string;
  readonly timeoutMs?: number | undefined;
  readonly chatImages?: ChatImageStore | undefined;
};

export type TurnRunner = {
  start(
    request: StartTurnRequest,
  ): Promise<Result<{ readonly jobId: string; readonly turnId: string }>>;
  list(): Promise<Result<readonly TurnSummary[]>>;
  /** The conversation the next "continue" turn resumes (K9.5). */
  conversation(): Promise<Result<CurrentConversation>>;
  /** Makes an earlier conversation of this project the one "continue" resumes (K9.5). */
  resume(conversationId: string): Promise<Result<CurrentConversation>>;
  /** Removes a session from KumiCraft's own list, never the agent's files (owner, 2026-11-15). */
  forget(conversationId: string | undefined): Promise<Result<ForgetConversationResult>>;
  diff(turnId: string, file: string): Promise<Result<string>>;
  revert(turnId: string): Promise<Result<TurnSummary>>;
};

type MirrorDir = { readonly backendId: string; readonly label: string; readonly dir: string };

async function prepareMirrors(
  mirrorService: Pick<MirrorService, 'refresh' | 'check'>,
  projectId: string,
  backends: readonly BackendInfo[],
  notices: TurnNotice[],
): Promise<readonly MirrorDir[]> {
  const mirrors: MirrorDir[] = [];
  for (const backend of backends) {
    const res: MirrorResult = await mirrorService.refresh(projectId, backend);
    if (res.state === 'ready' && res.dir !== undefined) {
      mirrors.push({ backendId: backend.id, label: backend.label, dir: res.dir });
    } else if (res.state === 'skipped' || res.state === 'failed') {
      notices.push({ code: 'backendSkipped', backendId: backend.id, label: backend.label });
    } else {
      notices.push({ code: 'backendTooLarge', backendId: backend.id, label: backend.label });
    }
  }
  return mirrors;
}

async function checkMirrorsModified(
  mirrorService: Pick<MirrorService, 'refresh' | 'check'>,
  projectId: string,
  backends: readonly BackendInfo[],
  readyIds: ReadonlySet<string>,
  notices: TurnNotice[],
): Promise<void> {
  for (const backend of backends) {
    if (!readyIds.has(backend.id)) continue;
    const checkRes = await mirrorService.check(projectId, backend.id);
    if (checkRes === 'modified') {
      notices.push({ code: 'mirrorModified', backendId: backend.id, label: backend.label });
    }
  }
}

function determineOutcome(
  signal: AbortSignal,
  exitCode: number,
  hasErrorEvent: boolean,
  agent: 'agy' | 'claude',
  timeoutMs: number,
): { state: 'completed' | 'failed' | 'cancelled'; error?: AppError | undefined } {
  if (signal.aborted) {
    return { state: 'cancelled', error: { code: 'E019' } };
  }
  if (exitCode === 124) {
    return { state: 'failed', error: { code: 'E020', params: { operation: 'agent', timeoutMs } } };
  }
  if (exitCode !== 0 || hasErrorEvent) {
    return { state: 'failed', error: { code: 'E027', params: { agent, exitCode } } };
  }
  return { state: 'completed' };
}

async function resolveConversation(
  store: TurnStore,
  projectId: string,
  mode: 'new' | 'continue',
  agent: 'agy' | 'claude',
): Promise<string | undefined> {
  if (mode === 'continue') {
    const prev = await store.conversation(projectId);
    return prev?.agent === agent ? prev.id : undefined;
  }
  await store.setConversation(projectId, undefined);
  return undefined;
}

async function executeAgentProcess(
  deps: TurnRunnerDeps,
  resolved: ResolvedAgent,
  args: readonly string[],
  cwd: string,
  timeoutMs: number,
  turnId: string,
  projectId: string,
  signal: AbortSignal,
): Promise<AgentRun> {
  let hasErrorEvent = false;
  const reply = createReplyCollector();
  let conversationId: string | undefined;
  // Cancelled while the snapshot or mirrors were being prepared: never start the agent.
  if (signal.aborted) return { exitCode: 1, hasErrorEvent, reply: '' };
  const handle = deps.process.spawn(resolved.command.command, args, { cwd, timeoutMs });

  const onAbort = () => {
    void handle.kill();
  };
  signal.addEventListener('abort', onAbort, { once: true });

  handle.onLine((line) => {
    const event = resolved.adapter.parseLine(line);
    if (event !== undefined) {
      const redacted = redactEventSecrets(event);
      if (redacted.kind === 'conversation') conversationId = redacted.id;
      if (redacted.kind === 'error') {
        hasErrorEvent = true;
      }
      reply.add(redacted);
      deps.eventBus?.publish('agent.event', { turnId, event: redacted });
    }
  });

  const out = await handle.wait();
  signal.removeEventListener('abort', onAbort);
  // Saved before the turn ends, so an immediate "continue" turn reads it (R-AG-16).
  if (conversationId !== undefined) {
    await deps.store.setConversation(projectId, { agent: resolved.status.id, id: conversationId });
  }
  return { exitCode: out.exitCode, hasErrorEvent, reply: reply.text(), conversationId };
}

type TurnPreparation = {
  readonly initialSummary: TurnSummary;
  readonly args: readonly string[];
  readonly readyIds: ReadonlySet<string>;
  readonly notices: TurnNotice[];
};

async function prepareTurnRun(
  deps: TurnRunnerDeps,
  projectInfo: ProjectInfo,
  resolved: ResolvedAgent,
  turnId: string,
  request: StartTurnRequest,
  imagePaths: readonly string[],
): Promise<Result<TurnPreparation>> {
  const capRes = await deps.snapshots.capture(projectInfo.id, projectInfo.root, turnId);
  if (!capRes.ok) return err(capRes.error);

  const notices: TurnNotice[] = [];
  const mirrors = await prepareMirrors(deps.mirror, projectInfo.id, projectInfo.backends, notices);
  const guideRes = await deps.fs.readText(projectInfo.root, '.kumicraft/agent-guide.md');
  const allowEdits = projectInfo.ai?.allowEdits ?? true;
  const promptRes = buildPrompt({
    request: request.prompt,
    context: request.context,
    mirrors,
    docs: request.docs,
    images: imagePaths.length > 0 ? imagePaths : undefined,
    guide: guideRes.ok ? guideRes.value : undefined,
    styling: projectInfo.support.styling,
    allowEdits,
  });
  if (!promptRes.ok) return err(promptRes.error);

  const convId = await resolveConversation(
    deps.store,
    projectInfo.id,
    request.conversation,
    resolved.status.id,
  );
  const started = runningSummary(deps, turnId, resolved, request, notices);
  // A resumed conversation is known now; a new one once the agent reports it.
  const initialSummary = convId === undefined ? started : { ...started, conversation: convId };
  await deps.store.save(projectInfo.id, initialSummary);

  const imgDir = imagePaths.length > 0 ? deps.chatImages?.dirOf(projectInfo.id) : undefined;
  // The model and effort the user picked for this agent in the chat (K9.5).
  const choice = projectInfo.ai?.agents?.[resolved.status.id];
  const args = computeAdapterArgs(
    resolved,
    promptRes.value,
    mirrors,
    allowEdits,
    convId,
    imgDir,
    choice,
  );
  return ok({ initialSummary, args, readyIds: new Set(mirrors.map((m) => m.backendId)), notices });
}

async function finalizeTurn(
  deps: TurnRunnerDeps,
  projectInfo: ProjectInfo,
  resolved: ResolvedAgent,
  turnId: string,
  prep: TurnPreparation,
  run: AgentRun,
  timeoutMs: number,
  signal: AbortSignal,
): Promise<Result<TurnSummary>> {
  const finishRes = await deps.snapshots.finish(projectInfo.id, projectInfo.root, turnId);
  const files = finishRes.ok ? [...finishRes.value] : [];
  await checkMirrorsModified(
    deps.mirror,
    projectInfo.id,
    projectInfo.backends,
    prep.readyIds,
    prep.notices,
  );

  const { exitCode } = run;
  const outcome = determineOutcome(
    signal,
    exitCode,
    run.hasErrorEvent,
    resolved.status.id,
    timeoutMs,
  );

  const finalSummary: TurnSummary = {
    ...prep.initialSummary,
    finishedAt: deps.now().toISOString(),
    state: outcome.state,
    files,
    revertible: files.length > 0,
    notices: prep.notices,
    ...(run.reply === '' ? {} : { reply: run.reply }),
    ...(run.conversationId === undefined ? {} : { conversation: run.conversationId }),
  };
  await deps.store.save(projectInfo.id, finalSummary);

  deps.logger.info(
    { projectId: projectInfo.id, turnId, agent: resolved.status.id, exitCode },
    'agent turn finished',
  );

  if (outcome.state === 'completed') {
    return ok(finalSummary);
  }
  return err(outcome.error ?? { code: 'E027', params: { agent: resolved.status.id, exitCode } });
}

async function runTurn(
  ctx: JobContext,
  deps: TurnRunnerDeps,
  projectInfo: ProjectInfo,
  resolved: ResolvedAgent,
  turnId: string,
  request: StartTurnRequest,
  imagePaths: readonly string[],
): Promise<Result<TurnSummary>> {
  const timeoutMs = deps.timeoutMs ?? AGENT_TURN_TIMEOUT_MS;
  const prepRes = await prepareTurnRun(deps, projectInfo, resolved, turnId, request, imagePaths);
  if (!prepRes.ok) return err(prepRes.error);

  const run = await executeAgentProcess(
    deps,
    resolved,
    prepRes.value.args,
    projectInfo.root,
    timeoutMs,
    turnId,
    projectInfo.id,
    ctx.signal,
  );

  return finalizeTurn(
    deps,
    projectInfo,
    resolved,
    turnId,
    prepRes.value,
    run,
    timeoutMs,
    ctx.signal,
  );
}

/** Checks the request, then runs the turn as a job; the turn counts as active until the job ends. */
async function startTurn(
  deps: TurnRunnerDeps,
  activeTurnIds: Set<string>,
  request: StartTurnRequest,
): Promise<Result<{ readonly jobId: string; readonly turnId: string }>> {
  const pRes = deps.project();
  if (!pRes.ok) return pRes;
  if (!pRes.value.trusted) {
    return err({ code: 'E011', params: { reason: 'untrusted' } });
  }
  const aRes = await deps.agents.resolve();
  if (!aRes.ok) return aRes;

  for (const doc of request.docs) {
    const docExists = await deps.fs.exists(pRes.value.root, doc);
    if (!docExists) {
      return err({ code: 'E015', params: { resource: 'file', id: doc } });
    }
  }

  let imagePaths: readonly string[] = [];
  const reqImages = request.images ?? [];
  if (reqImages.length > 0) {
    if (deps.chatImages === undefined) {
      return err({ code: 'E015', params: { resource: 'image', id: reqImages[0] ?? '' } });
    }
    const imgRes = await deps.chatImages.resolve(pRes.value.id, reqImages);
    if (!imgRes.ok) return imgRes;
    imagePaths = imgRes.value;
  }

  const turnId = deps.newTurnId ? deps.newTurnId() : nanoid(10);
  activeTurnIds.add(turnId);
  const jobRes = deps.jobs.start('agent.turn', 'agent.turn', async (ctx) => {
    try {
      return await runTurn(ctx, deps, pRes.value, aRes.value, turnId, request, imagePaths);
    } finally {
      activeTurnIds.delete(turnId);
    }
  });
  if (!jobRes.ok) {
    activeTurnIds.delete(turnId);
    return jobRes;
  }
  return ok({ jobId: jobRes.value.jobId, turnId });
}

export function createTurnRunner(deps: TurnRunnerDeps): TurnRunner {
  /** Turns running in this server; any other "running" turn was cut off by a restart. */
  const activeTurnIds = new Set<string>();
  return {
    start: (request) => startTurn(deps, activeTurnIds, request),

    async list() {
      const pRes = deps.project();
      if (!pRes.ok) return pRes;
      const summaries = await deps.store.list(pRes.value.id);
      return ok(
        await settleInterruptedTurns(deps.store, pRes.value.id, summaries, activeTurnIds, deps.now),
      );
    },

    async conversation() {
      const pRes = deps.project();
      if (!pRes.ok) return pRes;
      return ok((await deps.store.conversation(pRes.value.id)) ?? {});
    },

    resume: (conversationId) => resumeInProject(deps, conversationId),
    forget: (conversationId) => forgetInProject(deps, conversationId),

    async diff(turnId, file) {
      const pRes = deps.project();
      if (!pRes.ok) return pRes;
      return deps.snapshots.diff(pRes.value.id, turnId, file);
    },

    async revert(turnId) {
      const pRes = deps.project();
      if (!pRes.ok) return pRes;
      const projectId = pRes.value.id;
      // Look the turn up first: an unknown turn must not change any file.
      const existing = await deps.store.get(projectId, turnId);
      if (existing === undefined) {
        return err({ code: 'E015', params: { resource: 'turn', id: turnId } });
      }
      const revRes = await deps.snapshots.revert(projectId, pRes.value.root, turnId);
      if (!revRes.ok) return revRes;
      const updated: TurnSummary = { ...existing, revertible: false };
      await deps.store.save(projectId, updated);
      return ok(updated);
    },
  };
}
