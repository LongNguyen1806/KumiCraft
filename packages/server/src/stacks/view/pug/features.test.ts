import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { createHistoryService } from '../../../kernel/history/history-service.ts';
import { nodeFs, platform } from '../../../services/workspace/test-support.ts';
import { pugFeatures } from './features.ts';
import { loadPugFile } from './pug-file.ts';
import { planPugStructure } from './structure-ops.ts';

describe('pugFeatures', () => {
  let root: string;

  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), 'rc-pug-features-'));
    await mkdir(join(root, 'views/products'), { recursive: true });
    await mkdir(join(root, 'views/components'), { recursive: true });
    await writeFile(
      join(root, 'views/layout.pug'),
      'doctype html\nhtml\n  body\n    block content\n',
    );
    await writeFile(
      join(root, 'views/components/product-card.pug'),
      'article.product-card\n  h2 Card\n',
    );
    await writeFile(
      join(root, 'views/products/index.pug'),
      [
        'extends ../layout',
        '',
        'block content',
        '  section.page-header',
        '    h1 Danh sách sản phẩm',
        '    p.subtitle Mô tả ngắn',
        '  include ../components/product-card',
        '',
      ].join('\n'),
    );
    await writeFile(
      join(root, 'app.js'),
      "app.get('/products', (req, res) => res.render('products/index'));\n",
    );
  });

  afterEach(async () => {
    await rm(root, { recursive: true, force: true });
  });

  it('lists Pug partial components and layouts with include/extends usage counts', async () => {
    const components = await pugFeatures.listComponents({ fs: nodeFs }, root, {
      id: 'proj000001',
      name: 'ExpressPug',
      root,
      sourceDir: 'src',
      support: {
        supported: true,
        reasons: [],
        framework: 'express-pug',
        viewsDir: 'views',
        versions: {},
        language: 'js',
      },
      needsInstall: false,
      responsiveMode: 'desktop-first',
      frames: [{ id: 'desktop', label: 'Desktop', width: 1440, height: 900 }],
      primaryFrameId: 'desktop',
      backends: [],
      trusted: true,
      designDirs: {
        pages: ['src/pages'],
        layouts: ['src/layouts'],
        components: ['src/components'],
        drafts: 'src/drafts',
      },
    });

    expect(components).toEqual([
      {
        name: 'Layout',
        file: 'views/layout.pug',
        kind: 'layout',
        usages: 1,
        importStatement: '',
        insertJsx: 'include views/layout',
      },
      {
        name: 'ProductCard',
        file: 'views/components/product-card.pug',
        kind: 'component',
        usages: 1,
        importStatement: '',
        insertJsx: 'include views/components/product-card',
      },
    ]);
  });

  it('extracts a Pug element block into a partial and replaces it with include (with Undo)', async () => {
    const history = createHistoryService({ fs: nodeFs });
    const res = await pugFeatures.project.extractComponent(
      {
        fs: nodeFs,
        history,
        projectRoot: root,
        sourceDir: 'src',
        platform,
        language: 'js',
        designDirs: {
          pages: ['src/pages'],
          layouts: ['src/layouts'],
          components: ['src/components'],
          drafts: 'src/drafts',
        },
      },
      {
        loc: 'views/products/index.pug:4:3',
        tag: 'section',
        name: 'PageHeader',
        dir: 'views/components',
        fileName: 'page-header.pug',
      },
    );

    expect(res).toEqual({
      ok: true,
      value: {
        changed: true,
        files: ['views/products/index.pug', 'views/components/page-header.pug'],
        locs: [],
      },
    });
    expect(await readFile(join(root, 'views/components/page-header.pug'), 'utf8')).toBe(
      'section.page-header\n  h1 Danh sách sản phẩm\n  p.subtitle Mô tả ngắn\n',
    );
    expect(await readFile(join(root, 'views/products/index.pug'), 'utf8')).toContain(
      '  include ../components/page-header\n',
    );

    const undone = await history.undo(root);
    expect(undone.ok).toBe(true);
    expect(await readFile(join(root, 'views/products/index.pug'), 'utf8')).toContain(
      '  section.page-header\n',
    );
  });

  it('finds .pug include/extends and .js res.render importers', async () => {
    const compImporters = await pugFeatures.findFileImporters(
      nodeFs,
      root,
      'src',
      'views/components/product-card.pug',
    );
    expect(compImporters).toEqual({
      ok: true,
      value: { importers: ['views/products/index.pug'], truncated: false },
    });

    const pageImporters = await pugFeatures.findFileImporters(
      nodeFs,
      root,
      'src',
      'views/products/index.pug',
    );
    expect(pageImporters).toEqual({
      ok: true,
      value: { importers: ['app.js'], truncated: false },
    });
  });

  it('inserts a Pug component include line via planPugStructure', async () => {
    const loaded = await loadPugFile(nodeFs, root, 'views/products/index.pug');
    expect(loaded.ok).toBe(true);
    if (!loaded.ok) return;
    const h1 = loaded.value.doc.elements.find((e) => e.tag === 'h1');
    expect(h1).toBeDefined();
    if (h1 === undefined) return;

    const plan = planPugStructure(
      {
        doc: loaded.value.doc,
        newline: loaded.value.newline,
        styling: undefined,
        elements: [h1],
        ref: h1,
        imageSrc: '',
      },
      {
        kind: 'insert',
        target: {
          kind: 'sibling',
          ref: { loc: 'views/products/index.pug:5:5', tag: 'h1' },
          where: 'after',
        },
        jsx: 'include views/components/product-card',
        from: { file: 'views/components/product-card.pug', imports: [''] },
      },
    );

    expect(plan.ok).toBe(true);
    if (!plan.ok) return;
    expect(plan.value.changes[0]?.text).toBe('    include ../components/product-card\n');
  });

  it('checks dark mode and applies smooth scroll on Express + Pug globalCss', async () => {
    await mkdir(join(root, 'public/stylesheets'), { recursive: true });
    await writeFile(
      join(root, 'public/stylesheets/style.css'),
      'body { color: #111; }\n.dark body { color: #eee; }\n',
    );
    const styling = {
      systems: [{ id: 'css' as const }],
      editable: false,
      globalCss: ['public/stylesheets/style.css'],
    };

    const dm = await pugFeatures.enableDarkMode({ fs: nodeFs, styling }, root, true);
    expect(dm).toEqual({
      ok: true,
      value: { enabled: true, changed: false, files: [], cssFile: 'public/stylesheets/style.css' },
    });

    const refused = await pugFeatures.enableDarkMode({ fs: nodeFs, styling }, root, false);
    expect(!refused.ok && refused.error.params?.['reason']).toBe('projectWideViaAi');

    const smooth = await pugFeatures.applySmoothScroll({ fs: nodeFs, styling }, root, {
      enabled: true,
    });
    expect(smooth).toEqual({
      ok: true,
      value: { changed: true, enabled: true, files: ['public/stylesheets/style.css'] },
    });
    expect(await readFile(join(root, 'public/stylesheets/style.css'), 'utf8')).toContain(
      'scroll-behavior: smooth',
    );
  });
});
