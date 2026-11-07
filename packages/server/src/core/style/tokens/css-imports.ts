// CSS files reached through `@import` from the main CSS files (K9.5): real projects keep their
// variables in a file the main one imports (MarketLink: index.css → common/global.css → tokens.css).
import { posix } from 'node:path';

import type { FileSystemPort } from '../../ports/file-system-port.ts';

const MAX_FILES = 50;
const READ = { maxBytes: 1024 * 1024 } as const;
const IMPORT_RE = /@import\s+(?:url\(\s*)?["']([^"']+)["']/g;

/** A project-relative `.css` path for `spec` imported from `from`; undefined for packages, URLs, `..`. */
export function resolveCssImport(from: string, spec: string): string | undefined {
  if (!spec.startsWith('./') && !spec.startsWith('../')) return undefined;
  if (!spec.endsWith('.css')) return undefined;
  const joined = posix.normalize(posix.join(posix.dirname(from), spec));
  return joined.startsWith('../') || posix.isAbsolute(joined) ? undefined : joined;
}

export function cssImportsOf(css: string, from: string): readonly string[] {
  // Comments can hold old imports; they do not count.
  const text = css.replace(/\/\*[\s\S]*?\*\//g, '');
  return [...text.matchAll(IMPORT_RE)].flatMap((m) => {
    const resolved = resolveCssImport(from, m[1] ?? '');
    return resolved === undefined ? [] : [resolved];
  });
}

/** `entries` then every CSS file they import, depth first, each once, at most 50. */
export async function cssFilesWithImports(
  fs: FileSystemPort,
  root: string,
  entries: readonly string[],
): Promise<readonly string[]> {
  const out: string[] = [];
  const seen = new Set<string>();
  const visit = async (file: string): Promise<void> => {
    if (seen.has(file) || out.length >= MAX_FILES) return;
    seen.add(file);
    out.push(file);
    const read = await fs.readText(root, file, READ);
    if (!read.ok) return;
    for (const next of cssImportsOf(read.value, file)) await visit(next);
  };
  for (const entry of entries) await visit(entry);
  return out;
}
