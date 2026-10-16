// Tests for ProjectService: lifecycle, backend paths (V-03, V-04, V-05, R-PJ-14).
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import {
  newWorkspaceFile,
  serializeWorkspaceFile,
  WORKSPACE_FILE,
  type WorkspaceFile,
} from '@reactcraft/shared';
import { describe, expect, it } from 'vitest';

import { createNodeFileSystem } from '../../adapters/fs/node-file-system.ts';
import { resolveTemplateDir } from '../../index.ts';
import type { ProcessPort } from '../ports/process-port.ts';
import { ok } from '../shared/result.ts';
import { createConfigStore } from '../shared/user-config.ts';
import {
  fakeSystem,
  makeTempDir,
  platform,
  silentLogger,
  writeSupportedProject,
} from '../workspace/test-support.ts';
import { createProjectService } from './project-service.ts';

const fakeProcess: ProcessPort = {
  spawn: () => ({
    pid: 1234,
    onLine: () => undefined,
    wait: () => Promise.resolve({ exitCode: 0, stdout: '', stderr: '', lines: [] }),
    kill: () => Promise.resolve(),
  }),
};

const sampleFile: WorkspaceFile = newWorkspaceFile({
  id: 'proj000001',
  name: 'Frontend',
  createdAt: '2026-10-14T08:00:00.000Z',
  responsiveMode: 'desktop-first',
  framework: 'vite-react',
});

async function writeWorkspace(dir: string, file: WorkspaceFile = sampleFile): Promise<void> {
  await writeSupportedProject(dir);
  await mkdir(join(dir, '.reactcraft'), { recursive: true });
  await writeFile(join(dir, WORKSPACE_FILE), serializeWorkspaceFile(file));
}

