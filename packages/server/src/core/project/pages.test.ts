// Reading the pages of a project from its router (R-PG-10, R-PG-15).
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { makeTempDir, nodeFs } from '../workspace/test-support.ts';
import { joinRoutePath, readPages } from './pages.ts';

async function project(files: Record<string, string>) {
  const temp = await makeTempDir();
  for (const [file, text] of Object.entries(files)) {
    await mkdir(dirname(join(temp.dir, file)), { recursive: true });
    await writeFile(join(temp.dir, file), text);
  }
  return temp;
}

describe('readPages', () => {
  it('reads the routes.tsx convention with a layout and nested pages [R-PG-10]', async () => {
    const t = await project({
      'src/routes.tsx': [
        "import { createBrowserRouter } from 'react-router';",
        "import { MainLayout } from './layouts/MainLayout';",
        "import { Home } from './pages/Home';",
        "import { About } from './pages/About';",
        "import { Product } from './pages/product/Product';",
        'export const router = createBrowserRouter([',
        "  { path: '/', element: <MainLayout />, children: [",
        '    { index: true, element: <Home /> },',
        "    { path: 'about', element: <About /> },",
        "    { path: 'product/:id', element: <Product /> },",
        '  ] },',
        ']);',
      ].join('\n'),
    });
    try {
      expect(await readPages(nodeFs, t.dir, 'src')).toEqual({
        convention: true,
        routesFile: 'src/routes.tsx',
        router: {
          status: 'found',
          file: 'src/routes.tsx',
          line: 6,
          kind: 'dataRouter',
          chosen: false,
        },
        pages: [
          { path: '/', component: 'Home', dynamic: false },
          { path: '/about', component: 'About', dynamic: false },
          { path: '/product/:id', component: 'Product', dynamic: true },
        ],
      });
    } finally {
      await t.cleanup();
    }
  });

  it('reads <Route> elements in any folder, without the catch-all route [R-PG-10, R-PG-15]', async () => {
    const t = await project({
      'src/router/AppRouter.jsx': [
        "import { Routes, Route } from 'react-router-dom';",
        'export function AppRouter() {',
        '  return (',
        '    <Routes>',
        '      <Route path="/" element={<Layout />}>',
        '        <Route index element={<Dashboard />} />',
        '        <Route path="login" element={<Login />} />',
        '        <Route path="/settings/profile" element={<Profile />} />',
        '      </Route>',
        '      <Route path="*" element={<NotFound />} />',
        '    </Routes>',
        '  );',
        '}',
      ].join('\n'),
    });
    try {
      expect(await readPages(nodeFs, t.dir, 'src')).toEqual({
        convention: false,
        router: {
          status: 'none',
          hasRouterPackage: false,
        },
        pages: [
          { path: '/', component: 'Dashboard', dynamic: false },
          { path: '/login', component: 'Login', dynamic: false },
          { path: '/settings/profile', component: 'Profile', dynamic: false },
        ],
      });
    } finally {
      await t.cleanup();
    }
  });

  it('reads useRoutes arrays and skips files that do not parse [R-PG-10]', async () => {
    const t = await project({
      'src/App.tsx': [
        'export function App() {',
        "  return useRoutes([{ path: '/', element: <Home /> }, { path: '/tasks', Component: Tasks }]);",
        '}',
      ].join('\n'),
      'src/Broken.tsx': 'export const x = <Route path="/x" element={<X />}',
    });
    try {
      const info = await readPages(nodeFs, t.dir, 'src');
      expect(info.pages.map((p) => [p.path, p.component])).toEqual([
        ['/', 'Home'],
        ['/tasks', 'Tasks'],
      ]);
    } finally {
      await t.cleanup();
    }
  });
});

describe('joinRoutePath', () => {
  it('joins relative child paths and keeps absolute ones [R-PG-10]', () => {
    expect(joinRoutePath('', undefined)).toBe('/');
    expect(joinRoutePath('/', 'about')).toBe('/about');
    expect(joinRoutePath('/shop', 'item/:id')).toBe('/shop/item/:id');
    expect(joinRoutePath('/shop', '/cart')).toBe('/cart');
    expect(joinRoutePath('/shop/', '')).toBe('/shop/');
  });
});
