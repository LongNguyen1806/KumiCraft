import { mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { createNodeFileSystem } from '../../adapters/fs/node-file-system.ts';
import { toSupportedPlatform } from '../../kernel/session.ts';
import type { LoggerPort } from '../../ports/logger-port.ts';
import { CONFIG_FILE, createConfigStore } from './user-config.ts';

const platform = toSupportedPlatform(process.platform) ?? 'linux';
const warnings: string[] = [];
const logger: LoggerPort = {
  debug: () => undefined,
  info: () => undefined,
  warn: (_fields, message) => warnings.push(message),
  error: () => undefined,
  child: () => logger,
};

let dir: string;
const store = () =>
  createConfigStore({ fs: createNodeFileSystem(platform), dir, platform, logger });

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), 'kumicraft-config-'));
  warnings.length = 0;
});

afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

describe('createConfigStore', () => {
  it('starts from defaults without a config file', async () => {
    const settings = (await store()).settings();

    expect(settings).toEqual({ editor: 'vscode', agent: { preferred: 'auto' } });
    expect(warnings).toEqual([]);
  });

  it('merges patches, keeps untouched fields and persists them', async () => {
    const first = await store();
    await first.updateSettings({ language: 'vi', packageManager: 'pnpm' });
    const updated = await first.updateSettings({ editor: 'cursor', agent: { preferred: 'agy' } });

    expect(updated).toEqual({
      ok: true,
      value: {
        language: 'vi',
        editor: 'cursor',
        packageManager: 'pnpm',
        agent: { preferred: 'agy' },
      },
    });
    expect((await store()).settings()).toMatchObject({ language: 'vi', editor: 'cursor' });
  });

  it('saves the Studio theme and reads it back; unset means system [P5]', async () => {
    const first = await store();
    expect(first.settings().theme).toBeUndefined();
    const updated = await first.updateSettings({ theme: 'dark' });
    expect(updated.ok && updated.value.theme).toBe('dark');
    expect((await store()).settings().theme).toBe('dark');
  });

  it('writes the file readable by the user only on macOS and Linux', async () => {
    await (await store()).updateSettings({ language: 'en' });

    const mode = (await stat(join(dir, CONFIG_FILE))).mode & 0o777;
    if (platform !== 'win32') expect(mode).toBe(0o600);
  });

  it('remembers trusted projects by id, folder and links, outside the project [S-82]', async () => {
    const config = await store();
    const key = { id: 'ws00000001', path: 'C:\\Work\\Shop', links: '[]' };
    await config.setTrusted(key, true);

    expect(
      config.isTrusted({ ...key, path: platform === 'linux' ? key.path : 'c:\\work\\shop' }),
    ).toBe(true);
    expect(config.isTrusted({ ...key, id: 'ws00000002' })).toBe(false);
    expect(config.isTrusted({ ...key, path: 'C:\\Work\\Other' })).toBe(false);
    await config.setTrusted(key, false);
    expect((await store()).isTrusted(key)).toBe(false);
  });

  it('stops trusting a project whose links changed [S-84]', async () => {
    const config = await store();
    const key = { id: 'ws00000001', path: 'C:\\Work\\Shop', links: '["../api"]' };
    await config.setTrusted(key, true);

    expect((await store()).isTrusted({ ...key, links: '["C:/Windows"]' })).toBe(false);
    expect((await store()).isTrusted(key)).toBe(true);
  });

  it('falls back to defaults with a warning when the file is broken', async () => {
    await writeFile(join(dir, CONFIG_FILE), '{ not json');

    expect((await store()).settings().editor).toBe('vscode');
    expect(warnings).toHaveLength(1);
  });

  it('reads a 0.18 file: keeps the language, drops AI keys and old trust at the next write [V-107, V-108]', async () => {
    await writeFile(
      join(dir, CONFIG_FILE),
      JSON.stringify({
        language: 'vi',
        ai: { provider: 'openai', keys: { openai: 'sk-stored' } },
        export: { typecheck: true, buildCheck: false },
        trustedWorkspaces: [{ id: 'old', path: '/w', links: '' }],
      }),
    );

    const config = await store();
    await config.updateSettings({ editor: 'zed' });
    const text = await readFile(join(dir, CONFIG_FILE), 'utf8');

    expect(config.settings()).toEqual({
      language: 'vi',
      editor: 'zed',
      agent: { preferred: 'auto' },
    });
    expect(warnings).toEqual([]);
    expect(text).not.toContain('sk-stored');
    expect(text).not.toContain('trustedWorkspaces');
  });
});

describe('recent projects [R-PJ-25]', () => {
  it('puts the last opened project first, without duplicates, at most 8, and keeps them across runs', async () => {
    const config = await store();
    for (let i = 0; i < 9; i++) {
      expect((await config.rememberProject(join(dir, `p${String(i)}`), `P${String(i)}`)).ok).toBe(
        true,
      );
    }
    await config.rememberProject(join(dir, 'p5'), 'P5 again');

    const again = await store();
    const list = again.recentProjects();
    expect(list.map((r) => r.name)).toEqual(['P5 again', 'P8', 'P7', 'P6', 'P4', 'P3', 'P2', 'P1']);
    expect(list[0]?.path).toBe(join(dir, 'p5'));
  });
  it('forgets one project, keeps the others and that across runs', async () => {
    const config = await store();
    await config.rememberProject(join(dir, 'a'), 'A');
    await config.rememberProject(join(dir, 'b'), 'B');
    expect((await config.forgetProject(join(dir, 'a'))).ok).toBe(true);

    const again = await store();
    expect(again.recentProjects().map((r) => r.name)).toEqual(['B']);
  });
});
