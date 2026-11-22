// Detection logic for express-pug framework adapter (SPEC-04 K4, Section 3.3).
import type { PackageManager, RelPath, SupportReport, UnsupportedReason } from '@kumicraft/shared';

import type { DetectInput } from '../../../kernel/stacks.ts';
import {
  findPackage,
  findPackageWorkspaceRoot,
  isPackageWorkspace,
} from '../../../lib/workspace-root.ts';
import type { FileSystemPort } from '../../../ports/file-system-port.ts';

type PkgJson = {
  readonly scripts?: Readonly<Record<string, string>>;
  readonly main?: string;
  readonly dependencies?: Readonly<Record<string, string>>;
  readonly devDependencies?: Readonly<Record<string, string>>;
  readonly packageManager?: string;
};

const DEFAULT_SERVER_ENTRIES = [
  'app.js',
  'app.cjs',
  'app.mjs',
  'server.js',
  'server.cjs',
  'server.mjs',
  'index.js',
  'index.cjs',
  'index.mjs',
  'bin/www',
  'bin/www.js',
  'bin/www.cjs',
  'bin/www.mjs',
  'src/app.js',
  'src/app.cjs',
  'src/app.mjs',
  'src/server.js',
  'src/server.cjs',
  'src/server.mjs',
  'src/index.js',
  'src/index.cjs',
  'src/index.mjs',
] as const;

const ARG_FLAGS = new Set([
  '-r',
  '--require',
  '-w',
  '--watch',
  '--env-file',
  '--loader',
  '--import',
]);

function parseScriptCommand(command: string): string | undefined {
  const tokens = command.trim().split(/\s+/);
  if (tokens.length < 2) return undefined;
  const runner = tokens[0]?.toLowerCase();
  if (runner !== 'node' && runner !== 'nodemon') return undefined;

  let i = 1;
  while (i < tokens.length) {
    const token = tokens[i];
    if (token === undefined) break;
    if (ARG_FLAGS.has(token)) {
      i += 2;
    } else if (token.startsWith('-')) {
      i += 1;
    } else {
      return token.replace(/^\.[/\\]/, '').replaceAll('\\', '/');
    }
  }
  return undefined;
}

async function findExistingCandidate(
  fs: FileSystemPort,
  root: string,
  candidate: string,
): Promise<string | undefined> {
  const exts = ['', '.js', '.cjs', '.mjs'];
  for (const ext of exts) {
    const candidatePath = `${candidate}${ext}`;
    if (await fs.exists(root, candidatePath)) {
      return candidatePath;
    }
  }
  return undefined;
}

async function resolveStartupFile(
  fs: FileSystemPort,
  root: string,
  pkg: PkgJson,
): Promise<string | undefined> {
  const scripts = pkg.scripts ?? {};
  const devCommand = scripts['dev'];
  const startCommand = scripts['start'];

  const scriptCandidates = [
    devCommand !== undefined ? parseScriptCommand(devCommand) : undefined,
    startCommand !== undefined ? parseScriptCommand(startCommand) : undefined,
  ].filter((c): c is string => c !== undefined && c !== '');

  for (const candidate of scriptCandidates) {
    const found = await findExistingCandidate(fs, root, candidate);
    if (found !== undefined) return found;
  }

  if (typeof pkg.main === 'string' && pkg.main.trim() !== '') {
    const normalized = pkg.main
      .trim()
      .replace(/^\.[/\\]/, '')
      .replaceAll('\\', '/');
    const found = await findExistingCandidate(fs, root, normalized);
    if (found !== undefined) return found;
  }

  for (const candidate of DEFAULT_SERVER_ENTRIES) {
    if (await fs.exists(root, candidate)) {
      return candidate;
    }
  }

  return undefined;
}

