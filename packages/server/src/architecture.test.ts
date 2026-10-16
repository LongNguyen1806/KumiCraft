import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
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
  'server/src/core/project/frameworks/',
  'server/src/runners/',
  'bridge/src/integrations/',
  'shared/src/workspace-file.ts',
  'shared/src/project.ts',
  'server/src/core/project/project-workspace-file.ts',
  'server/src/index.ts',
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
