import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { createServer, type Server } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  createDraftMiddleware,
  detectRouterPackage,
  DRAFT_ENTRY_PREFIX,
  draftEntryCode,
  draftFileInDir,
  draftFileOfEntryId,
  resolveDraftEntryId,
} from './draft-page.ts';
import { createReactCraftBridgePlugin } from './vite.ts';

describe('draftFileInDir [R-DR-12]', () => {
  it('R-DR-12: accepts only .tsx/.jsx files inside the drafts folder', () => {
    expect(draftFileInDir('src/drafts/Mockup.tsx', 'src/drafts')).toBe('src/drafts/Mockup.tsx');
    expect(draftFileInDir('src/drafts/Mockup.jsx', 'src/drafts/')).toBe('src/drafts/Mockup.jsx');
    for (const bad of [
      undefined,
      '',
      'src/pages/Home.tsx',
      'src/drafts2/Mockup.tsx',
      'src/drafts/../pages/Home.tsx',
      'src/drafts/./Mockup.tsx',
      '/src/drafts/Mockup.tsx',
      'C:/src/drafts/Mockup.tsx',
      'src\\drafts\\Mockup.tsx',
      'src/drafts/Mockup.ts',
      'src/drafts/Mockup.css',
    ]) {
      expect(draftFileInDir(bad, 'src/drafts')).toBeUndefined();
    }
  });

  it('R-DR-12: the entry id carries the file and refuses files outside the folder', () => {
    const id = resolveDraftEntryId(
      `${DRAFT_ENTRY_PREFIX}${encodeURIComponent('src/drafts/Mockup.tsx')}`,
      'src/drafts',
    );
    expect(id).toBeDefined();
    expect(draftFileOfEntryId(id ?? '', 'src/drafts')).toBe('src/drafts/Mockup.tsx');
    expect(
      resolveDraftEntryId(
        `${DRAFT_ENTRY_PREFIX}${encodeURIComponent('src/pages/Home.tsx')}`,
        'src/drafts',
      ),
    ).toBeUndefined();
    expect(resolveDraftEntryId(`${DRAFT_ENTRY_PREFIX}%E0%A4%A`, 'src/drafts')).toBeUndefined();
    expect(resolveDraftEntryId('/src/main.tsx', 'src/drafts')).toBeUndefined();
  });
});

describe('draftEntryCode [R-DR-12]', () => {
  it('R-DR-12: loads the Tailwind CSS, wraps MemoryRouter and mounts on #root', () => {
    const code = draftEntryCode({
      file: 'src/drafts/Mockup.tsx',
      tailwindCss: 'src/index.css',
      routerPackage: 'react-router-dom',
    });
    expect(code).toContain('import "/src/index.css";');
    expect(code).toContain('import { MemoryRouter } from "react-router-dom";');
    expect(code).toContain('import * as draftModule from "/src/drafts/Mockup.tsx";');
    expect(code).toContain("document.getElementById('root')");
    expect(code).toContain('createElement(MemoryRouter, null, createElement(Draft))');
  });

  it('R-DR-12: without a router or CSS it renders the component alone', () => {
    const code = draftEntryCode({ file: 'src/drafts/Mockup.tsx' });
    expect(code).not.toContain('MemoryRouter');
    expect(code).not.toContain('.css');
    expect(code).toContain('createRoot(container).render(createElement(Draft));');
  });
});

