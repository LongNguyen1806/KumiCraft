import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { makeTempDir, nodeFs } from '../../../workspace/test-support.ts';
import { detectFramework } from '../index.ts';
import { findExpressRoutes } from './routes.ts';

const FIXTURE_ROOT = join(process.cwd(), 'fixtures/projects/express-pug');
const VITE_REACT_FIXTURE = join(process.cwd(), 'templates/vite-react-ts-tailwind4');

let dir: string;
let cleanup: () => Promise<void>;

beforeEach(async () => {
  ({ dir, cleanup } = await makeTempDir());
});

afterEach(async () => {
  await cleanup();
});

describe('Express + Pug Framework Adapter [WP-4.00]', () => {
  it('[WP-4.00] A1: detectFramework with express-pug fixture -> express-pug supported; vite-react -> vite-react', async () => {
    const pkgRead = await nodeFs.readText(FIXTURE_ROOT, 'package.json');
    expect(pkgRead.ok).toBe(true);
    const pkg = JSON.parse(pkgRead.ok ? pkgRead.value : '{}') as unknown;

    const res = await detectFramework({
      root: FIXTURE_ROOT,
      fs: nodeFs,
      packageJson: pkg,
    });

    expect(res.adapter.id).toBe('express-pug');
    expect(res.report.supported).toBe(true);
    expect(res.report.framework).toBe('express-pug');
    expect(res.report.serverEntry).toBe('app.js');
    expect(res.report.viewsDir).toBe('views');
    expect(res.report.editMode).toBe('viewOnly');
    expect(res.report.language).toBe('js');
    expect(res.report.styling?.editable).toBe(false);

    // Vite + React project detection
    const vitePkgRead = await nodeFs.readText(VITE_REACT_FIXTURE, 'package.json');
    expect(vitePkgRead.ok).toBe(true);
    const vitePkg = JSON.parse(vitePkgRead.ok ? vitePkgRead.value : '{}') as unknown;

    const viteRes = await detectFramework({
      root: VITE_REACT_FIXTURE,
      fs: nodeFs,
      packageJson: vitePkg,
    });

    expect(viteRes.adapter.id).toBe('vite-react');
    expect(viteRes.report.supported).toBe(true);
    expect(viteRes.report.framework).toBe('vite-react');
  });

  it('[WP-4.00] A2: Startup file priority and missing dependency reasons', async () => {
    // 1. scripts.start = "nodemon --watch src src/server.js" -> src/server.js
    await mkdir(join(dir, 'src'), { recursive: true });
    await writeFile(join(dir, 'src/server.js'), 'const express = require("express");');
    const pkg1 = {
      scripts: { start: 'nodemon --watch src src/server.js' },
      dependencies: { express: '^5.0.0', pug: '^3.0.0' },
    };
    await writeFile(join(dir, 'package.json'), JSON.stringify(pkg1));

    const r1 = await detectFramework({ root: dir, fs: nodeFs, packageJson: pkg1 });
    expect(r1.report.supported).toBe(true);
    expect(r1.report.serverEntry).toBe('src/server.js');

    // 2. Only bin/www -> bin/www
    const { dir: dir2, cleanup: cleanup2 } = await makeTempDir();
    try {
      await mkdir(join(dir2, 'bin'), { recursive: true });
      await writeFile(join(dir2, 'bin/www'), '#!/usr/bin/env node');
      const pkg2 = { dependencies: { express: '^5.0.0', pug: '^3.0.0' } };
      await writeFile(join(dir2, 'package.json'), JSON.stringify(pkg2));

      const r2 = await detectFramework({ root: dir2, fs: nodeFs, packageJson: pkg2 });
      expect(r2.report.supported).toBe(true);
      expect(r2.report.serverEntry).toBe('bin/www');
    } finally {
      await cleanup2();
    }

    // 3. No server entry file exists -> noServerEntry
    const { dir: dir3, cleanup: cleanup3 } = await makeTempDir();
    try {
      const pkg3 = { dependencies: { express: '^5.0.0', pug: '^3.0.0' } };
      await writeFile(join(dir3, 'package.json'), JSON.stringify(pkg3));

      const r3 = await detectFramework({ root: dir3, fs: nodeFs, packageJson: pkg3 });
      expect(r3.report.supported).toBe(false);
      expect(r3.report.reasons).toContain('noServerEntry');
    } finally {
      await cleanup3();
    }

    // 4. Has express but no pug -> noPug
    const { dir: dir4, cleanup: cleanup4 } = await makeTempDir();
    try {
      await writeFile(join(dir4, 'app.js'), 'console.log(1);');
      const pkg4 = { dependencies: { express: '^5.0.0' } };
      await writeFile(join(dir4, 'package.json'), JSON.stringify(pkg4));

      const r4 = await detectFramework({ root: dir4, fs: nodeFs, packageJson: pkg4 });
      expect(r4.report.supported).toBe(false);
      expect(r4.report.reasons).toContain('noPug');
    } finally {
      await cleanup4();
    }
  });

  it('[WP-4.00] A3: Fullstack project with vite, react, express, pug -> vite-react wins', async () => {
    const fullstackPkg = {
      dependencies: {
        react: '^19.0.0',
        express: '^5.0.0',
        pug: '^3.0.0',
      },
      devDependencies: {
        vite: '^8.0.0',
        tailwindcss: '^4.0.0',
      },
    };
    await writeFile(join(dir, 'package.json'), JSON.stringify(fullstackPkg));
    await writeFile(join(dir, 'vite.config.ts'), 'export default {}');
    await mkdir(join(dir, 'src'), { recursive: true });
    await writeFile(join(dir, 'src/index.css'), '@import "tailwindcss";');
    await writeFile(join(dir, 'tsconfig.json'), '{}');
    await writeFile(join(dir, 'app.js'), 'const express = require("express");');

    const result = await detectFramework({
      root: dir,
      fs: nodeFs,
      packageJson: fullstackPkg,
    });

    expect(result.adapter.id).toBe('vite-react');
    expect(result.report.supported).toBe(true);
    expect(result.report.framework).toBe('vite-react');
  });

  it('[WP-4.00] A6: Express routes from fixture -> /, /about, /products/:id (dynamic); app.get(nonLiteral) ignored', async () => {
    // Test on real fixture
    const pagesInfo = await findExpressRoutes(nodeFs, FIXTURE_ROOT, 'app.js', 'views');

    expect(pagesInfo.convention).toBe(true);
    expect(pagesInfo.routesFile).toBe('app.js');
    expect(pagesInfo.router.status).toBe('found');
    if (pagesInfo.router.status === 'found') {
      expect(pagesInfo.router.kind).toBe('express');
    }

    const paths = pagesInfo.pages.map((p) => p.path);
    expect(paths).toContain('/');
    expect(paths).toContain('/about');
    expect(paths).toContain('/products/:id');

    const rootPage = pagesInfo.pages.find((p) => p.path === '/');
    expect(rootPage?.file).toBe('views/index.pug');
    expect(rootPage?.dynamic).toBe(false);

    const aboutPage = pagesInfo.pages.find((p) => p.path === '/about');
    expect(aboutPage?.file).toBe('views/about.pug');
    expect(aboutPage?.dynamic).toBe(false);

    const productPage = pagesInfo.pages.find((p) => p.path === '/products/:id');
    expect(productPage?.file).toBe('views/product.pug');
    expect(productPage?.dynamic).toBe(true);

    // Test that app.get(variable) without literal is ignored
    await writeFile(
      join(dir, 'app.js'),
      `
      const express = require('express');
      const app = express();
      const dynamicRoute = '/foo';
      app.get(dynamicRoute, (req, res) => { res.render('foo'); });
      app.get('/valid', (req, res) => { res.render('valid'); });
    `,
    );

    const testPages = await findExpressRoutes(nodeFs, dir, 'app.js', 'views');
    const testPaths = testPages.pages.map((p) => p.path);
    expect(testPaths).not.toContain('/foo');
    expect(testPaths).toContain('/valid');
  });
});
