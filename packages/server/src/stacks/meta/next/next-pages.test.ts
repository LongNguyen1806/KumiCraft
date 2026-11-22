// Next.js pages are files (03b section 1.4): read from app/ and pages/, added, renamed and removed
// as file changes, each one Undo step.
import { existsSync } from 'node:fs';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import type { PageEditDeps } from '../../../kernel/features.ts';
import { createHistoryService } from '../../../kernel/history/history-service.ts';
import { directWriteFs } from '../../../services/workspace/test-support.ts';
import { readNextPages } from './pages-read.ts';
import { addNextPage, deleteNextPage, renameNextPage } from './pages-write.ts';

let root: string;

async function put(files: Record<string, string>): Promise<void> {
  for (const [path, content] of Object.entries(files)) {
    await mkdir(dirname(join(root, path)), { recursive: true });
    await writeFile(join(root, path), content);
  }
}

const read = (sourceDir: string) =>
  readNextPages({
    fs: directWriteFs,
    root,
    sourceDir,
    support: { supported: true, reasons: [], versions: {}, language: 'ts' },
  });

function deps(sourceDir: string): PageEditDeps {
  return {
    fs: directWriteFs,
    history: createHistoryService({ fs: directWriteFs }),
    projectRoot: root,
    sourceDir,
    platform: process.platform === 'win32' ? 'win32' : 'linux',
    language: 'ts',
    designDirs: { pages: ['app'], layouts: ['app'], components: ['components'], drafts: 'drafts' },
  };
}

const PAGE = 'export default function P() {\n  return <main />;\n}\n';

beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), 'rc-next-pages-'));
});

afterEach(async () => {
  await rm(root, { recursive: true, force: true });
});

describe('Next.js pages [03b section 1.4]', () => {
  it('App Router at the root: groups add nothing, [slug] is a parameter, private folders are not pages', async () => {
    await put({
      'app/layout.tsx': PAGE,
      'app/page.tsx': PAGE,
      'app/(shop)/cart/page.tsx': PAGE,
      'app/blog/[slug]/page.tsx': PAGE,
      'app/_parts/page.tsx': PAGE,
      'app/api/route.ts': 'export {};\n',
    });

    const info = await read('.');

    expect(info.pages.map((p) => [p.path, p.file, p.dynamic])).toEqual([
      ['/', 'app/page.tsx', false],
      ['/blog/:slug', 'app/blog/[slug]/page.tsx', true],
      ['/cart', 'app/(shop)/cart/page.tsx', false],
    ]);
    expect(info.router).toMatchObject({ status: 'found', file: 'app', kind: 'fileSystem' });
  });

  it('Pages Router under src/: index is /, _app and api/ are not pages', async () => {
    await put({
      'src/pages/index.tsx': PAGE,
      'src/pages/about.tsx': PAGE,
      'src/pages/docs/[id].tsx': PAGE,
      'src/pages/_app.tsx': PAGE,
      'src/pages/api/hello.ts': 'export {};\n',
    });

    const info = await read('src');

    expect(info.pages.map((p) => p.path)).toEqual(['/', '/about', '/docs/:id']);
  });

  it('adds, renames and removes an App Router page; Undo puts each step back', async () => {
    await put({ 'app/page.tsx': PAGE });
    const d = deps('.');

    expect(await addNextPage(d, { name: 'Giới thiệu' })).toMatchObject({
      ok: true,
      value: { pagePath: '/gioi-thieu' },
    });
    expect(await readFile(join(root, 'app/gioi-thieu/page.tsx'), 'utf8')).toContain(
      'export default function GioiThieu()',
    );
    expect(await addNextPage(d, { name: 'x', path: '/gioi-thieu' })).toMatchObject({ ok: false });

    expect(await renameNextPage(d, { path: '/gioi-thieu', newPath: '/about' })).toMatchObject({
      ok: true,
    });
    expect(existsSync(join(root, 'app/about/page.tsx'))).toBe(true);
    expect(existsSync(join(root, 'app/gioi-thieu'))).toBe(false);

    expect(await deleteNextPage(d, { path: '/about' })).toMatchObject({ ok: true });
    expect(existsSync(join(root, 'app/about/page.tsx'))).toBe(false);

    await d.history.undo(root);
    expect(existsSync(join(root, 'app/about/page.tsx'))).toBe(true);
    await d.history.undo(root);
    expect(existsSync(join(root, 'app/gioi-thieu/page.tsx'))).toBe(true);
    await d.history.undo(root);
    expect(existsSync(join(root, 'app/gioi-thieu/page.tsx'))).toBe(false);
  });

  it('removing a page whose folder holds other pages keeps them', async () => {
    await put({ 'app/page.tsx': PAGE, 'app/shop/page.tsx': PAGE, 'app/shop/cart/page.tsx': PAGE });

    expect(await deleteNextPage(deps('.'), { path: '/shop' })).toMatchObject({ ok: true });

    expect(existsSync(join(root, 'app/shop/page.tsx'))).toBe(false);
    expect(existsSync(join(root, 'app/shop/cart/page.tsx'))).toBe(true);
  });

  it('adds a Pages Router page as a file', async () => {
    await put({ 'src/pages/index.tsx': PAGE });

    expect(await addNextPage(deps('src'), { name: 'Contact' })).toMatchObject({ ok: true });

    expect(existsSync(join(root, 'src/pages/contact.tsx'))).toBe(true);
  });
});
