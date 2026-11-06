// Build check against real `tsc`, `vite` and Pug in a temp project (K9 C1–C3, M-BC).
import { existsSync } from 'node:fs';
import { cp, mkdir, mkdtemp, readdir, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { type BuildCheckResult, BuildCheckResultSchema, newWorkspaceFile } from '@kumicraft/shared';
import { afterEach, describe, expect, it } from 'vitest';

import { createNodeProcess } from '../../../adapters/system/node-process.ts';
import { createJobService } from '../../jobs/job-service.ts';
import { nodeFs, silentLogger } from '../../workspace/test-support.ts';
import { expressPugAdapter } from '../frameworks/express-pug/index.ts';
import type { FrameworkAdapter } from '../frameworks/types.ts';
import { viteReactAdapter } from '../frameworks/vite-react/index.ts';
import type { WorkspaceState } from '../project-types.ts';
import { startBuildCheck } from './build-check.ts';

const repo = fileURLToPath(new URL('../../../../../../', import.meta.url));
const MODULES: Readonly<Record<string, string>> = {
  typescript: join(repo, 'node_modules/typescript'),
  vite: join(repo, 'packages/studio/node_modules/vite'),
  pug: join(repo, 'node_modules/pug'),
};

const temps: string[] = [];
afterEach(async () => {
  for (const dir of temps.splice(0)) await rm(dir, { recursive: true, force: true });
});

async function tempDir(prefix: string): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), prefix));
  temps.push(dir);
  return dir;
}

/** The project's node_modules: junctions to the packages KumiCraft itself has installed. */
async function linkModules(root: string, names: readonly string[]): Promise<void> {
  await mkdir(join(root, 'node_modules'), { recursive: true });
  for (const name of names) {
    const target = MODULES[name];
    if (target !== undefined) await symlink(target, join(root, 'node_modules', name), 'junction');
  }
}

function openState(root: string, trusted = true, viewsDir?: string): WorkspaceState {
  return {
    status: 'open',
    root,
    file: newWorkspaceFile({
      id: 'build00001',
      name: 'App',
      createdAt: '2026-01-01T00:00:00.000Z',
      framework: 'vite-react',
      responsiveMode: 'desktop-first',
    }),
    support: {
      supported: true,
      reasons: [],
      versions: {},
      framework: 'vite-react',
      language: 'ts',
      ...(viewsDir === undefined ? {} : { viewsDir }),
    },
    trusted,
    needsInstall: false,
    backends: [],
  };
}

