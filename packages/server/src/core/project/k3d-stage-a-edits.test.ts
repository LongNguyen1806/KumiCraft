// Tests A7–A12 for K3d Stage A: JSX Route Edits and Page Template (SPEC-04 K3d).
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';

import { DEFAULT_DESIGN_DIRS } from '@kumicraft/shared';
import { describe, expect, it } from 'vitest';

import { createHistoryService } from '../history/history-service.ts';
import { directWriteFs, makeTempDir, nodeFs, platform } from '../workspace/test-support.ts';
import { promoteDraft } from './draft-promote.ts';
import { addPage } from './page-add.ts';
import type { PageEditDeps } from './page-common.ts';
import { deletePage } from './page-delete.ts';
import { renamePage } from './page-rename.ts';
import { buildPageSource } from './page-template.ts';

async function createProject(files: Record<string, string>) {
  const temp = await makeTempDir();
  for (const [file, text] of Object.entries(files)) {
    await mkdir(dirname(join(temp.dir, file)), { recursive: true });
    await writeFile(join(temp.dir, file), text);
  }
  return temp;
}

function createDeps(projectRoot: string, language: 'ts' | 'js' = 'ts'): PageEditDeps {
  return {
    fs: directWriteFs,
    history: createHistoryService({ fs: directWriteFs }),
    projectRoot,
    sourceDir: 'src',
    platform,
    language,
    designDirs: DEFAULT_DESIGN_DIRS,
  };
}

