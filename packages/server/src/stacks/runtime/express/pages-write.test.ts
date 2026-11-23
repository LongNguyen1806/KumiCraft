// Express pages are routes with views (03d section 2.2): adding a page writes a route and a view
// like the others, renaming changes both, removing takes both away; add then remove gives the
// server file back byte for byte.
import { existsSync } from 'node:fs';
import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import type { PageEditDeps } from '../../../kernel/features.ts';
import { createHistoryService } from '../../../kernel/history/history-service.ts';
import { directWriteFs } from '../../../services/workspace/test-support.ts';
import { expressPugPages } from './index.ts';

const FIXTURE = join(process.cwd(), 'fixtures/projects/express-pug');
let root: string;

beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), 'rc-express-pages-'));
  await cp(FIXTURE, root, { recursive: true, filter: (s) => !s.includes('node_modules') });
});

afterEach(async () => {
  await rm(root, { recursive: true, force: true });
});

const deps = (): PageEditDeps => ({
  fs: directWriteFs,
  history: createHistoryService({ fs: directWriteFs }),
  projectRoot: root,
  sourceDir: 'views',
  platform: process.platform === 'win32' ? 'win32' : 'linux',
  language: 'js',
  designDirs: { pages: ['views'], layouts: ['views'], components: ['views'], drafts: 'drafts' },
});

const read = () =>
  expressPugPages.read({
    fs: directWriteFs,
    root,
    sourceDir: 'views',
    support: {
      supported: true,
      reasons: [],
      versions: {},
      language: 'js',
      serverEntry: 'app.js',
      viewsDir: 'views',
    },
  });

describe('Express pages [03d 2.2]', () => {
  it('adds a route and a view extending the layout, renames both, removes both', async () => {
    const app = join(root, 'app.js');
    const original = await readFile(app, 'utf8');
    const added = await expressPugPages.add(deps(), { name: 'Liên hệ' });
    expect(added.ok && added.value.pagePath).toBe('/lien-he');
    expect(await readFile(app, 'utf8')).toContain(
      "app.get('/lien-he', (req, res) => {\n  res.render('lien-he', { title: 'Liên hệ' });\n});",
    );
    expect(await readFile(join(root, 'views/lien-he.pug'), 'utf8')).toBe(
      'extends layout\n\nblock content\n  h1 Liên hệ\n',
    );
    expect((await read()).pages.map((p) => p.path)).toContain('/lien-he');

    await expressPugPages.rename(deps(), { path: '/lien-he', newName: 'Hỏi đáp' });
    expect(await readFile(app, 'utf8')).toContain(
      "app.get('/hoi-dap', (req, res) => {\n  res.render('hoi-dap'",
    );
    expect(
      existsSync(join(root, 'views/hoi-dap.pug')) && !existsSync(join(root, 'views/lien-he.pug')),
    ).toBe(true);

    await expressPugPages.remove(deps(), { path: '/hoi-dap' });
    expect(await readFile(app, 'utf8')).toBe(original);
    expect(existsSync(join(root, 'views/hoi-dap.pug'))).toBe(false);
  });

  it('keeps the home page', async () => {
    const res = await expressPugPages.remove(deps(), { path: '/' });
    expect(!res.ok && res.error.params?.['reason']).toBe('indexPage');
  });

  it('adds a page into app.js (before 404 handler) instead of bin/www for express-generator apps', async () => {
    await mkdir(join(root, 'bin'), { recursive: true });
    const binWww = `var app = require('../app');\nvar http = require('http');\nhttp.createServer(app).listen(3000);\n`;
    await writeFile(join(root, 'bin/www'), binWww);
    const appCode = [
      "var express = require('express');",
      "var productsRouter = require('./routes/products');",
      'var app = express();',
      "app.use('/products', productsRouter);",
      'app.use(function(req, res, next) { next(); });',
      'module.exports = app;',
      '',
    ].join('\n');
    await writeFile(join(root, 'app.js'), appCode);
    await writeFile(
      join(root, 'package.json'),
      JSON.stringify({
        scripts: { start: 'node ./bin/www' },
        dependencies: { express: '^5.0.0', pug: '^3.0.0' },
      }),
    );

    const added = await expressPugPages.add(deps(), { name: 'Liên hệ' });
    expect(added.ok && added.value.pagePath).toBe('/lien-he');
    expect(await readFile(join(root, 'bin/www'), 'utf8')).toBe(binWww);

    const updatedApp = await readFile(join(root, 'app.js'), 'utf8');
    expect(updatedApp).toContain("app.get('/lien-he'");
    expect(updatedApp.indexOf("app.get('/lien-he'")).toBeLessThan(
      updatedApp.indexOf('app.use(function(req, res, next)'),
    );

    await expressPugPages.remove(deps(), { path: '/lien-he' });
    expect(await readFile(join(root, 'app.js'), 'utf8')).toBe(appCode);
  });
});