describe('ProjectService backends', () => {
  it('stores relative path for sister backend under parent directory [V-03]', async () => {
    const { dir, cleanup } = await makeTempDir();
    try {
      const parentDir = join(dir, 'work');
      const frontendDir = join(parentDir, 'frontend');
      const backendDir = join(parentDir, 'shop-api');
      const configDir = join(dir, 'config');
      await mkdir(frontendDir, { recursive: true });
      await mkdir(backendDir, { recursive: true });
      await mkdir(configDir, { recursive: true });
      await writeWorkspace(frontendDir);

      const fs = createNodeFileSystem(platform);
      const system = fakeSystem(1, new Set([1]));
      const configStore = await createConfigStore({
        fs,
        dir: configDir,
        platform,
        logger: silentLogger,
      });

      const service = createProjectService({
        fs,
        system,
        process: fakeProcess,
        config: configStore,
        logger: silentLogger,
        port: 50234,
        platform,
        templateDir: dir,
      });

      const openRes = await service.open(frontendDir);
      expect(openRes.ok).toBe(true);

      const addRes = await service.addBackend(backendDir, 'Shop API');
      expect(addRes.ok).toBe(true);
      if (!addRes.ok) return;

      expect(addRes.value.path).toBe('../shop-api');
      expect(addRes.value.status).toBe('ok');

      const infoRes = service.getProjectInfo();
      expect(infoRes.ok).toBe(true);
      if (!infoRes.ok) return;
      expect(infoRes.value.backends[0]?.path).toBe('../shop-api');
      expect(infoRes.value.backends[0]?.status).toBe('ok');
    } finally {
      await cleanup();
    }
  });

  it('stores absolute path for backend outside parent directory [V-04]', async () => {
    const { dir, cleanup } = await makeTempDir();
    try {
      const frontendDir = join(dir, 'work', 'frontend');
      const externalBackendDir = join(dir, 'other-place', 'analytics-api');
      const configDir = join(dir, 'config');
      await mkdir(frontendDir, { recursive: true });
      await mkdir(externalBackendDir, { recursive: true });
      await mkdir(configDir, { recursive: true });
      await writeWorkspace(frontendDir);

      const fs = createNodeFileSystem(platform);
      const system = fakeSystem(1, new Set([1]));
      const configStore = await createConfigStore({
        fs,
        dir: configDir,
        platform,
        logger: silentLogger,
      });

      const service = createProjectService({
        fs,
        system,
        process: fakeProcess,
        config: configStore,
        logger: silentLogger,
        port: 50234,
        platform,
        templateDir: dir,
      });

      await service.open(frontendDir);
      const addRes = await service.addBackend(externalBackendDir);
      expect(addRes.ok).toBe(true);
      if (!addRes.ok) return;

      expect(addRes.value.path.startsWith('..')).toBe(false);
      expect(addRes.value.status).toBe('ok');
    } finally {
      await cleanup();
    }
  });

  it('reports missing status when backend folder does not exist [V-05]', async () => {
    const { dir, cleanup } = await makeTempDir();
    try {
      const parentDir = join(dir, 'work');
      const frontendDir = join(parentDir, 'frontend');
      const backendDir = join(parentDir, 'temp-api');
      const configDir = join(dir, 'config');
      await mkdir(frontendDir, { recursive: true });
      await mkdir(backendDir, { recursive: true });
      await mkdir(configDir, { recursive: true });
      await writeWorkspace(frontendDir);

      const fs = createNodeFileSystem(platform);
      const system = fakeSystem(1, new Set([1]));
      const configStore = await createConfigStore({
        fs,
        dir: configDir,
        platform,
        logger: silentLogger,
      });

      const service = createProjectService({
        fs,
        system,
        process: fakeProcess,
        config: configStore,
        logger: silentLogger,
        port: 50234,
        platform,
        templateDir: dir,
      });

      await service.open(frontendDir);
      const addRes = await service.addBackend(backendDir);
      expect(addRes.ok).toBe(true);

      // Now remove the backend folder from disk
      await fs.remove(backendDir, '.');

      // Re-open the project, backend should have status: 'missing'
      const reOpen = await service.open(frontendDir);
      expect(reOpen.ok).toBe(true);
      if (!reOpen.ok) return;

      expect(reOpen.value.backends[0]?.status).toBe('missing');
    } finally {
      await cleanup();
    }
  });

  it('computes resolvedPath and outsideParent: false for sibling backend [S-80]', async () => {
    const { dir, cleanup } = await makeTempDir();
    try {
      const parentDir = join(dir, 'work');
      const frontendDir = join(parentDir, 'shop');
      const backendDir = join(parentDir, 'api');
      const configDir = join(dir, 'config');
      await mkdir(frontendDir, { recursive: true });
      await mkdir(backendDir, { recursive: true });
      await mkdir(configDir, { recursive: true });
      await writeWorkspace(frontendDir);

      const fs = createNodeFileSystem(platform);
      const system = fakeSystem(1, new Set([1]));
      const configStore = await createConfigStore({
        fs,
        dir: configDir,
        platform,
        logger: silentLogger,
      });

      const service = createProjectService({
        fs,
        system,
        process: fakeProcess,
        config: configStore,
        logger: silentLogger,
        port: 50234,
        platform,
        templateDir: dir,
      });

      await service.open(frontendDir);
      await service.addBackend(backendDir, 'Shop API');

      const reOpen = await service.open(frontendDir);
      expect(reOpen.ok).toBe(true);
      if (!reOpen.ok) return;

      const expectedResolved = backendDir.replaceAll('\\', '/');
      expect(reOpen.value.backends[0]?.resolvedPath).toBe(expectedResolved);
      expect(reOpen.value.backends[0]?.outsideParent).toBe(false);
    } finally {
      await cleanup();
    }
  });

  it('computes outsideParent: true and resolvedPath for backend outside parent [S-80]', async () => {
    const { dir, cleanup } = await makeTempDir();
    try {
      const frontendDir = join(dir, 'work', 'shop');
      const externalBackendDir = join(dir, 'other-place', 'analytics-api');
      const configDir = join(dir, 'config');
      await mkdir(frontendDir, { recursive: true });
      await mkdir(externalBackendDir, { recursive: true });
      await mkdir(configDir, { recursive: true });
      await writeWorkspace(frontendDir);

      const fs = createNodeFileSystem(platform);
      const system = fakeSystem(1, new Set([1]));
      const configStore = await createConfigStore({
        fs,
        dir: configDir,
        platform,
        logger: silentLogger,
      });

      const service = createProjectService({
        fs,
        system,
        process: fakeProcess,
        config: configStore,
        logger: silentLogger,
        port: 50234,
        platform,
        templateDir: dir,
      });

      await service.open(frontendDir);
      await service.addBackend(externalBackendDir, 'Analytics API');

      const reOpen = await service.open(frontendDir);
      expect(reOpen.ok).toBe(true);
      if (!reOpen.ok) return;

      const expectedResolved = externalBackendDir.replaceAll('\\', '/');
      expect(reOpen.value.backends[0]?.resolvedPath).toBe(expectedResolved);
      expect(reOpen.value.backends[0]?.outsideParent).toBe(true);
    } finally {
      await cleanup();
    }
  });

  it('returns resolvedPath and outsideParent when adding backend [S-80]', async () => {
    const { dir, cleanup } = await makeTempDir();
    try {
      const parentDir = join(dir, 'work');
      const frontendDir = join(parentDir, 'shop');
      const backendDir = join(parentDir, 'api');
      const configDir = join(dir, 'config');
      await mkdir(frontendDir, { recursive: true });
      await mkdir(backendDir, { recursive: true });
      await mkdir(configDir, { recursive: true });
      await writeWorkspace(frontendDir);

      const fs = createNodeFileSystem(platform);
      const system = fakeSystem(1, new Set([1]));
      const configStore = await createConfigStore({
        fs,
        dir: configDir,
        platform,
        logger: silentLogger,
      });

      const service = createProjectService({
        fs,
        system,
        process: fakeProcess,
        config: configStore,
        logger: silentLogger,
        port: 50234,
        platform,
        templateDir: dir,
      });

      await service.open(frontendDir);
      const addRes = await service.addBackend(backendDir, 'Shop API');
      expect(addRes.ok).toBe(true);
      if (!addRes.ok) return;

      const expectedResolved = backendDir.replaceAll('\\', '/');
      expect(addRes.value.resolvedPath).toBe(expectedResolved);
      expect(addRes.value.outsideParent).toBe(false);
    } finally {
      await cleanup();
    }
  });
});