describe('K3d Stage A — JSX Edits and Page Templates [WP-4.00]', () => {
  it('A7: Adds page to JSX <Routes> with layout parent and path="*" before * preserving exact bytes [WP-4.00]', async () => {
    const originalRoutes =
      "import { Routes, Route } from 'react-router';\nimport { MainLayout } from './layouts/MainLayout.tsx';\nimport { Home } from './pages/Home.tsx';\nimport { NotFound } from './pages/NotFound.tsx';\n\nexport function App() {\n  return (\n    <Routes>\n      <Route element={<MainLayout />}>\n        <Route index element={<Home />} />\n        <Route path=\"*\" element={<NotFound />} />\n      </Route>\n    </Routes>\n  );\n}\n";

    const t = await createProject({
      'src/routes.tsx': originalRoutes,
      'src/layouts/MainLayout.tsx':
        'export function MainLayout({ children }: { children: any }) { return <div>{children}</div>; }',
      'src/pages/Home.tsx': 'export function Home() { return <div>Home</div>; }',
      'src/pages/NotFound.tsx': 'export function NotFound() { return <div>404</div>; }',
    });

    try {
      const deps = createDeps(t.dir);
      const res = await addPage(deps, { name: 'About', path: '/about' });
      expect(res.ok).toBe(true);

      const updated = await readFile(join(t.dir, 'src/routes.tsx'), 'utf8');
      expect(updated).toContain(
        "import { About } from './pages/About.tsx';\n\nexport function App()",
      );
      expect(updated).toContain(
        '        <Route path=\'about\' element={<About />} />\n        <Route path="*"',
      );
    } finally {
      await t.cleanup();
    }
  });

  it('A8: Deletes and renames page in JSX routes with byte-exact Undo [WP-4.00]', async () => {
    const originalRoutes =
      "import { Routes, Route } from 'react-router';\nimport { Home } from './pages/Home.tsx';\nimport { About } from './pages/About.tsx';\n\nexport function App() {\n  return (\n    <Routes>\n      <Route path=\"/\" element={<Home />} />\n      <Route path=\"/about\" element={<About />} />\n    </Routes>\n  );\n}\n";

    const t = await createProject({
      'src/routes.tsx': originalRoutes,
      'src/pages/Home.tsx': 'export function Home() { return <div>Home</div>; }',
      'src/pages/About.tsx': 'export function About() { return <div>About</div>; }',
    });

    try {
      const deps = createDeps(t.dir);
      const delRes = await deletePage(deps, { path: '/about' });
      expect(delRes.ok).toBe(true);

      const afterDelete = await readFile(join(t.dir, 'src/routes.tsx'), 'utf8');
      expect(afterDelete).not.toContain('About');

      const undoDel = await deps.history.undo(t.dir);
      expect(undoDel.ok).toBe(true);
      const restored = await readFile(join(t.dir, 'src/routes.tsx'), 'utf8');
      expect(restored).toBe(originalRoutes);

      const renRes = await renamePage(deps, { path: '/', newPath: '/start', newName: 'Start' });
      expect(renRes.ok).toBe(true);

      const afterRename = await readFile(join(t.dir, 'src/routes.tsx'), 'utf8');
      expect(afterRename).toContain('Start');
      expect(afterRename).not.toContain('Home');

      const undoRen = await deps.history.undo(t.dir);
      expect(undoRen.ok).toBe(true);
      const finalRestored = await readFile(join(t.dir, 'src/routes.tsx'), 'utf8');
      expect(finalRestored).toBe(originalRoutes);
    } finally {
      await t.cleanup();
    }
  });

  it('A9: Ambiguous routers causes addPage to return E016 routerAmbiguous without file changes [WP-4.00]', async () => {
    const routerACode =
      'import { Routes, Route } from \'react-router-dom\';\nexport function R1() { return <Routes><Route path="/" element={<div />} /></Routes>; }';
    const routerBCode =
      'import { Routes, Route } from \'react-router-dom\';\nexport function R2() { return <Routes><Route path="/b" element={<div />} /></Routes>; }';

    const t = await createProject({
      'src/main.jsx':
        "import { R1 } from './RouterA.jsx';\nimport { R2 } from './RouterB.jsx';\nconsole.log(R1, R2);",
      'src/RouterA.jsx': routerACode,
      'src/RouterB.jsx': routerBCode,
    });

    try {
      const deps = createDeps(t.dir, 'js');
      const res = await addPage(deps, { name: 'Contact' });
      expect(res).toEqual({
        ok: false,
        error: { code: 'E016', params: { reason: 'routerAmbiguous' } },
      });

      const aNow = await readFile(join(t.dir, 'src/RouterA.jsx'), 'utf8');
      const bNow = await readFile(join(t.dir, 'src/RouterB.jsx'), 'utf8');
      expect(aNow).toBe(routerACode);
      expect(bNow).toBe(routerBCode);
      expect(await nodeFs.exists(t.dir, 'src/pages/Contact.jsx')).toBe(false);
    } finally {
      await t.cleanup();
    }
  });

  it('A10: Page template learns extension, export style, layout wrapper and root tag with className [WP-4.00]', async () => {
    const pageTemplate = (name: string) =>
      [
        "import { MainLayout } from '../layouts/MainLayout.jsx';",
        '',
        `export default function ${name}() {`,
        '  return (',
        '    <MainLayout>',
        '      <section className="page">',
        `        <h1>${name}</h1>`,
        '      </section>',
        '    </MainLayout>',
        '  );',
        '}',
        '',
      ].join('\n');

    const t = await createProject({
      'src/routes.tsx': [
        "import { createBrowserRouter } from 'react-router';",
        "import PageA from './pages/PageA.jsx';",
        'export const router = createBrowserRouter([',
        "  { path: '/', element: <PageA /> },",
        ']);',
      ].join('\n'),
      'src/layouts/MainLayout.jsx':
        'export function MainLayout({ children }) { return <div>{children}</div>; }',
      'src/pages/PageA.jsx': pageTemplate('PageA'),
      'src/pages/PageB.jsx': pageTemplate('PageB'),
      'src/pages/PageC.jsx': pageTemplate('PageC'),
    });

    try {
      const deps = createDeps(t.dir, 'ts');
      const res = await addPage(deps, { name: 'Feedback' });
      expect(res.ok).toBe(true);

      expect(await nodeFs.exists(t.dir, 'src/pages/Feedback.jsx')).toBe(true);
      const content = await readFile(join(t.dir, 'src/pages/Feedback.jsx'), 'utf8');
      expect(content).toBe(pageTemplate('Feedback'));
    } finally {
      await t.cleanup();
    }
  });

  it('A11: Empty directory learns from first pages dir, CSS project without template has no Tailwind classes [WP-4.00]', async () => {
    const pageSample = [
      "import { MainLayout } from '../layouts/MainLayout.jsx';",
      'export default function PageOne() {',
      '  return (',
      '    <MainLayout>',
      '      <section className="page">',
      '        <h1>PageOne</h1>',
      '      </section>',
      '    </MainLayout>',
      '  );',
      '}',
    ].join('\n');

    const t = await createProject({
      'src/pages/PageOne.jsx': pageSample,
      'src/layouts/MainLayout.jsx': 'export function MainLayout() { return null; }',
    });

    try {
      const learned = await buildPageSource({
        fs: nodeFs,
        root: t.dir,
        dir: 'src/pages/sub',
        component: 'SubPage',
        name: 'SubPage',
        language: 'ts',
        firstPagesDir: 'src/pages',
      });
      expect(learned.code).toContain("import { MainLayout } from '../../layouts/MainLayout.jsx';");
      expect(learned.code).toContain('export default function SubPage()');
      expect(learned.code).toContain('<section className="page">');

      const cssSource = await buildPageSource({
        fs: nodeFs,
        root: t.dir,
        dir: 'src/empty',
        component: 'CssPage',
        name: 'CssPage',
        language: 'ts',
        styling: { systems: [{ id: 'css' }], editable: true, globalCss: [] },
      });
      expect(cssSource.code).toContain('<main>\n      <h1>CssPage</h1>\n    </main>');
      expect(cssSource.code).not.toContain('mx-auto');
      expect(cssSource.code).not.toContain('text-3xl');
    } finally {
      await t.cleanup();
    }
  });

  it('A12: Promotes draft into JSX router successfully [WP-4.00]', async () => {
    const routesCode =
      "import { Routes, Route } from 'react-router';\nimport { Home } from './pages/Home.tsx';\nimport { NotFound } from './pages/NotFound.tsx';\n\nexport function App() {\n  return (\n    <Routes>\n      <Route path=\"/\" element={<Home />} />\n      <Route path=\"*\" element={<NotFound />} />\n    </Routes>\n  );\n}\n";

    const t = await createProject({
      'src/routes.tsx': routesCode,
      'src/pages/Home.tsx': 'export function Home() { return <div>Home</div>; }',
      'src/pages/NotFound.tsx': 'export function NotFound() { return <div>404</div>; }',
      'src/drafts/MyDraft.tsx':
        'export function MyDraft() { return <div className="draft">Pricing Draft</div>; }',
    });

    try {
      const deps = createDeps(t.dir);
      const res = await promoteDraft(deps, {
        file: 'src/drafts/MyDraft.tsx',
        as: 'page',
        name: 'Pricing',
        keepDraft: false,
      });
      expect(res.ok).toBe(true);

      expect(await nodeFs.exists(t.dir, 'src/pages/Pricing.tsx')).toBe(true);
      const routesAfter = await readFile(join(t.dir, 'src/routes.tsx'), 'utf8');
      expect(routesAfter).toContain("import { Pricing } from './pages/Pricing.tsx';");
      expect(routesAfter).toContain(
        '      <Route path=\'/pricing\' element={<Pricing />} />\n      <Route path="*"',
      );
    } finally {
      await t.cleanup();
    }
  });

  it('A13: Adds page in WorkTracker js project matching QA exact bytes [WP-4.00]', async () => {
    const originalAppRouter =
      "import { Routes, Route } from 'react-router-dom';\r\nimport MainLayout from '../layouts/MainLayout';\r\nimport Dashboard from '../pages/Dashboard';\r\nimport Tasks from '../pages/Tasks';\r\n\r\nexport default function AppRouter() {\r\n  return (\r\n    <Routes>\r\n      <Route path='/' element={<MainLayout />}>\r\n        <Route index element={<Dashboard />} />\r\n        <Route path='tasks' element={<Tasks />} />\r\n      </Route>\r\n    </Routes>\r\n  );\r\n}\r\n";

    const t = await createProject({
      'index.html': '<script type="module" src="/src/main.jsx"></script>',
      'src/main.jsx':
        "import App from './App';\ncreateRoot(document.getElementById('root')).render(<App />);",
      'src/App.jsx':
        "import AppRouter from './router/AppRouter';\nexport default function App() { return <BrowserRouter><AppRouter /></BrowserRouter>; }",
      'src/router/AppRouter.jsx': originalAppRouter,
      'src/layouts/MainLayout.jsx':
        'export default function MainLayout({ children }) { return <div>{children}</div>; }',
      'src/pages/Dashboard.jsx':
        'export default function Dashboard() { return (<section className="page"><h1>Dashboard</h1></section>); }',
      'src/pages/Tasks.jsx':
        'export default function Tasks() { return (<section className="page"><h1>Tasks</h1></section>); }',
    });

    try {
      const deps = createDeps(t.dir, 'js');
      const res = await addPage(deps, { name: 'Reports' });
      expect(res.ok).toBe(true);

      const routerAfter = await readFile(join(t.dir, 'src/router/AppRouter.jsx'), 'utf8');
      const expectedRouter =
        "import { Routes, Route } from 'react-router-dom';\r\nimport MainLayout from '../layouts/MainLayout';\r\nimport Dashboard from '../pages/Dashboard';\r\nimport Tasks from '../pages/Tasks';\r\nimport Reports from '../pages/Reports';\r\n\r\nexport default function AppRouter() {\r\n  return (\r\n    <Routes>\r\n      <Route path='/' element={<MainLayout />}>\r\n        <Route index element={<Dashboard />} />\r\n        <Route path='tasks' element={<Tasks />} />\r\n        <Route path='reports' element={<Reports />} />\r\n      </Route>\r\n    </Routes>\r\n  );\r\n}\r\n";
      expect(routerAfter).toBe(expectedRouter);

      const pageCode = await readFile(join(t.dir, 'src/pages/Reports.jsx'), 'utf8');
      expect(pageCode).toContain('export default function Reports()');
      expect(pageCode).toContain('<section className="page">');
    } finally {
      await t.cleanup();
    }
  });

  it('A14: Array router with all default export pages generates matching default import [WP-4.00]', async () => {
    const originalRouter =
      "import { createBrowserRouter } from 'react-router-dom';\nimport Dashboard from './pages/Dashboard';\nimport Tasks from './pages/Tasks';\n\nexport const router = createBrowserRouter([\n  { path: '/', element: <Dashboard /> },\n  { path: 'tasks', element: <Tasks /> },\n]);\n";

    const t = await createProject({
      'src/routes.tsx': originalRouter,
      'src/pages/Dashboard.tsx':
        'export default function Dashboard() { return <section className="page"><h1>Dashboard</h1></section>; }',
      'src/pages/Tasks.tsx':
        'export default function Tasks() { return <section className="page"><h1>Tasks</h1></section>; }',
    });

    try {
      const deps = createDeps(t.dir);
      const res = await addPage(deps, { name: 'Reports' });
      expect(res.ok).toBe(true);

      const routerAfter = await readFile(join(t.dir, 'src/routes.tsx'), 'utf8');
      expect(routerAfter).toContain("import Reports from './pages/Reports';");
      expect(routerAfter).not.toContain('{ Reports }');

      const pageCode = await readFile(join(t.dir, 'src/pages/Reports.tsx'), 'utf8');
      expect(pageCode).toContain('export default function Reports()');
    } finally {
      await t.cleanup();
    }
  });

  it('A15: Renames default-exported page in JSX router retaining default import [WP-4.00]', async () => {
    const originalRoutes =
      "import { Routes, Route } from 'react-router-dom';\nimport Dashboard from './pages/Dashboard';\nimport Tasks from './pages/Tasks';\n\nexport default function AppRouter() {\n  return (\n    <Routes>\n      <Route path='tasks' element={<Tasks />} />\n      <Route path='dashboard' element={<Dashboard />} />\n    </Routes>\n  );\n}\n";

    const t = await createProject({
      'src/routes.tsx': originalRoutes,
      'src/pages/Dashboard.tsx':
        'export default function Dashboard() { return <h1>Dashboard</h1>; }',
      'src/pages/Tasks.tsx': 'export default function Tasks() { return <h1>Tasks</h1>; }',
    });

    try {
      const deps = createDeps(t.dir);
      const res = await renamePage(deps, {
        path: '/tasks',
        newName: 'Todos',
      });
      expect(res.ok).toBe(true);

      const routerAfter = await readFile(join(t.dir, 'src/routes.tsx'), 'utf8');
      expect(routerAfter).toContain("import Todos from './pages/Todos';");
      expect(routerAfter).not.toContain('{ Todos }');
      expect(routerAfter).not.toContain('Tasks');

      expect(await nodeFs.exists(t.dir, 'src/pages/Todos.tsx')).toBe(true);
      expect(await nodeFs.exists(t.dir, 'src/pages/Tasks.tsx')).toBe(false);
      const pageCode = await readFile(join(t.dir, 'src/pages/Todos.tsx'), 'utf8');
      expect(pageCode).toContain('export default function Todos()');
    } finally {
      await t.cleanup();
    }
  });
});
