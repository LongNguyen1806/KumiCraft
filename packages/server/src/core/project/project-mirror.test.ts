import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import {
  newWorkspaceFile,
  serializeWorkspaceFile,
  WORKSPACE_FILE,
  type WorkspaceFile,
} from '@reactcraft/shared';
import { describe, expect, it, vi } from 'vitest';

import { createNodeFileSystem } from '../../adapters/fs/node-file-system.ts';
import { manifestRelPath, mirrorRelDir } from '../mirror/mirror-manifest.ts';
import { createMirrorService } from '../mirror/mirror-service.ts';
import type { ProcessPort } from '../ports/process-port.ts';
import { createConfigStore } from '../shared/user-config.ts';
import {
  fakeSystem,
  makeTempDir,
  platform,
  silentLogger,
  writeSupportedProject,
} from '../workspace/test-support.ts';
import { trustKeyOf } from '../workspace/trust.ts';
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
  id: 'prj_mirror',
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

describe('ProjectService + Mirror [S-125, R-MR-02]', () => {
  it('trusted project creates mirror in background, untrusted does not, remove clears mirror [S-125, R-MR-02]', async () => {
    const { dir, cleanup } = await makeTempDir();
    try {
      const parentDir = join(dir, 'work');
      const frontendDir = join(parentDir, 'frontend');
      const apiDir = join(parentDir, 'api');
      const configDir = join(dir, 'config');
      const cacheDir = join(dir, 'cache');

      await mkdir(frontendDir, { recursive: true });
      await mkdir(apiDir, { recursive: true });
      await mkdir(configDir, { recursive: true });
      await mkdir(cacheDir, { recursive: true });

      await writeWorkspace(frontendDir);
      await writeFile(join(apiDir, 'server.py'), 'print("api running")');

      const fs = createNodeFileSystem(platform);
      const system = fakeSystem(1, new Set([1]));
      const configStore = await createConfigStore({
        fs,
        dir: configDir,
        platform,
        logger: silentLogger,
      });

      const mirrorService = createMirrorService({ fs, cacheDir, logger: silentLogger });

      const service = createProjectService({
        fs,
        system,
        process: fakeProcess,
        config: configStore,
        logger: silentLogger,
        port: 50235,
        platform,
        templateDir: dir,
        mirror: mirrorService,
      });

      // 1. Untrusted project: adding backend does NOT create a mirror
      await service.open(frontendDir);
      const untrustedAdd = await service.addBackend(apiDir, 'API Untrusted');
      expect(untrustedAdd.ok).toBe(true);
      if (!untrustedAdd.ok) return;

      const untrustedBackendId = untrustedAdd.value.id;
      // Mirror should not exist
      expect(await fs.exists(cacheDir, mirrorRelDir('prj_mirror', untrustedBackendId))).toBe(false);

      // Clean up backend for next test
      await service.removeBackend(untrustedBackendId);

      // 2. Mark project as trusted and re-open
      await configStore.setTrusted(trustKeyOf(sampleFile, frontendDir), true);
      await service.open(frontendDir);

      // 3. Trusted project: adding backend triggers background refresh
      const trustedAdd = await service.addBackend(apiDir, 'API Trusted');
      expect(trustedAdd.ok).toBe(true);
      if (!trustedAdd.ok) return;

      const backendId = trustedAdd.value.id;

      // Wait for background mirror refresh to finish completely (manifest written last)
      await vi.waitFor(
        async () => {
          const exists = await fs.exists(cacheDir, manifestRelPath('prj_mirror', backendId));
          expect(exists).toBe(true);
        },
        { timeout: 3000, interval: 50 },
      );

      expect(await fs.exists(cacheDir, `${mirrorRelDir('prj_mirror', backendId)}/server.py`)).toBe(
        true,
      );

      // 4. Remove backend: mirror and manifest are removed
      const removeRes = await service.removeBackend(backendId);
      expect(removeRes.ok).toBe(true);

      expect(await fs.exists(cacheDir, mirrorRelDir('prj_mirror', backendId))).toBe(false);
      expect(await fs.exists(cacheDir, manifestRelPath('prj_mirror', backendId))).toBe(false);

      await service.close();
    } finally {
      await cleanup();
    }
  });
});
