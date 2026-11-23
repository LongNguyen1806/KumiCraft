// Find web application candidates in non-project folders or monorepo roots (SPEC-04 K5, Section 3.2).
import type { AppCandidate } from '@kumicraft/shared';

import type { FileSystemPort } from '../../ports/file-system-port.ts';
import { determineCandidateKind, hasCandidateWebFramework } from './frameworks/candidate-kind.ts';
import { detectStack, type StackTable } from './frameworks/index.ts';

const IGNORED_DIR_NAMES = new Set([
  'node_modules',
  '.git',
  '.kumicraft',
  'dist',
  'build',
  'out',
  'bin',
  'obj',
  '.next',
  'coverage',
  'venv',
  '.venv',
  '__pycache__',
]);

const MAX_SCANNED_DIRS = 2000;
const MAX_CANDIDATES = 20;

type PkgJson = {
  readonly dependencies?: Readonly<Record<string, string>>;
  readonly devDependencies?: Readonly<Record<string, string>>;
};

type ScanItem = {
  readonly relDir: string;
  readonly depth: number;
};

/** An ASP.NET project (03c): a .csproj the .NET stacks recognize as a web app with views. */
async function evaluateDotnetCandidate(
  fs: FileSystemPort,
  root: string,
  relDir: string,
  stacks: StackTable,
): Promise<AppCandidate | undefined> {
  const appRoot = `${root.replaceAll('\\', '/').replace(/\/+$/, '')}/${relDir}`;
  const read = await fs.readText(root, `${relDir}/package.json`, { maxBytes: 512 * 1024 });
  let packageJson: unknown;
  try {
    packageJson = read.ok ? JSON.parse(read.value) : {};
  } catch {
    packageJson = {};
  }
  const { report } = await detectStack({ root: appRoot, fs, packageJson }, stacks);
  if (report.framework === undefined) return undefined;
  return {
    path: relDir,
    framework: report.framework,
    kind: 'aspnet',
    supported: report.supported,
    reasons: report.reasons,
  };
}

async function evaluateCandidate(
  fs: FileSystemPort,
  root: string,
  relDir: string,
  stacks: StackTable,
): Promise<AppCandidate | undefined> {
  const readPkg = await fs.readText(root, `${relDir}/package.json`, { maxBytes: 512 * 1024 });
  if (!readPkg.ok) return undefined;

  let pkg: PkgJson;
  try {
    pkg = JSON.parse(readPkg.value) as PkgJson;
  } catch {
    return undefined;
  }

  const allDeps: Record<string, string> = {
    ...(pkg.dependencies ?? {}),
    ...(pkg.devDependencies ?? {}),
  };

  const kind = determineCandidateKind(allDeps);
  if (!hasCandidateWebFramework(kind, allDeps)) return undefined;

  const appRoot = `${root.replaceAll('\\', '/').replace(/\/+$/, '')}/${relDir}`;
  const { report } = await detectStack({ root: appRoot, fs, packageJson: pkg }, stacks);

  return {
    path: relDir,
    framework: report.framework,
    kind,
    supported: report.supported,
    reasons: report.reasons,
  };
}

/**
 * Recursively scans up to 3 directory levels for package.json candidates.
 * Limits scan to 2000 directories and returns at most 20 candidates, sorted
 * by openable first, then path alphabetically.
 */
export async function findAppCandidates(
  root: string,
  fs: FileSystemPort,
  stacks: StackTable,
): Promise<readonly AppCandidate[]> {
  const normRoot = root.replaceAll('\\', '/').replace(/\/+$/, '');
  const queue: ScanItem[] = [{ relDir: '', depth: 0 }];
  const candidates: AppCandidate[] = [];
  let scannedCount = 0;

  while (queue.length > 0 && scannedCount < MAX_SCANNED_DIRS) {
    const item = queue.shift();
    if (item === undefined) break;
    scannedCount += 1;

    const dirRes = await fs.readDir(normRoot, item.relDir === '' ? '.' : item.relDir);
    if (!dirRes.ok) continue;

    const hasPackageJson = dirRes.value.some(
      (e) => e.kind === 'file' && e.name.toLowerCase() === 'package.json',
    );
    const hasCsproj = dirRes.value.some((e) => e.kind === 'file' && e.name.endsWith('.csproj'));

    if (item.depth > 0 && (hasPackageJson || hasCsproj)) {
      const candidate = hasCsproj
        ? await evaluateDotnetCandidate(fs, normRoot, item.relDir, stacks)
        : await evaluateCandidate(fs, normRoot, item.relDir, stacks);
      if (candidate !== undefined) {
        candidates.push(candidate);
      }
      // Do not traverse into child directories of an app candidate
      continue;
    }

    if (item.depth < 3) {
      for (const entry of dirRes.value) {
        if (
          entry.kind === 'directory' &&
          !entry.name.startsWith('.') &&
          !IGNORED_DIR_NAMES.has(entry.name)
        ) {
          const childRel = item.relDir === '' ? entry.name : `${item.relDir}/${entry.name}`;
          queue.push({ relDir: childRel, depth: item.depth + 1 });
        }
      }
    }
  }

  candidates.sort((a, b) => {
    if (a.supported !== b.supported) return a.supported ? -1 : 1;
    return a.path.localeCompare(b.path);
  });

  return candidates.slice(0, MAX_CANDIDATES);
}
