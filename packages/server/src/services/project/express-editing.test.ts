// Test A5: an Express + Pug project is edited through the server services (03d): the Pug editor
// and the Express pages are the ones the open project uses. (It was view only until round 6.)
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

describe('Express + Pug through the services [WP-4.00, 03d]', () => {
  it('[WP-4.00] A5: class edit, block insert, page add and delete reach the Pug editor and Express pages', async () => {
    const { dir: tempDir, cleanup } = await makeTempDir();
    try {
      const expressDir = join(tempDir, 'express-project');
      await cp(EXPRESS_FIXTURE, expressDir, { recursive: true });

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
      if (openRes.ok) {
        expect(openRes.value.capabilities).toEqual({
          drafts: true,
          components: true,
          extractComponent: true,
          componentProps: false,
          interactions: false,
          reveal: false,
          routerInstall: false,
        });
      }

      const draftsRes = await services.projectService.listDrafts();
      expect(draftsRes).toEqual(ok({ drafts: [], dir: 'views/_drafts', ignored: false }));

      const index = join(expressDir, 'views/index.pug');

      // 1. A class edit goes to the Pug editor (not the JSX one) and keeps shorthand classes.
      const batchRes = await services.sourceEditorService.applyEditBatch(expressDir, [
        { kind: 'setClassName', loc: 'views/index.pug:5:3', tag: 'h1', after: 'hero-title big' },
      ]);
      expect(batchRes.ok).toBe(true);
      expect(await readFile(index, 'utf8')).toContain('  h1.hero-title.big Sản phẩm hôm nay');

      // 2. A library block is inserted as Pug lines.
      const structRes = await services.sourceEditorService.applyStructureEdit(expressDir, {
        kind: 'insert',
        target: { kind: 'sibling', ref: { loc: 'views/index.pug:5:3', tag: 'h1' }, where: 'after' },
        jsx: '<p>Inserted</p>',
      });
      expect(structRes.ok).toBe(true);
      expect(await readFile(index, 'utf8')).toContain(
        '  h1.hero-title.big Sản phẩm hôm nay\n  p Inserted\n',
      );

      // 3. Pages: a route and a view are added, and an existing one removed with its view.
      const addRes = await services.projectService.addPage({ name: 'Contact', path: '/contact' });
      expect(addRes.ok).toBe(true);
      expect(await readFile(join(expressDir, 'app.js'), 'utf8')).toContain("app.get('/contact'");
      const deleteRes = await services.projectService.deletePage({ path: '/about' });
      expect(deleteRes.ok).toBe(true);
      expect(await readFile(join(expressDir, 'app.js'), 'utf8')).not.toContain("'/about'");

      // 4. Component extraction creates a Pug partial and replaces the element with include.
      const extractRes = await services.projectService.extractComponent({
        loc: 'views/index.pug:6:3',
        tag: 'p',
        name: 'PromoNote',
        dir: 'views/components',
        fileName: 'promo-note.pug',
      });
      expect(extractRes.ok).toBe(true);
      expect(await readFile(join(expressDir, 'views/components/promo-note.pug'), 'utf8')).toBe(
        'p Inserted\n',
      );
      expect(await readFile(index, 'utf8')).toContain('  include ./components/promo-note\n');

      // 5. Drafts: create -> list -> promote to page wraps with extends layout + route (with Undo).
      const draftRes = await services.projectService.createDraft({
        name: 'LandingDraft',
        free: false,
      });
      expect(draftRes.ok && draftRes.value.draftFile).toBe('views/_drafts/landing-draft.pug');
      const promoteRes = await services.projectService.promoteDraft({
        file: 'views/_drafts/landing-draft.pug',
        as: 'page',
        name: 'Landing',
        path: '/landing',
        keepDraft: false,
      });
      expect(promoteRes.ok && promoteRes.value.pagePath).toBe('/landing');
      expect(await readFile(join(expressDir, 'app.js'), 'utf8')).toContain("app.get('/landing'");
      expect(await readFile(join(expressDir, 'views/landing.pug'), 'utf8')).toContain(
        "extends layout\n\nblock content\n  div(style='min-height: 100vh; background: #fff; padding: 32px')",
      );
    } finally {
      await cleanup();
    }
  });
});
