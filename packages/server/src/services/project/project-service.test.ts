// Tests for ProjectService: package manager resolution (R-PJ-05).
import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { createNodeFileSystem } from '../../adapters/fs/node-file-system.ts';
import { resolveTemplateDir } from '../../index.ts';
import { ok } from '../../kernel/result.ts';
import type { ProcessPort } from '../../ports/process-port.ts';
import { STACKS } from '../../stacks/index.ts';
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
        stacks: STACKS,
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
        stacks: STACKS,
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
        stacks: STACKS,
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
        stacks: STACKS,
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