describe('ProjectService package manager resolution [R-PJ-05]', () => {
  it('create with pnpm on empty folder sets pnpm, installCommand, and install succeeds [R-PJ-05]', async () => {
    const { dir, cleanup } = await makeTempDir();
    try {
      const target = join(dir, 'shop');
      const fs = createNodeFileSystem(platform);
      const system = fakeSystem(1, new Set([1]));
      let trusted = false;
      const config = {
        isTrusted: () => trusted,
        setTrusted: (_key: unknown, value: boolean) => {
          trusted = value;
          return Promise.resolve(ok(undefined));
        },
        settings: () => ({ editor: 'vscode' as const, agent: { preferred: 'auto' as const } }),
      };

      const service = createProjectService({
        fs,
        system,
        process: fakeProcess,
        config,
        logger: silentLogger,
        port: 50301,
        platform,
        templateDir: resolveTemplateDir(),
      });

      const createRes = await service.create(target, 'Shop', 'pnpm');
      expect(createRes.ok).toBe(true);
      if (!createRes.ok) return;

      expect(createRes.value.support.packageManager).toBe('pnpm');
      expect(createRes.value.installCommand).toEqual(['pnpm', 'install']);

      await service.setTrusted(true);
      const installRes = await service.install(['pnpm', 'install']);
      expect(installRes.ok).toBe(true);
      expect(installRes).not.toMatchObject({ error: { code: 'E021' } });
    } finally {
      await cleanup();
    }
  });

  it('no lock file, not chosen on create, settings.packageManager yarn resolves yarn [R-PJ-05]', async () => {
    const { dir, cleanup } = await makeTempDir();
    try {
      const target = join(dir, 'shop');
      await writeSupportedProject(target);

      const fs = createNodeFileSystem(platform);
      const system = fakeSystem(1, new Set([1]));
      const config = {
        isTrusted: () => true,
        setTrusted: () => Promise.resolve(ok(undefined)),
        settings: () => ({
          editor: 'vscode' as const,
          packageManager: 'yarn' as const,
          agent: { preferred: 'auto' as const },
        }),
      };

      const service = createProjectService({
        fs,
        system,
        process: fakeProcess,
        config,
        logger: silentLogger,
        port: 50302,
        platform,
        templateDir: resolveTemplateDir(),
      });

      const openRes = await service.open(target);
      expect(openRes.ok).toBe(true);
      if (!openRes.ok) return;

      expect(openRes.value.support.packageManager).toBe('yarn');
      expect(openRes.value.installCommand).toEqual(['yarn', 'install']);
    } finally {
      await cleanup();
    }
  });

  it('has pnpm-lock.yaml but create picked npm: lock file takes precedence as pnpm [R-PJ-05]', async () => {
    const { dir, cleanup } = await makeTempDir();
    try {
      const target = join(dir, 'shop');
      const fs = createNodeFileSystem(platform);
      const system = fakeSystem(1, new Set([1]));
      const config = {
        isTrusted: () => true,
        setTrusted: () => Promise.resolve(ok(undefined)),
        settings: () => ({ editor: 'vscode' as const, agent: { preferred: 'auto' as const } }),
      };

      const service = createProjectService({
        fs,
        system,
        process: fakeProcess,
        config,
        logger: silentLogger,
        port: 50303,
        platform,
        templateDir: resolveTemplateDir(),
      });

      const createRes = await service.create(target, 'Shop', 'npm');
      expect(createRes.ok).toBe(true);

      // Add pnpm-lock.yaml into the project
      await writeFile(join(target, 'pnpm-lock.yaml'), '');

      // Re-open in the same session
      const reOpen = await service.open(target);
      expect(reOpen.ok).toBe(true);
      if (!reOpen.ok) return;

      expect(reOpen.value.support.packageManager).toBe('pnpm');
      expect(reOpen.value.installCommand).toEqual(['pnpm', 'install']);
    } finally {
      await cleanup();
    }
  });

  it('no lock file, not chosen, no settings: packageManager undefined and install returns E021 [R-PJ-05]', async () => {
    const { dir, cleanup } = await makeTempDir();
    try {
      const target = join(dir, 'shop');
      await writeSupportedProject(target);

      const fs = createNodeFileSystem(platform);
      const system = fakeSystem(1, new Set([1]));
      const config = {
        isTrusted: () => true,
        setTrusted: () => Promise.resolve(ok(undefined)),
        settings: () => ({ editor: 'vscode' as const, agent: { preferred: 'auto' as const } }),
      };

      const service = createProjectService({
        fs,
        system,
        process: fakeProcess,
        config,
        logger: silentLogger,
        port: 50304,
        platform,
        templateDir: resolveTemplateDir(),
      });

      const openRes = await service.open(target);
      expect(openRes.ok).toBe(true);
      if (!openRes.ok) return;

      expect(openRes.value.support.packageManager).toBeUndefined();
      expect(openRes.value.installCommand).toBeUndefined();

      const installRes = await service.install(['pnpm', 'install']);
      expect(installRes).toMatchObject({
        ok: false,
        error: { code: 'E021', params: { missing: 'packageManager' } },
      });
    } finally {
      await cleanup();
    }
  });
});