async function runCheck(
  state: WorkspaceState,
  adapter: FrameworkAdapter,
  cacheDir: string,
): Promise<BuildCheckResult> {
  const jobs = createJobService({ system: { now: () => new Date() }, logger: silentLogger });
  const started = startBuildCheck({
    fs: nodeFs,
    process: createNodeProcess(),
    jobs,
    cacheDir,
    pugCheckScript: fileURLToPath(new URL('../../../runners/pug-check.ts', import.meta.url)),
    state: () => state,
    adapter: () => adapter,
  });
  if (!started.ok) throw new Error(started.error.code);
  for (;;) {
    const status = jobs.get(started.value.jobId);
    if (!status.ok) throw new Error(status.error.code);
    if (status.value.state === 'completed')
      return BuildCheckResultSchema.parse(status.value.result);
    if (status.value.state !== 'running') throw new Error(status.value.state);
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
}

async function viteProject(files: Readonly<Record<string, string>>): Promise<string> {
  const root = await tempDir('kc-build-');
  const all: Record<string, string> = {
    'package.json': '{ "name": "app", "private": true, "type": "module" }\n',
    'index.html': '<!doctype html><script type="module" src="/src/main.ts"></script>\n',
    'tsconfig.json': '{ "files": [], "references": [{ "path": "./tsconfig.app.json" }] }\n',
    'tsconfig.app.json': `{
  // Vite template style: JSON with comments
  "compilerOptions": { "strict": true, "noEmit": true, "jsx": "preserve", "target": "ES2022",
    "module": "ESNext", "moduleResolution": "bundler", "skipLibCheck": true, "lib": ["ES2022", "DOM"],
    "allowImportingTsExtensions": true,
    "tsBuildInfoFile": "./node_modules/.tmp/app.tsbuildinfo" },
  "include": ["src"]
}
`,
    'src/main.ts': "import { total } from './x.tsx';\nconsole.log(total);\n",
    ...files,
  };
  for (const [rel, text] of Object.entries(all)) {
    if (text === '') continue;
    await mkdir(join(root, rel, '..'), { recursive: true });
    await writeFile(join(root, rel), text);
  }
  await linkModules(root, ['typescript', 'vite']);
  return root;
}

describe('build check of a Vite project [WP-4.00, M-BC]', () => {
  it('C1: a type error is a tsc problem at src/x.tsx:3:7; fixed → ok; dist/ never made [WP-4.00]', async () => {
    const cache = await tempDir('kc-cache-');
    const bad =
      'export const total: number = 1;\n\nconst label: number = "x";\nexport { label };\n';
    const root = await viteProject({ 'src/x.tsx': bad });

    const failed = await runCheck(openState(root), viteReactAdapter, cache);
    expect(failed.ok).toBe(false);
    expect(failed.problems).toContainEqual(
      expect.objectContaining({ source: 'tsc', file: 'src/x.tsx', line: 3, column: 7 }),
    );
    expect(failed.problems[0]?.message).toContain('TS2322');

    await writeFile(join(root, 'src/x.tsx'), 'export const total: number = 1;\n');
    const fixed = await runCheck(openState(root), viteReactAdapter, cache);
    expect(fixed).toMatchObject({ ok: true, problems: [], total: 0 });
    expect(existsSync(join(root, 'dist'))).toBe(false);
    expect(existsSync(join(root, 'node_modules/.tmp'))).toBe(false);
    // The Vite output went to the cache and was removed.
    expect(await readdir(join(cache, 'build-check')).catch(() => [])).toEqual([]);
  }, 120_000);

  it('C2: a missing import is a vite problem with the importing file [WP-4.00]', async () => {
    const cache = await tempDir('kc-cache-');
    const root = await viteProject({
      'src/x.tsx': 'export const total: number = 1;\n',
      'src/main.ts': "import { total } from './x.tsx';\nimport './nope.ts';\nconsole.log(total);\n",
      // No tsconfig: no tsc step, only the Vite problem.
      'tsconfig.json': '',
      'tsconfig.app.json': '',
    });
    const result = await runCheck(openState(root), viteReactAdapter, cache);
    expect(result.ok).toBe(false);
    expect(result.problems).toContainEqual(
      expect.objectContaining({ source: 'vite', file: 'src/main.ts' }),
    );
    expect(result.problems.find((p) => p.source === 'vite')?.message).toContain('./nope.ts');
  }, 120_000);
});

describe('build check of an Express + Pug project [WP-4.00, M-BC]', () => {
  it('C2: a Pug syntax error in a fixture copy is a pug problem at views/x.pug:2 [WP-4.00]', async () => {
    const cache = await tempDir('kc-cache-');
    const root = await tempDir('kc-pug-');
    await cp(join(repo, 'fixtures/projects/express-pug'), root, {
      recursive: true,
      filter: (src) => !src.includes('node_modules'),
    });
    await linkModules(root, ['pug']);
    const clean = await runCheck(openState(root, true, 'views'), expressPugAdapter, cache);
    expect(clean).toMatchObject({ ok: true, problems: [] });

    await writeFile(join(root, 'views/x.pug'), 'div\n  p(class=)\n');
    const result = await runCheck(openState(root, true, 'views'), expressPugAdapter, cache);
    expect(result.ok).toBe(false);
    expect(result.problems).toEqual([
      expect.objectContaining({ source: 'pug', file: 'views/x.pug', line: 2 }),
    ]);
  }, 120_000);
});

describe('build check guards [WP-4.00, M-BC]', () => {
  it('C3: an untrusted project is refused with E011 before any job starts [WP-4.00]', () => {
    const jobs = createJobService({ system: { now: () => new Date() }, logger: silentLogger });
    const started = startBuildCheck({
      fs: nodeFs,
      process: createNodeProcess(),
      jobs,
      cacheDir: tmpdir(),
      state: () => openState(tmpdir(), false),
      adapter: () => viteReactAdapter,
    });
    expect(started.ok).toBe(false);
    if (!started.ok)
      expect(started.error).toMatchObject({ code: 'E011', params: { reason: 'untrusted' } });
  });

  it('C3: no open project → E021; an adapter without a build check → E016 [WP-4.00]', () => {
    const jobs = createJobService({ system: { now: () => new Date() }, logger: silentLogger });
    const base = {
      fs: nodeFs,
      process: createNodeProcess(),
      jobs,
      cacheDir: tmpdir(),
    };
    const none = startBuildCheck({
      ...base,
      state: () => ({ status: 'none' }),
      adapter: () => viteReactAdapter,
    });
    expect(none.ok || none.error.code).toBe('E021');
    const unsupported = startBuildCheck({
      ...base,
      state: () => openState(tmpdir()),
      adapter: () => ({ ...viteReactAdapter, buildCheck: undefined }),
    });
    expect(unsupported.ok || unsupported.error).toMatchObject({
      code: 'E016',
      params: { reason: 'buildCheckUnsupported' },
    });
  });
});
