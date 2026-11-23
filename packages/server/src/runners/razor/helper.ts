// KumiCraft's Razor helper process (docs/architecture/03c section 2.2): built once per .NET SDK
// from `razor-helper/` with the user's own SDK, then kept running; it tells which parts of a
// .cshtml are C#. Used by the Razor editor (server) and the Razor runner (stamping the copy).
import { type ChildProcess, execFile, spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdir, rename, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { createInterface } from 'node:readline';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

const run = promisify(execFile);
const DLL = 'KumiCraft.RazorHelper.dll';

export type CodeRange = { readonly start: number; readonly end: number };

export type RazorHelper = {
  codeRanges(file: string, text: string): Promise<readonly CodeRange[]>;
  close(): void;
};

export type DotnetSdk = { readonly version: string; readonly dir: string; readonly major: number };

/**
 * The helper's C# source: `src/razor-helper` in the repository, `dist/razor-helper` in the built
 * CLI (this code is bundled into files at `dist/` and `dist/runners/`).
 */
export function razorHelperSource(): string {
  for (const candidate of ['./razor-helper/', '../razor-helper/', '../../razor-helper/']) {
    const dir = fileURLToPath(new URL(candidate, import.meta.url));
    if (existsSync(join(dir, 'KumiCraft.RazorHelper.csproj'))) return dir;
  }
  return fileURLToPath(new URL('../../razor-helper/', import.meta.url));
}

/** Where a project's helper is built: in its obj/ folder, shared by the runner and the editor. */
export const helperCacheDir = (root: string): string => join(root, 'obj', 'kumicraft');

/** The newest .NET SDK installed (`dotnet --list-sdks`); undefined when there is none. */
export async function findDotnetSdk(): Promise<DotnetSdk | undefined> {
  try {
    const { stdout } = await run('dotnet', ['--list-sdks'], { windowsHide: true });
    const sdks = stdout
      .split(/\r?\n/)
      .map((line) => /^(\d+)\.(\d+)\.(\d+)\S*\s+\[(.+)\]$/.exec(line.trim()))
      .filter((m): m is RegExpExecArray => Boolean(m))
      .map((m) => ({
        version: m[0].split(/\s/)[0] ?? '',
        dir: join(m[4] ?? '', m[0].split(/\s/)[0] ?? ''),
        major: Number(m[1]),
        rank: Number(m[1]) * 1e8 + Number(m[2]) * 1e4 + Number(m[3]),
      }))
      .sort((a, b) => b.rank - a.rank);
    const best = sdks[0];
    return best === undefined
      ? undefined
      : { version: best.version, dir: best.dir, major: best.major };
  } catch {
    return undefined;
  }
}

/** The helper built for `sdk` in `cacheDir`, building it the first time (no download). */
export async function buildRazorHelper(
  sourceDir: string,
  cacheDir: string,
  sdk: DotnetSdk,
): Promise<string> {
  const out = join(cacheDir, 'razor-helper', sdk.version);
  const dll = join(out, DLL);
  if (existsSync(dll)) return dll;
  // Built aside, then moved in place: a second KumiCraft building at the same time is harmless.
  const work = `${out}.build-${String(process.pid)}`;
  await rm(work, { recursive: true, force: true });
  await mkdir(work, { recursive: true });
  await run(
    'dotnet',
    [
      'build',
      join(sourceDir, 'KumiCraft.RazorHelper.csproj'),
      '-nologo',
      '-v',
      'q',
      '-c',
      'Release',
      `-p:KumiSdkDir=${sdk.dir}`,
      `-p:TargetFramework=net${String(sdk.major)}.0`,
      `-p:BaseIntermediateOutputPath=${join(work, 'obj')}/`,
      '-o',
      join(work, 'bin'),
    ],
    { windowsHide: true, maxBuffer: 16 * 1024 * 1024 },
  );
  try {
    await rename(join(work, 'bin'), out);
  } catch (cause: unknown) {
    if (!existsSync(dll)) throw cause;
  } finally {
    await rm(work, { recursive: true, force: true });
  }
  return dll;
}

type Waiter = { resolve(ranges: readonly CodeRange[]): void; reject(error: Error): void };

function parseReply(
  line: string,
): { id: number; code: number[][] | undefined; error: string | undefined } | undefined {
  try {
    const value: unknown = JSON.parse(line);
    if (typeof value !== 'object' || !value || !('id' in value)) return undefined;
    const id = Number(value.id);
    const code =
      'code' in value && Array.isArray(value.code) ? (value.code as number[][]) : undefined;
    const error = 'error' in value && typeof value.error === 'string' ? value.error : undefined;
    return { id, code, error };
  } catch {
    return undefined;
  }
}

function listen(child: ChildProcess, waiting: Map<number, Waiter>): void {
  if (!child.stdout) return;
  createInterface({ input: child.stdout }).on('line', (line) => {
    const reply = parseReply(line);
    if (reply === undefined) return;
    const waiter = waiting.get(reply.id);
    waiting.delete(reply.id);
    if (reply.error !== undefined) waiter?.reject(new Error(reply.error));
    else waiter?.resolve((reply.code ?? []).map(([start = 0, end = 0]) => ({ start, end })));
  });
  child.on('exit', () => {
    for (const waiter of waiting.values()) waiter.reject(new Error('The Razor helper stopped'));
    waiting.clear();
  });
}

/** Starts the built helper; one process answers every request, in order. */
export function startRazorHelper(dll: string, cwd: string): RazorHelper {
  const child = spawn('dotnet', [dll], {
    cwd,
    stdio: ['pipe', 'pipe', 'ignore'],
    windowsHide: true,
  });
  const waiting = new Map<number, Waiter>();
  let next = 0;
  listen(child, waiting);
  return {
    codeRanges(file, text) {
      next += 1;
      const id = next;
      return new Promise((resolve, reject) => {
        waiting.set(id, { resolve, reject });
        child.stdin.write(`${JSON.stringify({ id, file, text })}\n`);
      });
    },
    close() {
      child.stdin.end();
      child.kill();
    },
  };
}

/** Reads the C# ranges of a .cshtml for the editor: one helper per project, started on first use. */
export type RazorCodeReader = {
  codeRanges(root: string, file: string, text: string): Promise<readonly CodeRange[]>;
  close(): void;
};

export function createRazorCodeReader(): RazorCodeReader {
  const helpers = new Map<string, Promise<RazorHelper>>();
  const helperFor = (root: string): Promise<RazorHelper> => {
    const known = helpers.get(root);
    if (known !== undefined) return known;
    const started = (async () => {
      try {
        const sdk = await findDotnetSdk();
        if (sdk === undefined) throw new Error('No .NET SDK was found');
        const dll = await buildRazorHelper(razorHelperSource(), helperCacheDir(root), sdk);
        return startRazorHelper(dll, root);
      } catch (cause: unknown) {
        // Tried again on the next request (the SDK may be installed meanwhile).
        helpers.delete(root);
        throw cause;
      }
    })();
    helpers.set(root, started);
    return started;
  };
  return {
    async codeRanges(root, file, text) {
      const helper = await helperFor(root);
      return helper.codeRanges(file, text);
    },
    close() {
      for (const started of helpers.values()) {
        void (async () => {
          try {
            (await started).close();
          } catch {
            // never started: nothing to stop
          }
        })();
      }
      helpers.clear();
    },
  };
}
