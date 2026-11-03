// Tests B1–B4 for POST /project/router/install and legacy workspace.json compatibility (Phase 4 K3d-B).
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';

import Fastify from 'fastify';
import { describe, expect, it, vi } from 'vitest';

import { registerProjectRoutes } from '../../adapters/http/routes/project.ts';
import { createHistoryService } from '../history/history-service.ts';
import { createEventBus } from '../ports/event-bus-port.ts';
import type { ProcessOutput, ProcessPort } from '../ports/process-port.ts';
import { createConfigStore } from '../shared/user-config.ts';
import {
  fakeSystem,
  makeTempDir,
  nodeFs,
  platform,
  silentLogger,
  writeSupportedProject,
} from '../workspace/test-support.ts';
import { createProjectService } from './project-service.ts';
import { findRouter } from './route-finder.ts';

function fakeInstallProcess(): ProcessPort {
  const spawn = vi.fn<ProcessPort['spawn']>(() => ({
    pid: 1234,
    onLine: () => undefined,
    wait: () =>
      Promise.resolve<ProcessOutput>({
        exitCode: 0,
        stdout: '',
        stderr: '',
        lines: [],
      }),
    kill: () => Promise.resolve(),
  }));
  return { spawn };
}

async function setupNoRouterProject(options?: {
  readonly mainContent?: string | undefined;
  readonly hasRouterInPkg?: boolean | undefined;
}) {
  const temp = await makeTempDir();
  const projectDir = join(temp.dir, 'app');
  const configDir = join(temp.dir, 'config');
  await mkdir(join(projectDir, 'src'), { recursive: true });
  await mkdir(configDir, { recursive: true });
  await writeSupportedProject(projectDir);
  await writeFile(join(projectDir, 'pnpm-lock.yaml'), 'lockfileVersion: 9\n');

  const pkgContent = [
    '{',
    '  "name": "plain-app",',
    '  "private": true,',
    '  "dependencies": {',
    '    "react": "^19.0.0",',
    '    "react-dom": "^19.0.0"' +
      (options?.hasRouterInPkg ? ',\n    "react-router": "^7.18.4"' : ''),
    '  },',
    '  "devDependencies": {',
    '    "vite": "^8.0.0",',
    '    "tailwindcss": "^4.0.0"',
    '  }',
    '}',
    '',
  ].join('\n');
  await writeFile(join(projectDir, 'package.json'), pkgContent);

  const mainContent =
    options?.mainContent ??
    [
      "import { StrictMode } from 'react';",
      "import { createRoot } from 'react-dom/client';",
      "import { App } from './App.tsx';",
      '',
      "createRoot(document.getElementById('root')!).render(",
      '  <StrictMode>',
      '    <App />',
      '  </StrictMode>,',
      ');',
      '',
    ].join('\n');
  const appContent = 'export function App() {\n  return <main>Hello</main>;\n}\n';

  await writeFile(join(projectDir, 'src/main.tsx'), mainContent);
  await writeFile(join(projectDir, 'src/App.tsx'), appContent);

  const bus = createEventBus();
  const history = createHistoryService({ fs: nodeFs, eventBus: bus });
  const config = await createConfigStore({
    fs: nodeFs,
    dir: configDir,
    platform,
    logger: silentLogger,
  });
  const service = createProjectService({
    fs: nodeFs,
    system: fakeSystem(1, new Set([1])),
    process: fakeInstallProcess(),
    config,
    logger: silentLogger,
    eventBus: bus,
    port: 4321,
    platform,
    templateDir: temp.dir,
    history,
  });

  await service.open(projectDir);
  await service.setTrusted(true);

  const app = Fastify();
  await app.register(
    (api) => {
      registerProjectRoutes(api, {
        projectService: service,
        getSessionInfo: () => ({
          version: '0.19.0',
          platform,
          features: [],
          project: { state: 'open', id: 'plain00001', name: 'plain-app', trusted: true },
        }),
        fs: nodeFs,
        historyService: history,
      });
    },
    { prefix: '/api/v1' },
  );

  return {
    ...temp,
    projectDir,
    pkgContent,
    mainContent,
    appContent,
    history,
    service,
    app,
  };
}

