// The package manager of a project (R-PJ-05): the packageManager field, then the lockfile.
import type { PackageManager } from '@kumicraft/shared';

import type { FileSystemPort } from '../ports/file-system-port.ts';

function detectPackageManagerFromField(field?: string): PackageManager | undefined {
  if (!field) return undefined;
  if (field.startsWith('pnpm')) return 'pnpm';
  if (field.startsWith('yarn')) return 'yarn';
  if (field.startsWith('npm')) return 'npm';
  return undefined;
}

export async function detectPackageManager(
  fs: FileSystemPort,
  root: string,
  pkgJson?: { readonly packageManager?: string | undefined },
): Promise<PackageManager | undefined> {
  const fromField = detectPackageManagerFromField(pkgJson?.packageManager);
  if (fromField !== undefined) return fromField;

  if (await fs.exists(root, 'pnpm-lock.yaml')) return 'pnpm';
  if (await fs.exists(root, 'yarn.lock')) return 'yarn';
  if (await fs.exists(root, 'package-lock.json')) return 'npm';

  return undefined;
}

/**
 * Vite majors the Canvas runs: the Bridge plugin uses only hooks Vite has had since 5 (transform with
 * `order`, configureServer, resolveId, load, transformIndexHtml). Each one has a sample project
 * in fixtures/projects and an E2E run (round 1 of 04-lo-trinh.md).
 */
export const VITE_MAJORS: readonly number[] = [5, 6, 7, 8];
