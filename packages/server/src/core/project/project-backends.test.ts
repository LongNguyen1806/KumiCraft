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
import type { ProcessPort } from '../ports/process-port.ts';
import { createConfigStore } from '../shared/user-config.ts';
import {
  fakeSystem,
  makeTempDir,
  nodeFs,
  platform,
  silentLogger,
  writeSupportedProject,
} from '../workspace/test-support.ts';
import { computeBackendInfos } from './project-backends.ts';
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

describe('project backends [S-83, R-PJ-14]', () => {
  it('marks a backend in a system folder as blocked even when trusted [S-83]', async () => {
    const file: WorkspaceFile = {
      ...newWorkspaceFile({
        id: 'proj000001',
        name: 'Frontend',
        createdAt: '2026-10-14T08:00:00.000Z',
        responsiveMode: 'desktop-first',
      }),
      backends: [{ id: 'back000001', path: '/etc', label: 'etc' }],
    };

    const infos = await computeBackendInfos(nodeFs, '/work/app', file, 'linux');
    expect(infos).toEqual([
      {
        id: 'back000001',
        path: '/etc',
        label: 'etc',
        status: 'blocked',
        resolvedPath: '/etc',
        outsideParent: true,
      },
    ]);
  });

  it('refuses a duplicate backend and an eleventh one [R-PJ-14]', async () => {
    const { dir, cleanup } = await makeTempDir();
    try {
      const parentDir = join(dir, 'work');
      const frontendDir = join(parentDir, 'frontend');
      const apiDir = join(parentDir, 'api');
      const configDir = join(dir, 'config');
      await mkdir(frontendDir, { recursive: true });
      await mkdir(apiDir, { recursive: true });
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

      const firstAdd = await service.addBackend(apiDir);
      expect(firstAdd.ok).toBe(true);

      const dupAdd = await service.addBackend(apiDir);
      expect(dupAdd).toEqual({
        ok: false,
        error: { code: 'E016', params: { reason: 'duplicateBackend' } },
      });

      for (let i = 1; i <= 9; i++) {
        const biDir = join(parentDir, `b${String(i)}`);
        await mkdir(biDir, { recursive: true });
        const add = await service.addBackend(biDir);
        expect(add.ok).toBe(true);
      }

      const b10Dir = join(parentDir, 'b10');
      await mkdir(b10Dir, { recursive: true });
      const eleventhAdd = await service.addBackend(b10Dir);
      expect(eleventhAdd).toEqual({
        ok: false,
        error: { code: 'E016', params: { reason: 'maxBackendsExceeded' } },
      });
    } finally {
      await cleanup();
    }
  });
});
