// On-demand build check as a job (SPEC-04 M-BC, K9 stage C): the project's own `tsc` and `vite`
// (or Pug), never KumiCraft's; nothing is written to the project, the Vite output goes to a temp
// folder in KumiCraft's cache that is removed afterwards.
import {
  type BuildCheckResult,
  type BuildProblem,
  MAX_BUILD_PROBLEMS,
  type RelPath,
} from '@kumicraft/shared';

import type { JobContext, JobService } from '../../jobs/job-service.ts';
import type { FileSystemPort } from '../../ports/file-system-port.ts';
import type { ProcessPort } from '../../ports/process-port.ts';
import { err, ok, type Result } from '../../shared/result.ts';
import type { FrameworkAdapter } from '../frameworks/types.ts';
import type { WorkspaceState } from '../project-types.ts';
import { findPackage } from '../workspace-root.ts';
import { parsePugOutput, parseTscOutput, parseViteOutput } from './parse-build-output.ts';
import { tsconfigsToCheck } from './tsconfig-targets.ts';

export const BUILD_CHECK_STEP_KEY = 'jobs:buildCheck.running';
const STEP_TIMEOUT_MS = 300_000;

export type BuildCheckDeps = {
  readonly fs: FileSystemPort;
  readonly process: ProcessPort;
  readonly jobs: JobService;
  /** KumiCraft's cache folder; the Vite output goes to `build-check/<id>` inside it. */
  readonly cacheDir: string;
  /** Path of the `pug-check` child script. */
  readonly pugCheckScript?: string | undefined;
  readonly state: () => WorkspaceState;
  readonly adapter: () => FrameworkAdapter;
  readonly now?: () => number;
};

type StepOutput = { readonly exitCode: number; readonly text: string };

/** Runs `node <script> …args` in the project; cancelling the job stops it. */
async function runNode(
  deps: BuildCheckDeps,
  ctx: JobContext,
  cwd: string,
  args: readonly string[],
): Promise<StepOutput> {
  const handle = deps.process.spawn(process.execPath, args, {
    cwd,
    timeoutMs: STEP_TIMEOUT_MS,
    env: { NO_COLOR: '1', FORCE_COLOR: '0' },
  });
  const onAbort = () => {
    void handle.kill();
  };
  ctx.signal.addEventListener('abort', onAbort, { once: true });
  try {
    const out = await handle.wait();
    return { exitCode: out.exitCode, text: `${out.stdout}\n${out.stderr}` };
  } finally {
    ctx.signal.removeEventListener('abort', onAbort);
  }
}

async function checkTypes(
  deps: BuildCheckDeps,
  ctx: JobContext,
  root: string,
): Promise<BuildProblem[]> {
  const configs = await tsconfigsToCheck(deps.fs, root);
  if (configs.length === 0) return [];
  const typescript = await findPackage(deps.fs, root, 'typescript');
  if (typescript === undefined) {
    return [{ source: 'tsc', message: 'typescript is not installed in the project' }];
  }
  const problems: BuildProblem[] = [];
  for (const config of configs) {
    if (ctx.signal.aborted) break;
    ctx.reportLine(`tsc -p ${config}`);
    const out = await runNode(deps, ctx, root, [
      `${typescript}/bin/tsc`,
      '--noEmit',
      '-p',
      config,
      '--pretty',
      'false',
    ]);
    const found = parseTscOutput(out.text, root);
    if (out.exitCode !== 0 && found.length === 0) {
      problems.push({
        source: 'tsc',
        message: `tsc -p ${config} exited with ${String(out.exitCode)}`,
      });
    }
    problems.push(...found);
  }
  return problems;
}

async function checkViteBuild(
  deps: BuildCheckDeps,
  ctx: JobContext,
  root: string,
): Promise<BuildProblem[]> {
  const vite = await findPackage(deps.fs, root, 'vite');
  if (vite === undefined)
    return [{ source: 'vite', message: 'vite is not installed in the project' }];
  const outRel = `build-check/${String(Date.now())}-${String(Math.random()).slice(2, 8)}`;
  const outDir = `${deps.cacheDir.replaceAll('\\', '/')}/${outRel}`;
  ctx.reportLine('vite build');
  try {
    const out = await runNode(deps, ctx, root, [
      `${vite}/bin/vite.js`,
      'build',
      '--outDir',
      outDir,
      '--emptyOutDir',
      '--logLevel',
      'error',
    ]);
    return out.exitCode === 0 ? [] : parseViteOutput(out.text, root);
  } finally {
    await deps.fs.remove(deps.cacheDir, outRel);
  }
}

async function checkPugViews(
  deps: BuildCheckDeps,
  ctx: JobContext,
  root: string,
  viewsDir: RelPath | undefined,
): Promise<BuildProblem[]> {
  if (deps.pugCheckScript === undefined)
    return [{ source: 'pug', message: 'pug check unavailable' }];
  ctx.reportLine('pug compile');
  const out = await runNode(deps, ctx, root, [deps.pugCheckScript, root, viewsDir ?? 'views']);
  const found = parsePugOutput(out.text, root);
  if (found !== undefined) return found;
  return [{ source: 'pug', message: out.text.trim().slice(0, 500) || 'pug check failed' }];
}

export function summarize(problems: readonly BuildProblem[], durationMs: number): BuildCheckResult {
  return {
    ok: problems.length === 0,
    problems: problems.slice(0, MAX_BUILD_PROBLEMS),
    total: problems.length,
    durationMs: Math.max(0, Math.round(durationMs)),
  };
}

/** Checks trust and adapter at once, then runs the check as the `project.buildCheck` job. */
export function startBuildCheck(deps: BuildCheckDeps): Result<{ readonly jobId: string }> {
  const current = deps.state();
  if (current.status !== 'open') return err({ code: 'E021', params: { missing: 'project' } });
  if (!current.trusted) {
    return err({ code: 'E011', params: { path: current.root, reason: 'untrusted' } });
  }
  const kind = deps.adapter().buildCheck;
  if (kind === undefined) return err({ code: 'E016', params: { reason: 'buildCheckUnsupported' } });
  const { root } = current;
  const now = deps.now ?? (() => Date.now());
  return deps.jobs.start('project.buildCheck', BUILD_CHECK_STEP_KEY, async (ctx) => {
    const started = now();
    const problems =
      kind === 'pug'
        ? await checkPugViews(deps, ctx, root, current.support.viewsDir)
        : [...(await checkTypes(deps, ctx, root)), ...(await checkViteBuild(deps, ctx, root))];
    return ok(summarize(problems, now() - started));
  });
}