describe('POST /project/router/install [WP-4.00]', () => {
  it('B1: POST /project/router/install creates src/routes.tsx, updates main.tsx and package.json, returns jobId, and findRouter returns status found [WP-4.00]', async () => {
    const t = await setupNoRouterProject();
    try {
      const res = await t.app.inject({
        method: 'POST',
        url: '/api/v1/project/router/install',
      });
      expect(res.statusCode).toBe(202);
      const body = res.json<{ data: { jobId: string } }>();
      expect(body.data.jobId).toBeTruthy();

      const routesText = await readFile(join(t.projectDir, 'src/routes.tsx'), 'utf8');
      expect(routesText).toContain("import { createBrowserRouter } from 'react-router';");
      expect(routesText).toContain("import { App } from './App.tsx';");
      expect(routesText).toContain("path: '/'");
      expect(routesText).toContain('element: <App />');

      const mainText = await readFile(join(t.projectDir, 'src/main.tsx'), 'utf8');
      expect(mainText).toContain("import { RouterProvider } from 'react-router';");
      expect(mainText).toContain("import { router } from './routes.tsx';");
      expect(mainText).toContain('<RouterProvider router={router} />');
      expect(mainText).not.toContain('<App />');

      const pkgText = await readFile(join(t.projectDir, 'package.json'), 'utf8');
      const pkg = JSON.parse(pkgText) as { dependencies: Record<string, string> };
      expect(pkg.dependencies['react-router']).toBe('7.18.4');

      const router = await findRouter(nodeFs, t.projectDir, 'src');
      expect(router).toMatchObject({
        status: 'found',
        file: 'src/routes.tsx',
        kind: 'dataRouter',
        chosen: false,
      });
    } finally {
      await t.app.close();
      await t.cleanup();
    }
  });

  it('B2: Undo one step after router install deletes src/routes.tsx and restores main.tsx and package.json byte-for-byte [WP-4.00]', async () => {
    const t = await setupNoRouterProject();
    try {
      const res = await t.app.inject({
        method: 'POST',
        url: '/api/v1/project/router/install',
      });
      expect(res.statusCode).toBe(202);
      expect(t.history.getState().undo).toEqual({ key: 'history:routerInstall' });

      const undoRes = await t.history.undo(t.projectDir);
      expect(undoRes.ok).toBe(true);

      expect(await nodeFs.exists(t.projectDir, 'src/routes.tsx')).toBe(false);
      expect(await readFile(join(t.projectDir, 'src/main.tsx'), 'utf8')).toBe(t.mainContent);
      expect(await readFile(join(t.projectDir, 'package.json'), 'utf8')).toBe(t.pkgContent);
    } finally {
      await t.app.close();
      await t.cleanup();
    }
  });

  it('B3: main.tsx with .render(renderApp()) or complex providers returns E016 routerEntryUnknown and leaves all files untouched [WP-4.00]', async () => {
    const complexMain = [
      "import { createRoot } from 'react-dom/client';",
      "import { App } from './App.tsx';",
      'function renderApp() { return <App />; }',
      "createRoot(document.getElementById('root')!).render(renderApp());",
      '',
    ].join('\n');
    const t = await setupNoRouterProject({ mainContent: complexMain });
    try {
      const res = await t.app.inject({
        method: 'POST',
        url: '/api/v1/project/router/install',
      });
      expect(res.statusCode).toBe(400);
      expect(res.json()).toMatchObject({
        error: { code: 'E016', params: { reason: 'routerEntryUnknown' } },
      });

      expect(await nodeFs.exists(t.projectDir, 'src/routes.tsx')).toBe(false);
      expect(await readFile(join(t.projectDir, 'src/main.tsx'), 'utf8')).toBe(complexMain);
      expect(await readFile(join(t.projectDir, 'package.json'), 'utf8')).toBe(t.pkgContent);
    } finally {
      await t.app.close();
      await t.cleanup();
    }
  });

  it('B4: Project with react-router already in package.json (hasRouterPackage: true) does not rewrite package.json while creating src/routes.tsx and updating main.tsx [WP-4.00]', async () => {
    const t = await setupNoRouterProject({ hasRouterInPkg: true });
    try {
      const res = await t.app.inject({
        method: 'POST',
        url: '/api/v1/project/router/install',
      });
      expect(res.statusCode).toBe(202);

      expect(await nodeFs.exists(t.projectDir, 'src/routes.tsx')).toBe(true);
      expect(await readFile(join(t.projectDir, 'package.json'), 'utf8')).toBe(t.pkgContent);

      const undoRes = await t.history.undo(t.projectDir);
      expect(undoRes.ok).toBe(true);
      if (undoRes.ok) {
        expect(undoRes.value.files).toEqual(['src/routes.tsx', 'src/main.tsx']);
      }
    } finally {
      await t.app.close();
      await t.cleanup();
    }
  });

  it('opens an existing legacy workspace.json fixture without sessions or ai and returns normalized defaults in ProjectInfo [WP-4.00]', async () => {
    const temp = await makeTempDir();
    try {
      const fixtureRoot = resolve(process.cwd(), 'fixtures/projects/vite8-react19-ts');
      const legacyRaw = await readFile(join(fixtureRoot, '.kumicraft/workspace.json'), 'utf8');
      const projectDir = join(temp.dir, 'legacy');
      const configDir = join(temp.dir, 'config');
      await mkdir(join(projectDir, '.kumicraft'), { recursive: true });
      await mkdir(configDir, { recursive: true });
      await writeSupportedProject(projectDir);
      await writeFile(join(projectDir, '.kumicraft/workspace.json'), legacyRaw);

      const config = await createConfigStore({
        fs: nodeFs,
        dir: configDir,
        platform,
        logger: silentLogger,
      });
      const service = createProjectService({
        fs: nodeFs,
        system: fakeSystem(1, new Set([1])),
        process: fakeInstallProcess(),
        config,
        logger: silentLogger,
        port: 4321,
        platform,
        templateDir: temp.dir,
      });

      const opened = await service.open(projectDir);
      expect(opened.ok).toBe(true);
      if (opened.ok) {
        expect(opened.value.sessions).toEqual([{ id: 1, label: 'Phiên 1' }]);
        expect(opened.value.ai).toEqual({ allowEdits: true });
      }
    } finally {
      await temp.cleanup();
    }
  });
});
