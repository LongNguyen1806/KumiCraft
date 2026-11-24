// A stylesheet id or source-map path as a path of the project (SPEC-04 M-ST, R-ST-04).
import { isAbsolute, relative, resolve } from 'node:path';

import { type MatchedRule, relPathProblem } from '@kumicraft/shared';

/** A Vite module id (`D:/app/src/Card.css?used`) as a path of the project, or undefined outside it. */
export function projectFileOf(root: string, id: string): string | undefined {
  const path = id.split('?')[0] ?? id;
  if (!isAbsolute(path)) return undefined;
  const rel = relative(resolve(root), resolve(path)).replaceAll('\\', '/');
  if (relPathProblem(rel) !== undefined || rel.startsWith('node_modules/')) return undefined;
  return rel;
}

function linkPathname(href: string): string | undefined {
  try {
    const pathname = new URL(href, 'http://localhost').pathname;
    const trimmed = pathname.replace(/^\/+/, '');
    if (trimmed === '' || trimmed.includes('..')) return undefined;
    const lower = trimmed.toLowerCase();
    if (lower.includes('node_modules/') || lower.includes('bootstrap')) return undefined;
    return trimmed;
  } catch {
    return undefined;
  }
}

/**
 * Resolves a probed stylesheet (`module` id or `<link>` href) to a project-relative file path.
 * For `<link>` sheets (used by Express/Razor), matches unambiguously against `globalCss`.
 */
export function projectFileOfSheet(
  root: string,
  sheet: MatchedRule['sheet'],
  globalCss?: readonly string[],
): string | undefined {
  if (sheet.kind === 'module') return projectFileOf(root, sheet.id);
  if (sheet.kind !== 'link' || globalCss === undefined || globalCss.length === 0) return undefined;
  const rel = linkPathname(sheet.href);
  if (rel === undefined) return undefined;
  const relLower = rel.toLowerCase();
  const matches = globalCss.filter((candidate) => {
    const norm = candidate.replaceAll('\\', '/').toLowerCase();
    return norm === relLower || norm.endsWith(`/${relLower}`);
  });
  return matches.length === 1 ? matches[0] : undefined;
}
