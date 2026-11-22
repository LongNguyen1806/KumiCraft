// The CSS file that loads Tailwind in a project (R-PJ-04): read-only, shared by every runtime.
import type { RelPath } from '@kumicraft/shared';
import { inSourceDir } from '@kumicraft/shared';

import type { FileSystemPort } from '../ports/file-system-port.ts';

const PRIMARY_CSS_CANDIDATES = [
  'src/index.css',
  'src/main.css',
  'src/App.css',
  'src/styles.css',
] as const;

function hasTailwindImport(cssContent: string): boolean {
  return /@import\s+['"]tailwindcss['"]|@tailwind\s+(?:base|components|utilities)/.test(cssContent);
}

export async function detectTailwindCss(
  fs: FileSystemPort,
  root: string,
  sourceDir = 'src',
  candidates: readonly string[] = PRIMARY_CSS_CANDIDATES,
): Promise<RelPath | undefined> {
  for (const candidate of candidates) {
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
      .map((entry) => inSourceDir(sourceDir, entry.name))
      .sort()
      .slice(0, 200);

    for (const file of cssFiles) {
      if (candidates.includes(file)) {
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
