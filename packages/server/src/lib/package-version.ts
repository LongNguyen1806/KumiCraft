// Versions of the packages a project uses: the installed one first, else the one package.json asks
// for (SPEC-04 R-PJ-03). Shared by every stack's detection.
import type { FileSystemPort } from '../ports/file-system-port.ts';
import { findPackage } from './workspace-root.ts';

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
