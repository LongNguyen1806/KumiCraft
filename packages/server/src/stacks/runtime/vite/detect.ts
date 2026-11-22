// Detection logic for vite-react framework adapter (SPEC-04 R-PJ-03 to R-PJ-06, Round S1).
import type { RelPath, SupportReport, UnsupportedReason } from '@kumicraft/shared';

import type { DetectInput } from '../../../kernel/stacks.ts';
import { detectPackageManager } from '../../../lib/package-manager.ts';
import { parseMajorVersion, resolvePackageVersion } from '../../../lib/package-version.ts';
import { detectTailwindCss } from '../../../lib/tailwind-css.ts';
import { detectUiKit } from '../../../lib/ui-kit.ts';
import { findPackageWorkspaceRoot } from '../../../lib/workspace-root.ts';
import type { FileSystemPort } from '../../../ports/file-system-port.ts';
import { detectStyling } from '../../style/detect-styling.ts';

export { parseMajorVersion, resolvePackageVersion };

const VITE_CONFIG_CANDIDATES = [
  'vite.config.ts',
  'vite.config.mts',
  'vite.config.cts',
  'vite.config.js',
  'vite.config.mjs',
  'vite.config.cjs',
] as const;

type PackageJsonLike = {
  readonly dependencies?: Readonly<Record<string, string>>;
  readonly devDependencies?: Readonly<Record<string, string>>;
  readonly packageManager?: string;
};

/** Why this is not a Vite + React project. No version is refused (03b section 0). */
function checkDependencyReasons(allDeps: Record<string, string>): UnsupportedReason[] {
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
  }

  if (allDeps['react'] === undefined) {
    reasons.push('noReact');
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

  const reasons = checkDependencyReasons(allDeps);
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
  const uiKit = await detectUiKit(input.fs, input.root);
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
    ...(uiKit !== undefined ? { uiKit } : {}),
  };
}
