// Test A4: Dynamic adapter switching per project (SPEC-04 R-FW-01, WP-4.00).
import { cp } from 'node:fs/promises';
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
  writeSupportedProject,
} from '../workspace/test-support.ts';

const REPO_ROOT = fileURLToPath(new URL('../../../../../', import.meta.url));
const EXPRESS_FIXTURE = join(REPO_ROOT, 'fixtures/projects/express-pug');

const config: Pick<ConfigStore, 'isTrusted' | 'setTrusted' | 'settings'> = {
  isTrusted: () => true,
  setTrusted: () => Promise.resolve(ok(undefined)),
  settings: () => ({ editor: 'vscode', agent: { preferred: 'auto' } }),
};

describe('Adapter Switch [WP-4.00]', () => {
  it('[WP-4.00] A4: Mở dự án Express rồi mở dự án Vite trong cùng server → runner và source editor dùng đúng adapter của dự án đang mở (không giữ bản cũ)', async () => {
    const { dir: tempDir, cleanup } = await makeTempDir();
    try {
      const expressDir = join(tempDir, 'express-project');
      const viteDir = join(tempDir, 'vite-project');
      await cp(EXPRESS_FIXTURE, expressDir, { recursive: true });
      await writeSupportedProject(viteDir);

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
          port: 5432,
          platform,
          templateDir: viteDir,
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

      // 1. Open Express project
      const openExpress = await services.projectService.open(expressDir);
      expect(openExpress.ok).toBe(true);

      const expressStack = services.projectService.getStack();
      expect(expressStack.id).toBe('express-pug');
      expect(expressStack.view.capability).toEqual({ edit: false, reason: 'viewOnly' });

      // Pages uses Express route finder
      const expressPages = await services.projectService.pages();
      expect(expressPages.ok).toBe(true);
      if (expressPages.ok) {
        expect(expressPages.value.pages.some((p) => p.path === '/products/:id')).toBe(true);
      }

      // Source editor rejects edit because editMode is viewOnly
      const editRes = await services.sourceEditorService.applyEdit(expressDir, {
        kind: 'setText',
        loc: 'views/index.pug:5:3',
        tag: 'h1',
        before: 'Old',
        after: 'New',
      });
      expect(editRes.ok).toBe(false);
      if (!editRes.ok) {
        expect(editRes.error.code).toBe('E023');
        expect(editRes.error.params?.['reason']).toBe('viewOnly');
      }

      // 2. Open Vite project in the same server
      const openVite = await services.projectService.open(viteDir);
      expect(openVite.ok).toBe(true);

      const viteStack = services.projectService.getStack();
      expect(viteStack.id).toBe('vite-react');
      expect(viteStack.view.capability).toEqual({ edit: true });

      // Pages uses Vite/React pages finder
      const vitePages = await services.projectService.pages();
      expect(vitePages.ok).toBe(true);

      // Source editor is no longer blocked by viewOnly
      const viteEditRes = await services.sourceEditorService.applyEdit(viteDir, {
        kind: 'setText',
        loc: 'src/App.tsx:1:1',
        tag: 'div',
        before: 'Old',
        after: 'New',
      });
      // It fails because file/loc doesn't exist, NOT because of viewOnly!
      if (!viteEditRes.ok) {
        expect(viteEditRes.error.params?.['reason']).not.toBe('viewOnly');
      }
    } finally {
      await cleanup();
    }
  });
});