describe('draft page on the dev server [R-DR-12]', () => {
  let root: string;
  let server: Server;
  let baseUrl: string;
  let transformedUrls: string[];
  let nextCalls: number;

  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), 'rc-draft-page-'));
    await mkdir(join(root, 'src', 'drafts'), { recursive: true });
    await mkdir(join(root, 'src', 'pages'), { recursive: true });
    await writeFile(join(root, 'src', 'drafts', 'Mockup.tsx'), 'export function Mockup() {}\n');
    await writeFile(join(root, 'src', 'pages', 'Home.tsx'), 'export function Home() {}\n');
    transformedUrls = [];
    nextCalls = 0;

    const middleware = createDraftMiddleware(
      { rootDir: root, draftsDir: 'src/drafts', tailwindCss: 'src/index.css' },
      {
        transformIndexHtml: (url, html) => {
          transformedUrls.push(url);
          return Promise.resolve(html.replace('<head>', '<head><!-- vite -->'));
        },
      },
    );
    server = createServer((req, res) => {
      middleware(req, res, () => {
        nextCalls += 1;
        res.statusCode = 299;
        res.end('vite');
      });
    });
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    const address = server.address();
    if (!(address instanceof Object)) throw new Error('no port');
    baseUrl = `http://127.0.0.1:${String(address.port)}`;
  });

  afterEach(async () => {
    await new Promise<void>((resolve) =>
      server.close(() => {
        resolve();
      }),
    );
    await rm(root, { recursive: true, force: true });
  });

  it('R-DR-12: serves an HTML page with #root and the draft entry, through Vite', async () => {
    const url = `/__reactcraft/draft?file=${encodeURIComponent('src/drafts/Mockup.tsx')}`;
    const res = await fetch(`${baseUrl}${url}`);
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('text/html');
    const html = await res.text();
    expect(html).toContain('<!-- vite -->');
    expect(html).toContain('<div id="root"></div>');
    expect(html).toContain(
      `src="${DRAFT_ENTRY_PREFIX}${encodeURIComponent('src/drafts/Mockup.tsx')}"`,
    );
    expect(transformedUrls).toEqual([url]);
  });

  it('R-DR-12: answers 404 for a file outside the drafts folder, a missing one or no file', async () => {
    for (const query of [
      `?file=${encodeURIComponent('src/pages/Home.tsx')}`,
      `?file=${encodeURIComponent('src/drafts/../pages/Home.tsx')}`,
      `?file=${encodeURIComponent('src/drafts/Missing.tsx')}`,
      '',
    ]) {
      const res = await fetch(`${baseUrl}/__reactcraft/draft${query}`);
      expect(res.status).toBe(404);
    }
    expect(transformedUrls).toEqual([]);
  });

  it('R-DR-12: leaves every other URL to Vite', async () => {
    const res = await fetch(`${baseUrl}/src/drafts/Mockup.tsx`);
    expect(res.status).toBe(299);
    expect(nextCalls).toBe(1);
  });

  it('R-DR-12: finds react-router-dom, then react-router, else none', async () => {
    await writeFile(
      join(root, 'package.json'),
      JSON.stringify({ dependencies: { react: '19.0.0', 'react-router': '7.0.0' } }),
    );
    expect(await detectRouterPackage(root)).toBe('react-router');
    await writeFile(
      join(root, 'package.json'),
      JSON.stringify({ dependencies: { 'react-router': '7.0.0', 'react-router-dom': '7.0.0' } }),
    );
    expect(await detectRouterPackage(root)).toBe('react-router-dom');
    await writeFile(join(root, 'package.json'), JSON.stringify({ dependencies: {} }));
    expect(await detectRouterPackage(root)).toBeUndefined();
  });

  it('R-DR-12: the plugin resolves and loads the draft entry with the project router', async () => {
    await writeFile(
      join(root, 'package.json'),
      JSON.stringify({ dependencies: { 'react-router-dom': '7.0.0' } }),
    );
    const plugin = createReactCraftBridgePlugin({
      rootDir: root,
      sourceDir: 'src',
      nonce: 'n',
      studioOrigin: 'http://127.0.0.1:4173',
      draftsDir: 'src/drafts',
      tailwindCss: 'src/index.css',
    });
    const id = plugin.resolveId(
      `${DRAFT_ENTRY_PREFIX}${encodeURIComponent('src/drafts/Mockup.tsx')}`,
    );
    expect(id).toBeDefined();
    const code = await plugin.load(id ?? '');
    expect(code).toContain('import { MemoryRouter } from "react-router-dom";');
    expect(code).toContain('import * as draftModule from "/src/drafts/Mockup.tsx";');
  });

  it('R-DR-12: without a drafts folder the plugin adds no draft page', () => {
    const plugin = createReactCraftBridgePlugin({
      rootDir: root,
      sourceDir: 'src',
      nonce: 'n',
      studioOrigin: 'http://127.0.0.1:4173',
    });
    const used: unknown[] = [];
    plugin.configureServer({
      middlewares: { use: (handler) => used.push(handler) },
      transformIndexHtml: (_url, html) => Promise.resolve(html),
    });
    expect(used).toEqual([]);
    expect(
      plugin.resolveId(`${DRAFT_ENTRY_PREFIX}${encodeURIComponent('src/drafts/Mockup.tsx')}`),
    ).toBeUndefined();
  });
});
