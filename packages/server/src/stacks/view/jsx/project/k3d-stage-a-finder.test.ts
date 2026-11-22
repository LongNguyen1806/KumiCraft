// Tests A1–A6 for K3d Stage A: Route Finder and Lazy Routes (SPEC-04 K3d).
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { makeTempDir, nodeFs } from '../../../../services/workspace/test-support.ts';
import { readPages } from './pages.ts';

async function createProject(files: Record<string, string>) {
  const temp = await makeTempDir();
  for (const [file, text] of Object.entries(files)) {
    await mkdir(dirname(join(temp.dir, file)), { recursive: true });
    await writeFile(join(temp.dir, file), text);
  }
  return temp;
}

describe('K3d Stage A — Route Finder [WP-4.00]', () => {
  it('A1: index.html -> src/main.jsx -> src/App.jsx -> src/router/AppRouter.jsx with <Routes> finds jsxRoutes [WP-4.00]', async () => {
    const t = await createProject({
      'index.html':
        '<!DOCTYPE html><html><body><script type="module" src="/src/main.jsx"></script></body></html>',
      'src/main.jsx': "import { App } from './App.jsx';\nconsole.log(App);",
      'src/App.jsx':
        "import { AppRouter } from './router/AppRouter.jsx';\nexport function App() { return <AppRouter />; }",
      'src/router/AppRouter.jsx': [
        "import { Routes, Route } from 'react-router-dom';",
        "import { Home } from '../pages/Home.jsx';",
        'export function AppRouter() {',
        '  return (',
        '    <Routes>',
        '      <Route path="/" element={<Home />} />',
        '      <Route path="*" element={<div>404</div>} />',
        '    </Routes>',
        '  );',
        '}',
      ].join('\n'),
      'src/pages/Home.jsx': 'export function Home() { return <div>Home</div>; }',
    });

    try {
      const res = await readPages(nodeFs, t.dir, 'src');
      expect(res.convention).toBe(true);
      expect(res.routesFile).toBe('src/router/AppRouter.jsx');
      expect(res.router).toEqual({
        status: 'found',
        file: 'src/router/AppRouter.jsx',
        line: 5,
        kind: 'jsxRoutes',
        chosen: false,
      });
      expect(res.pages).toEqual([
        { path: '/', component: 'Home', file: 'src/pages/Home.jsx', dynamic: false },
      ]);
    } finally {
      await t.cleanup();
    }
  });

  it('A2: createBrowserRouter(routes) with routes imported from src/routes/index.ts [WP-4.00]', async () => {
    const t = await createProject({
      'src/main.tsx': [
        "import { createBrowserRouter } from 'react-router';",
        "import { routes } from './routes/index.ts';",
        'export const router = createBrowserRouter(routes);',
      ].join('\n'),
      'src/routes/index.ts': [
        "import { Home } from '../pages/Home.tsx';",
        "import { About } from '../pages/About.tsx';",
        'export const routes = [',
        "  { path: '/', element: <Home /> },",
        "  { path: 'about', element: <About /> },",
        '];',
      ].join('\n'),
      'src/pages/Home.tsx': 'export function Home() { return <div>Home</div>; }',
      'src/pages/About.tsx': 'export function About() { return <div>About</div>; }',
    });

    try {
      const res = await readPages(nodeFs, t.dir, 'src');
      expect(res.convention).toBe(true);
      expect(res.routesFile).toBe('src/routes/index.ts');
      expect(res.router).toEqual({
        status: 'found',
        file: 'src/routes/index.ts',
        line: 3,
        kind: 'dataRouter',
        chosen: false,
      });
      expect(res.pages.map((p) => [p.path, p.component, p.file])).toEqual([
        ['/', 'Home', 'src/pages/Home.tsx'],
        ['/about', 'About', 'src/pages/About.tsx'],
      ]);
    } finally {
      await t.cleanup();
    }
  });

  it('A3: Two reachable <Routes> files yield ambiguous, routing.file resolves to found chosen: true [WP-4.00]', async () => {
    const t = await createProject({
      'src/main.jsx':
        "import { R1 } from './RouterA.jsx';\nimport { R2 } from './RouterB.jsx';\nconsole.log(R1, R2);",
      'src/RouterA.jsx':
        'import { Routes, Route } from \'react-router-dom\';\nexport function R1() { return <Routes><Route path="/" element={<div />} /></Routes>; }',
      'src/RouterB.jsx':
        'import { Routes, Route } from \'react-router-dom\';\nexport function R2() { return <Routes><Route path="/b" element={<div />} /></Routes>; }',
    });

    try {
      const res1 = await readPages(nodeFs, t.dir, 'src');
      expect(res1.convention).toBe(false);
      expect(res1.router).toEqual({
        status: 'ambiguous',
        candidates: ['src/RouterA.jsx', 'src/RouterB.jsx'],
      });

      const res2 = await readPages(nodeFs, t.dir, 'src', 'src/RouterA.jsx');
      expect(res2.convention).toBe(true);
      expect(res2.routesFile).toBe('src/RouterA.jsx');
      expect(res2.router).toEqual({
        status: 'found',
        file: 'src/RouterA.jsx',
        line: 2,
        kind: 'jsxRoutes',
        chosen: true,
      });
    } finally {
      await t.cleanup();
    }
  });

  it('A4: generated routes yields unsupported, package.json with react-router yields none hasRouterPackage: true [WP-4.00]', async () => {
    const t1 = await createProject({
      'src/main.tsx': [
        "import { createBrowserRouter } from 'react-router';",
        'function buildRoutes() { return []; }',
        'export const router = createBrowserRouter(buildRoutes());',
      ].join('\n'),
    });
    try {
      const res1 = await readPages(nodeFs, t1.dir, 'src');
      expect(res1.router).toEqual({
        status: 'unsupported',
        file: 'src/main.tsx',
        reason: 'generated',
      });
    } finally {
      await t1.cleanup();
    }

    const t2 = await createProject({
      'package.json': JSON.stringify({ dependencies: { 'react-router': '7.18.4' } }),
      'src/main.tsx': 'export function App() { return <div>Plain app</div>; }',
    });
    try {
      const res2 = await readPages(nodeFs, t2.dir, 'src');
      expect(res2.router).toEqual({
        status: 'none',
        hasRouterPackage: true,
      });
    } finally {
      await t2.cleanup();
    }
  });

  it('A5: Detached router file not reachable from entry point is ignored [WP-4.00]', async () => {
    const t = await createProject({
      'index.html':
        '<!DOCTYPE html><html><body><script type="module" src="/src/main.jsx"></script></body></html>',
      'src/main.jsx': "import { App } from './App.jsx';\nconsole.log(App);",
      'src/App.jsx': 'export function App() { return <div>No router here</div>; }',
      'src/detached/StrayRouter.jsx': [
        "import { Routes, Route } from 'react-router-dom';",
        'export function StrayRouter() {',
        '  return <Routes><Route path="/secret" element={<div />} /></Routes>;',
        '}',
      ].join('\n'),
    });

    try {
      const res = await readPages(nodeFs, t.dir, 'src');
      expect(res.router.status).toBe('none');
      expect(res.convention).toBe(false);
      // The page list still reads every file, as before K3d; only edits need a reachable router.
      expect(res.pages.map((p) => p.path)).toEqual(['/secret']);
    } finally {
      await t.cleanup();
    }
  });

  it('A6: lazy(() => import(...)) and route lazy property resolve to correct page files [WP-4.00]', async () => {
    const t = await createProject({
      'src/main.tsx': [
        "import { lazy } from 'react';",
        "import { createBrowserRouter } from 'react-router';",
        "const About = lazy(() => import('./pages/About.tsx'));",
        'export const router = createBrowserRouter([',
        "  { path: '/about', element: <About /> },",
        "  { path: '/contact', lazy: () => import('./pages/Contact.tsx') },",
        ']);',
      ].join('\n'),
      'src/pages/About.tsx': 'export function About() { return <div>About page</div>; }',
      'src/pages/Contact.tsx': 'export function Contact() { return <div>Contact page</div>; }',
    });

    try {
      const res = await readPages(nodeFs, t.dir, 'src');
      expect(res.convention).toBe(true);
      expect(res.pages).toEqual([
        { path: '/about', component: 'About', file: 'src/pages/About.tsx', dynamic: false },
        { path: '/contact', file: 'src/pages/Contact.tsx', dynamic: false },
      ]);
    } finally {
      await t.cleanup();
    }
  });
  it('route modules spread into createBrowserRouter: one router, their pages listed, code paths skipped [WP-4.00]', async () => {
    // MarketLink: AppRouter.jsx spreads arrays exported by router/routes/*.routes.jsx.
    const t = await createProject({
      'index.html': '<script type="module" src="/src/main.jsx"></script>',
      'src/main.jsx': "import { router } from './router/AppRouter';\nconsole.log(router);",
      'src/constants/routes.js': "export const ROUTES = Object.freeze({ FORBIDDEN: '/403' });",
      'src/router/AppRouter.jsx': [
        "import { createBrowserRouter } from 'react-router-dom';",
        "import { ROUTES } from '../constants/routes';",
        "import { publicRoutes } from './routes/public.routes';",
        "import { adminRoutes } from './routes/admin.routes';",
        'const page = (load) => async () => ({ Component: (await load()).default });',
        'export const router = createBrowserRouter([',
        '  {',
        '    children: [',
        '      ...publicRoutes,',
        '      ...adminRoutes,',
        "      { path: ROUTES.FORBIDDEN, lazy: page(() => import('../pages/ForbiddenPage')) },",
        '    ],',
        '  },',
        ']);',
      ].join('\n'),
      'src/router/routes/public.routes.jsx': [
        'const page = (load) => async () => ({ Component: (await load()).default });',
        'export const publicRoutes = [',
        "  { path: '/', lazy: page(() => import('../../pages/HomePage')) },",
        "  { path: '/products', lazy: page(() => import('../../pages/ProductsPage')) },",
        '];',
      ].join('\n'),
      'src/router/routes/admin.routes.jsx': [
        'const page = (load) => async () => ({ Component: (await load()).default });',
        "export const adminRoutes = [{ path: '/admin', lazy: page(() => import('../../pages/AdminPage')) }];",
      ].join('\n'),
      'src/pages/HomePage.jsx': 'export default function HomePage() { return <h1>Home</h1>; }',
      'src/pages/ProductsPage.jsx': 'export default function ProductsPage() { return <h1>P</h1>; }',
      'src/pages/AdminPage.jsx': 'export default function AdminPage() { return <h1>A</h1>; }',
      'src/pages/ForbiddenPage.jsx':
        'export default function ForbiddenPage() { return <h1>F</h1>; }',
    });

    try {
      const res = await readPages(nodeFs, t.dir, 'src');
      expect(res.router).toMatchObject({ status: 'found', file: 'src/router/AppRouter.jsx' });
      const pages = res.pages.map((p) => [p.path, p.file]).sort();
      expect(pages).toEqual([
        ['/', 'src/pages/HomePage.jsx'],
        ['/403', 'src/pages/ForbiddenPage.jsx'],
        ['/admin', 'src/pages/AdminPage.jsx'],
        ['/products', 'src/pages/ProductsPage.jsx'],
      ]);
    } finally {
      await t.cleanup();
    }
  });

  it('C1: exported ROUTES constant object imported into route files resolves path: ROUTES.FARMER.HOME and <Route path={ROUTES.HOME}> [WP-4.00]', async () => {
    const t = await createProject({
      'src/router/constants.ts': [
        'export const ROUTES = Object.freeze({',
        "  HOME: '/',",
        '  FARMER: {',
        "    HOME: '/farmer',",
        "    PLOTS: '/farmer/plots',",
        '  },',
        '} as const);',
      ].join('\n'),
      'src/main.tsx': [
        "import { createBrowserRouter } from 'react-router';",
        "import { ROUTES } from './router/constants';",
        "import { Home } from './pages/Home.tsx';",
        "import { FarmerHome } from './pages/FarmerHome.tsx';",
        "import { Plots } from '@/pages/Plots.tsx';",
        'export const router = createBrowserRouter([',
        '  { path: ROUTES.FARMER.HOME, element: <FarmerHome /> },',
        '  { path: ROUTES.FARMER.PLOTS, Component: Plots },',
        ']);',
        'export function JsxApp() {',
        '  return <Route path={ROUTES.HOME} element={<Home />} />;',
        '}',
      ].join('\n'),
      'src/pages/Home.tsx': 'export function Home() { return <div>Home</div>; }',
      'src/pages/FarmerHome.tsx': 'export function FarmerHome() { return <div>Farmer</div>; }',
      'src/pages/Plots.tsx': 'export function Plots() { return <div>Plots</div>; }',
    });

    try {
      const res = await readPages(nodeFs, t.dir, 'src');
      expect(res.pages).toEqual([
        {
          path: '/farmer',
          component: 'FarmerHome',
          file: 'src/pages/FarmerHome.tsx',
          dynamic: false,
        },
        { path: '/farmer/plots', component: 'Plots', file: 'src/pages/Plots.tsx', dynamic: false },
        { path: '/', component: 'Home', file: 'src/pages/Home.tsx', dynamic: false },
      ]);
    } finally {
      await t.cleanup();
    }
  });

  it('C2: function call ROUTES.FARMER.PLOT_DETAIL(":id") or unresolvable local variable is skipped rather than defaulting to "/" [WP-4.00]', async () => {
    const t = await createProject({
      'src/router/constants.ts': [
        'export const ROUTES = {',
        '  FARMER: {',
        "    HOME: '/farmer',",
        '    PLOT_DETAIL: (id: string) => `/farmer/plots/${id}`,',
        '  },',
        '} as const;',
      ].join('\n'),
      'src/main.tsx': [
        "import { createBrowserRouter } from 'react-router';",
        "import { ROUTES } from '@/router/constants';",
        "import { FarmerHome } from './pages/FarmerHome.tsx';",
        "import { PlotDetail } from './pages/PlotDetail.tsx';",
        'const LOCAL_ROUTES = { SECRET: "/secret" };',
        'export const router = createBrowserRouter([',
        '  { path: ROUTES.FARMER.HOME, element: <FarmerHome /> },',
        "  { path: ROUTES.FARMER.PLOT_DETAIL(':id'), element: <PlotDetail /> },",
        '  { path: LOCAL_ROUTES.SECRET, element: <PlotDetail /> },',
        ']);',
        'export function ExtraJsx() {',
        '  return <Route path={LOCAL_ROUTES.SECRET} element={<PlotDetail />} />;',
        '}',
      ].join('\n'),
      'src/pages/FarmerHome.tsx': 'export function FarmerHome() { return <div>Farmer</div>; }',
      'src/pages/PlotDetail.tsx': 'export function PlotDetail() { return <div>Plot</div>; }',
    });

    try {
      const res = await readPages(nodeFs, t.dir, 'src');
      expect(res.pages).toEqual([
        {
          path: '/farmer',
          component: 'FarmerHome',
          file: 'src/pages/FarmerHome.tsx',
          dynamic: false,
        },
      ]);
    } finally {
      await t.cleanup();
    }
  });
});