function parseViewsDirFromContent(content: string): string | undefined {
  const match = content.match(
    /app\.set\(\s*['"]views['"]\s*,\s*(?:path\.join\([^)]*['"]([^'"]+)['"]\s*\)|['"]([^'"]+)['"])\s*\)/,
  );
  const matched = match?.[1] ?? match?.[2];
  return matched !== undefined && matched.trim() !== '' ? matched.trim() : undefined;
}

async function resolveViewsDir(
  fs: FileSystemPort,
  root: string,
  serverEntry?: string,
): Promise<RelPath> {
  if (serverEntry === undefined) return 'views';
  const read = await fs.readText(root, serverEntry, { maxBytes: 1024 * 1024 });
  if (!read.ok) return 'views';
  return parseViewsDirFromContent(read.value) ?? 'views';
}

function detectPackageManagerFromField(field?: string): PackageManager | undefined {
  if (!field) return undefined;
  if (field.startsWith('pnpm')) return 'pnpm';
  if (field.startsWith('yarn')) return 'yarn';
  if (field.startsWith('npm')) return 'npm';
  return undefined;
}

async function detectPackageManager(
  fs: FileSystemPort,
  root: string,
  pkgJson?: PkgJson,
): Promise<PackageManager | undefined> {
  const fromField = detectPackageManagerFromField(pkgJson?.packageManager);
  if (fromField !== undefined) return fromField;
  if (await fs.exists(root, 'pnpm-lock.yaml')) return 'pnpm';
  if (await fs.exists(root, 'yarn.lock')) return 'yarn';
  if (await fs.exists(root, 'package-lock.json')) return 'npm';
  return undefined;
}

async function resolveInstalledVersion(
  fs: FileSystemPort,
  root: string,
  pkgName: string,
  declaredVersion?: string,
): Promise<string | undefined> {
  const pkgDir = await findPackage(fs, root, pkgName);
  if (pkgDir !== undefined) {
    const installedText = await fs.readText(pkgDir, 'package.json');
    if (installedText.ok) {
      try {
        const parsed = JSON.parse(installedText.value) as { version?: unknown };
        if (typeof parsed.version === 'string') {
          return parsed.version;
        }
      } catch {
        // Ignored
      }
    }
  }
  return declaredVersion;
}

export async function detectExpressPug(input: DetectInput): Promise<SupportReport> {
  const pkg = (input.packageJson ?? {}) as PkgJson;
  const deps = { ...(pkg.dependencies ?? {}), ...(pkg.devDependencies ?? {}) };
  const reasons: UnsupportedReason[] = [];

  // A server needs express to run, so it is a dependency. In devDependencies only it is a tool of
  // the repo (KumiCraft itself keeps express there for its fixtures), not an app to start.
  const hasExpress = 'express' in (pkg.dependencies ?? {});
  const hasPug = 'pug' in deps;
  if (!hasExpress) reasons.push('noExpress');
  if (!hasPug) reasons.push('noPug');

  // A workspace root holds apps; it is never one, and its scripts start the whole workspace.
  const isWorkspaceRoot = await isPackageWorkspace(input.fs, input.root);
  const serverEntry = isWorkspaceRoot
    ? undefined
    : await resolveStartupFile(input.fs, input.root, pkg);
  if (serverEntry === undefined) {
    reasons.push('noServerEntry');
  }

  const viewsDir = await resolveViewsDir(input.fs, input.root, serverEntry);
  const packageManager = await detectPackageManager(input.fs, input.root, pkg);
  const workspaceRoot = await findPackageWorkspaceRoot(input.fs, input.root);

  const expressVersion = await resolveInstalledVersion(
    input.fs,
    input.root,
    'express',
    deps['express'],
  );
  const pugVersion = await resolveInstalledVersion(input.fs, input.root, 'pug', deps['pug']);

  return {
    supported: reasons.length === 0,
    reasons,
    framework: 'express-pug',
    ...(workspaceRoot !== undefined ? { workspaceRoot } : {}),
    versions: {
      ...(expressVersion !== undefined ? { express: expressVersion } : {}),
      ...(pugVersion !== undefined ? { pug: pugVersion } : {}),
    },
    language: 'js',
    ...(packageManager !== undefined ? { packageManager } : {}),
    styling: {
      systems: [],
      editable: false,
      globalCss: [],
    },
    editMode: 'viewOnly',
    ...(serverEntry !== undefined ? { serverEntry } : {}),
    viewsDir,
  };
}
