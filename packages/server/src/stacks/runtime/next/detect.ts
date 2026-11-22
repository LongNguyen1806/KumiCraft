// Detection of a Next.js + React project (03b section 1.3): `next` in the dependencies and an
// `app/` or `pages/` folder, at the root or under `src/`. No version is refused (03b section 0).
import {
  inSourceDir,
  ROOT_SOURCE_DIR,
  type SupportReport,
  type UnsupportedReason,
} from '@kumicraft/shared';

import type { DetectInput } from '../../../kernel/stacks.ts';
import { detectPackageManager } from '../../../lib/package-manager.ts';
import { resolvePackageVersion } from '../../../lib/package-version.ts';
import { detectTailwindCss } from '../../../lib/tailwind-css.ts';
import { detectUiKit } from '../../../lib/ui-kit.ts';
import { findPackageWorkspaceRoot } from '../../../lib/workspace-root.ts';
import type { FileSystemPort } from '../../../ports/file-system-port.ts';
import { detectStyling } from '../../style/detect-styling.ts';

type PackageJsonLike = {
  readonly dependencies?: Readonly<Record<string, string>>;
  readonly devDependencies?: Readonly<Record<string, string>>;
  readonly packageManager?: string;
};

/** `src` when the pages are under it, else the project root. */
async function nextSourceDir(fs: FileSystemPort, root: string): Promise<string> {
  const underSrc = (await fs.exists(root, 'src/app')) || (await fs.exists(root, 'src/pages'));
  return underSrc ? 'src' : ROOT_SOURCE_DIR;
}

/** Where create-next-app puts the CSS that loads Tailwind. */
const cssCandidates = (sourceDir: string): string[] => [
  inSourceDir(sourceDir, 'app/globals.css'),
  inSourceDir(sourceDir, 'styles/globals.css'),
  'styles/globals.css',
];

function readPackageJson(value: unknown): PackageJsonLike {
  return value instanceof Object ? value : {};
}

/** Why this is not a Next.js project: no `next`, no `react`, or no folder of pages. */
async function nextReasons(
  input: DetectInput,
  allDeps: Readonly<Record<string, string>>,
  sourceDir: string,
): Promise<UnsupportedReason[]> {
  const reasons: UnsupportedReason[] = [];
  if (allDeps['next'] === undefined) reasons.push('noNext');
  if (allDeps['react'] === undefined) reasons.push('noReact');
  const hasPages =
    (await input.fs.exists(input.root, inSourceDir(sourceDir, 'app'))) ||
    (await input.fs.exists(input.root, inSourceDir(sourceDir, 'pages')));
  if (!hasPages) reasons.push('noNextPages');
  return reasons;
}

/** The Tailwind entry and the styling systems of the project. */
async function nextStyling(
  input: DetectInput,
  allDeps: Readonly<Record<string, string>>,
  sourceDir: string,
  tailwindVersion: string | undefined,
) {
  const candidates = cssCandidates(sourceDir);
  const cssDir = inSourceDir(sourceDir, 'app');
  const tailwindCss = await detectTailwindCss(input.fs, input.root, cssDir, candidates);
  const styling = await detectStyling({
    fs: input.fs,
    root: input.root,
    sourceDir,
    allDeps: { ...allDeps },
    tailwindCss,
    tailwindVersion,
  });
  return { tailwindCss, styling };
}

export async function detectNextReact(input: DetectInput): Promise<SupportReport> {
  const pkg = readPackageJson(input.packageJson);
  const allDeps: Record<string, string> = { ...pkg.dependencies, ...pkg.devDependencies };
  const sourceDir = await nextSourceDir(input.fs, input.root);
  const reasons = await nextReasons(input, allDeps, sourceDir);
  const [nextInfo, reactInfo, tailwindInfo] = await Promise.all([
    resolvePackageVersion(input.fs, input.root, 'next', allDeps['next']),
    resolvePackageVersion(input.fs, input.root, 'react', allDeps['react']),
    resolvePackageVersion(input.fs, input.root, 'tailwindcss', allDeps['tailwindcss']),
  ]);
  const { tailwindCss, styling } = await nextStyling(
    input,
    allDeps,
    sourceDir,
    tailwindInfo.version,
  );
  const workspaceRoot = await findPackageWorkspaceRoot(input.fs, input.root);
  const uiKit = await detectUiKit(input.fs, input.root);
  const supported = reasons.length === 0;

  return {
    supported,
    reasons,
    framework: supported ? 'next-react' : undefined,
    ...(workspaceRoot === undefined ? {} : { workspaceRoot }),
    versions: {
      next: nextInfo.version,
      react: reactInfo.version,
      tailwindcss: tailwindInfo.version,
    },
    language: (await input.fs.exists(input.root, 'tsconfig.json')) ? 'ts' : 'js',
    packageManager: await detectPackageManager(input.fs, input.root, pkg),
    tailwindCss,
    styling,
    sourceDir,
    ...(uiKit === undefined ? {} : { uiKit }),
  };
}
