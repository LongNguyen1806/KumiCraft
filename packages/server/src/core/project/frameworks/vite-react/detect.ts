// Detection logic for vite-react framework adapter (SPEC-04 R-PJ-03 to R-PJ-06, Round S1).
import type { PackageManager, RelPath, SupportReport, UnsupportedReason } from '@kumicraft/shared';

import type { FileSystemPort } from '../../../ports/file-system-port.ts';
import { findPackage, findPackageWorkspaceRoot } from '../../workspace-root.ts';
import type { DetectInput } from '../types.ts';
import { detectStyling } from './styling.ts';

const VITE_CONFIG_CANDIDATES = [
  'vite.config.ts',
  'vite.config.mts',
  'vite.config.cts',
  'vite.config.js',
  'vite.config.mjs',
  'vite.config.cjs',
] as const;

const PRIMARY_CSS_CANDIDATES = [
  'src/index.css',
  'src/main.css',
  'src/App.css',
  'src/styles.css',
] as const;

type PackageJsonLike = {
  readonly dependencies?: Readonly<Record<string, string>>;
  readonly devDependencies?: Readonly<Record<string, string>>;
  readonly packageManager?: string;
};

export function parseMajorVersion(raw: string): number | undefined {
  const cleaned = raw.replace(/^[~^>=<v\s]+/, '').trim();
  const match = cleaned.match(/^(\d+)/);
  if (!match) return undefined;
  const first = match[1];
  if (!first) return undefined;
  const num = Number.parseInt(first, 10);
  return Number.isNaN(num) ? undefined : num;
}

export async function resolvePackageVersion(
  fs: FileSystemPort,
  root: string,
  pkgName: string,
  declaredVersion?: string,
): Promise<{ readonly version?: string | undefined; readonly major?: number | undefined }> {
  const pkgDir = await findPackage(fs, root, pkgName);
  if (pkgDir !== undefined) {
    const installedText = await fs.readText(pkgDir, 'package.json');
    if (installedText.ok) {
      try {
        const parsed = JSON.parse(installedText.value) as { version?: unknown };
        if (typeof parsed.version === 'string') {
          return {
            version: parsed.version,
            major: parseMajorVersion(parsed.version),
          };
        }
      } catch {
        // ignore parse error, fall back to declared
      }
    }
  }

  if (declaredVersion !== undefined) {
    return {
      version: declaredVersion,
      major: parseMajorVersion(declaredVersion),
    };
  }

  return {};
}

function hasTailwindImport(cssContent: string): boolean {
  return /@import\s+['"]tailwindcss['"]|@tailwind\s+(?:base|components|utilities)/.test(cssContent);
}

async function detectTailwindCss(
  fs: FileSystemPort,
  root: string,
  sourceDir: string = 'src',
): Promise<RelPath | undefined> {
  for (const candidate of PRIMARY_CSS_CANDIDATES) {
    if (await fs.exists(root, candidate)) {
      const read = await fs.readText(root, candidate, { maxBytes: 1024 * 1024 });
      if (read.ok && hasTailwindImport(read.value)) {
        return candidate;
      }
    }
  }

  // Scan other CSS files in sourceDir (max 200 files)
  const dirResult = await fs.readDir(root, sourceDir);
  if (dirResult.ok) {
    const cssFiles = dirResult.value
      .filter((entry) => entry.kind === 'file' && entry.name.endsWith('.css'))
      .map((entry) => `${sourceDir}/${entry.name}`)
      .sort()
      .slice(0, 200);

    for (const file of cssFiles) {
      if (PRIMARY_CSS_CANDIDATES.includes(file as (typeof PRIMARY_CSS_CANDIDATES)[number])) {
        continue;
      }
      const read = await fs.readText(root, file, { maxBytes: 1024 * 1024 });
      if (read.ok && hasTailwindImport(read.value)) {
        return file;
      }
    }
  }

  return undefined;
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
  pkgJson?: PackageJsonLike,
): Promise<PackageManager | undefined> {
  const fromField = detectPackageManagerFromField(pkgJson?.packageManager);
  if (fromField !== undefined) return fromField;

  if (await fs.exists(root, 'pnpm-lock.yaml')) return 'pnpm';
  if (await fs.exists(root, 'yarn.lock')) return 'yarn';
  if (await fs.exists(root, 'package-lock.json')) return 'npm';

  return undefined;
}

function checkDependencyReasons(
  allDeps: Record<string, string>,
  viteInfo: { readonly major?: number | undefined },
  reactInfo: { readonly major?: number | undefined },
): UnsupportedReason[] {
  const reasons: UnsupportedReason[] = [];

  if (allDeps['react-scripts'] !== undefined) {
    reasons.push('craUnsupported');
  }
  if (allDeps['next'] !== undefined) {
    reasons.push('nextUnsupported');
  }
  if (allDeps['webpack'] !== undefined && allDeps['vite'] === undefined) {
    reasons.push('webpackUnsupported');
  }

  if (allDeps['vite'] === undefined) {
    reasons.push('noVite');
  } else if (viteInfo.major !== 7 && viteInfo.major !== 8) {
    reasons.push('viteVersion');
  }

  if (allDeps['react'] === undefined) {
    reasons.push('noReact');
  } else if (reactInfo.major !== 18 && reactInfo.major !== 19) {
    reasons.push('reactVersion');
  }
  return reasons;
}

async function findViteConfig(fs: FileSystemPort, root: string): Promise<RelPath | undefined> {
  for (const candidate of VITE_CONFIG_CANDIDATES) {
    if (await fs.exists(root, candidate)) {
      return candidate;
    }
  }
  return undefined;
}

export async function detectViteReact(input: DetectInput): Promise<SupportReport> {
  const pkg = (input.packageJson ?? {}) as PackageJsonLike;
  const allDeps: Record<string, string> = {
    ...(pkg.dependencies ?? {}),
    ...(pkg.devDependencies ?? {}),
  };

  const [viteInfo, reactInfo, tailwindInfo] = await Promise.all([
    resolvePackageVersion(input.fs, input.root, 'vite', allDeps['vite']),
    resolvePackageVersion(input.fs, input.root, 'react', allDeps['react']),
    resolvePackageVersion(input.fs, input.root, 'tailwindcss', allDeps['tailwindcss']),
  ]);

  const reasons = checkDependencyReasons(allDeps, viteInfo, reactInfo);
  const viteConfig = await findViteConfig(input.fs, input.root);
  if (viteConfig === undefined) {
    reasons.push('noViteConfig');
  }

  const tailwindCss = await detectTailwindCss(input.fs, input.root, 'src');
  const styling = await detectStyling({
    fs: input.fs,
    root: input.root,
    sourceDir: 'src',
    allDeps,
    tailwindCss,
    tailwindVersion: tailwindInfo.version,
  });

  const isTs = await input.fs.exists(input.root, 'tsconfig.json');
  const language = isTs ? 'ts' : 'js';
  const packageManager = await detectPackageManager(input.fs, input.root, pkg);
  const workspaceRoot = await findPackageWorkspaceRoot(input.fs, input.root);
  const supported = reasons.length === 0;

  return {
    supported,
    reasons,
    framework: supported ? 'vite-react' : undefined,
    ...(workspaceRoot !== undefined ? { workspaceRoot } : {}),
    versions: {
      vite: viteInfo.version,
      react: reactInfo.version,
      tailwindcss: tailwindInfo.version,
    },
    language,
    packageManager,
    viteConfig,
    tailwindCss,
    styling,
  };
}
