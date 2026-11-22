// Test A5: View-only mode guards on server operations (SPEC-04 R-FW-01, WP-4.00).
import { cp, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { ok } from '../../kernel/result.ts';
import { createServices } from '../../server-services.ts';
import { STACKS } from '../../stacks/index.ts';
import type { ConfigStore } from '../config/user-config.ts';
import {
  fakeSystem,
  makeTempDir,
  nodeFs,
  platform,
  silentLogger,
} from '../workspace/test-support.ts';

const REPO_ROOT = fileURLToPath(new URL('../../../../../', import.meta.url));
const EXPRESS_FIXTURE = join(REPO_ROOT, 'fixtures/projects/express-pug');

const config: Pick<ConfigStore, 'isTrusted' | 'setTrusted' | 'settings'> = {
  isTrusted: () => true,
  setTrusted: () => Promise.resolve(ok(undefined)),
  settings: () => ({ editor: 'vscode', agent: { preferred: 'auto' } }),
};

describe('View-Only Guards [WP-4.00]', () => {
  it('[WP-4.00] A5: Dự án viewOnly: edit batch, chèn, xóa trang, style apply → E023 viewOnly; file không đổi', async () => {
    const { dir: tempDir, cleanup } = await makeTempDir();
    try {
      const expressDir = join(tempDir, 'express-project');
      await cp(EXPRESS_FIXTURE, expressDir, { recursive: true });

      // Snapshot files before any mutation attempts
      const beforeIndex = await readFile(join(expressDir, 'views/index.pug'), 'utf8');
      const beforeAbout = await readFile(join(expressDir, 'views/about.pug'), 'utf8');
      const beforeApp = await readFile(join(expressDir, 'app.js'), 'utf8');

      const services = createServices(
        {
          stacks: STACKS,
          fs: nodeFs,
          system: fakeSystem(1, new Set([1])),
          process: {
            spawn: () => ({
              pid: 1,
              onLine: () => undefined,
              wait: () => Promise.resolve({ exitCode: 0, stdout: '', stderr: '', lines: [] }),
              kill: () => Promise.resolve(),
            }),
          },
          config,
          recents: { rememberProject: () => Promise.resolve(ok(undefined)) },
          logger: silentLogger,
          port: 5433,
          platform,
          templateDir: expressDir,
          cacheDir: join(tempDir, 'cache'),
          dataDir: join(tempDir, 'data'),
        },
        'http://localhost:5173',
        {
          spawn: () => ({
            pid: 1,
            onLine: () => undefined,
            wait: () => Promise.resolve({ exitCode: 0, stdout: '', stderr: '', lines: [] }),
            kill: () => Promise.resolve(),
          }),
        },
        undefined as never,
        nodeFs,
        {
          watch: () => ({ close: () => Promise.resolve() }),
        },
        'runners/vite-react',
      );

      const openRes = await services.projectService.open(expressDir);
      expect(openRes.ok).toBe(true);

      // 1. applyEditBatch fails with E023 viewOnly
      const batchRes = await services.sourceEditorService.applyEditBatch(expressDir, [
        {
          kind: 'setClassName',
          loc: 'views/index.pug:5:3',
          tag: 'h1',
          before: '',
          after: 'new-class',
        },
      ]);
      expect(batchRes.ok).toBe(false);
      if (!batchRes.ok) {
        expect(batchRes.error.code).toBe('E023');
        expect(batchRes.error.params?.['reason']).toBe('viewOnly');
      }

      // 2. applyStructureEdit (insert) fails with E023 viewOnly
      const structRes = await services.sourceEditorService.applyStructureEdit(expressDir, {
        kind: 'insert',
        target: { kind: 'sibling', ref: { loc: 'views/index.pug:5:3', tag: 'h1' }, where: 'after' },
        jsx: '<p>Inserted</p>',
      });
      expect(structRes.ok).toBe(false);
      if (!structRes.ok) {
        expect(structRes.error.code).toBe('E023');
        expect(structRes.error.params?.['reason']).toBe('viewOnly');
      }

      // 3. deletePage fails with E023 viewOnly
      const deleteRes = await services.projectService.deletePage({ path: '/about' });
      expect(deleteRes.ok).toBe(false);
      if (!deleteRes.ok) {
        expect(deleteRes.error.code).toBe('E023');
        expect(deleteRes.error.params?.['reason']).toBe('viewOnly');
      }

      // 4. addPage fails with E023 viewOnly
      const addRes = await services.projectService.addPage({ name: 'Contact', path: '/contact' });
      expect(addRes.ok).toBe(false);
      if (!addRes.ok) {
        expect(addRes.error.code).toBe('E023');
        expect(addRes.error.params?.['reason']).toBe('viewOnly');
      }

      // 5. editTheme (style apply) fails with E023 viewOnly
      const themeRes = await services.projectService.editTheme({
        op: 'set',
        kind: 'color',
        name: 'primary',
        value: '#123456',
      });
      expect(themeRes.ok).toBe(false);
      if (!themeRes.ok) {
        expect(themeRes.error.code).toBe('E023');
        expect(themeRes.error.params?.['reason']).toBe('viewOnly');
      }

      // 6. Verify files on disk remain strictly unchanged
      const afterIndex = await readFile(join(expressDir, 'views/index.pug'), 'utf8');
      const afterAbout = await readFile(join(expressDir, 'views/about.pug'), 'utf8');
      const afterApp = await readFile(join(expressDir, 'app.js'), 'utf8');

      expect(afterIndex).toBe(beforeIndex);
      expect(afterAbout).toBe(beforeAbout);
      expect(afterApp).toBe(beforeApp);
    } finally {
      await cleanup();
    }
  });
});
