import { readdirSync, readFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const repoRoot = fileURLToPath(new URL('../../../', import.meta.url));

const PACKAGES = [
  join(repoRoot, 'packages/server/src'),
  join(repoRoot, 'packages/studio/src'),
  join(repoRoot, 'packages/bridge/src'),
  join(repoRoot, 'packages/shared/src'),
];

const ALLOWED = [
  // The stacks are the framework folders of the target architecture (docs/architecture/03).
  'server/src/stacks/',
  'server/src/services/project/frameworks/',
  'server/src/runners/',
  'bridge/src/integrations/',
  'shared/src/workspace-file.ts',
  'shared/src/project.ts',
  'server/src/services/project/project-workspace-file.ts',
  'server/src/index.ts',
  // The composition root's configuration (moved out of index.ts): the default runner name.
  'server/src/server-config.ts',
];

function isAllowed(relPath: string): boolean {
  const normalized = relPath.replaceAll('\\', '/');
  return ALLOWED.some((allowed) => normalized.includes(allowed));
}

function collectTsFiles(dir: string): string[] {
  const entries = readdirSync(dir, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...collectTsFiles(fullPath));
    } else if (
      entry.isFile() &&
      entry.name.endsWith('.ts') &&
      !entry.name.includes('.test.') &&
      !entry.name.includes('test-') &&
      !entry.name.endsWith('.generated.ts')
    ) {
      files.push(fullPath);
    }
  }
  return files;
}

describe('server architecture [R-FW-03]', () => {
  it('branches on the framework only inside framework folders [R-FW-03]', () => {
    const violations: string[] = [];

    for (const pkgDir of PACKAGES) {
      const files = collectTsFiles(pkgDir);
      for (const file of files) {
        const content = readFileSync(file, 'utf8');
        if (content.includes('vite-react')) {
          const rel = relative(repoRoot, file).replaceAll('\\', '/');
          if (!isAllowed(rel)) {
            violations.push(rel);
          }
        }
      }
    }

    expect(
      violations,
      `Files referencing 'vite-react' outside allowed framework folders: ${violations.join(', ')}`,
    ).toEqual([]);
  });
});

/**
 * docs/architecture/03 section 4 (ADR-A2): an edit writes the user's files only through the
 * kernel's FileWriter (checks, all-or-none, Undo); KumiCraft's own `.kumicraft/` files go through
 * `writeOwnFile`. Here no stack and no project service calls the file port's write functions.
 */
const WRITE_CALL = /\bfs\.(writeTextAtomic|writeBytesAtomic|createExclusive|remove|rename|copy)\(/;
const WRITE_ALLOWED: Readonly<Record<string, string>> = {
  // A new project is copied from the template into an empty folder: nothing to check or undo.
  'packages/server/src/services/project/create.ts': 'scaffold',
  // Moves KumiCraft's own old `.reactcraft` folder to `.kumicraft` once.
  'packages/server/src/services/project/legacy-workspace.ts': 'own folder',
};

describe('file writes [ADR-A2]', () => {
  it('only the kernel writes project files for an edit', () => {
    const scanned = [
      join(repoRoot, 'packages/server/src/stacks'),
      join(repoRoot, 'packages/server/src/services/project'),
    ].flatMap((dir) => collectTsFiles(dir));
    const violations = scanned
      .map((file) => ({ file, rel: relative(repoRoot, file).split(sep).join('/') }))
      .filter(({ rel }) => !rel.endsWith('.bench.ts') && WRITE_ALLOWED[rel] === undefined)
      .filter(({ file }) => WRITE_CALL.test(readFileSync(file, 'utf8')))
      .map(({ rel }) => rel);
    expect(violations, `Write outside the FileWriter: ${violations.join(', ')}`).toEqual([]);
  });
});
