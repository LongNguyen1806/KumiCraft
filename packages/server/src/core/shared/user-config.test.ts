import { mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { createNodeFileSystem } from '../../adapters/fs/node-file-system.ts';
import type { LoggerPort } from '../ports/logger-port.ts';
import { toSupportedPlatform } from './session.ts';
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
const store = (env: Record<string, string> = {}) =>
  createConfigStore({ fs: createNodeFileSystem(platform), dir, platform, env, logger });

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), 'reactcraft-config-'));
  warnings.length = 0;
});

afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

describe('createConfigStore', () => {
  it('starts from defaults without a config file', async () => {
    const settings = (await store()).settings();

    expect(settings).toEqual({
      ai: {
        ollamaBaseUrl: 'http://127.0.0.1:11434',
        keys: { openai: 'missing', anthropic: 'missing', deepseek: 'missing', ollama: 'missing' },
      },
      export: { typecheck: true, buildCheck: false },
    });
    expect(warnings).toEqual([]);
  });

  it('merges patches, keeps untouched fields and persists them', async () => {
    const first = await store();
    await first.updateSettings({ language: 'vi', export: { buildCheck: true } });
    const updated = await first.updateSettings({ ai: { model: 'gpt-x' } });

    expect(updated).toMatchObject({
      ok: true,
      value: {
        language: 'vi',
        ai: { model: 'gpt-x' },
        export: { typecheck: true, buildCheck: true },
      },
    });
    expect((await store()).settings()).toMatchObject({
      language: 'vi',
      export: { buildCheck: true },
    });
  });

  it('writes the file readable by the user only on macOS and Linux', async () => {
    await (await store()).updateSettings({ language: 'en' });

    const mode = (await stat(join(dir, CONFIG_FILE))).mode & 0o777;
    if (platform !== 'win32') expect(mode).toBe(0o600);
  });

  it('remembers trusted workspaces by id, folder and links, outside the workspace [S-82]', async () => {
    const config = await store();
    const key = { id: 'ws00000001', path: 'C:\\Work\\Shop', links: '["",[]]' };
    await config.setTrusted(key, true);

    expect(
      config.isTrusted({ ...key, path: platform === 'linux' ? key.path : 'c:\\work\\shop' }),
    ).toBe(true);
    expect(config.isTrusted({ ...key, id: 'ws00000002' })).toBe(false);
    expect(config.isTrusted({ ...key, path: 'C:\\Work\\Other' })).toBe(false);
    await config.setTrusted(key, false);
    expect((await store()).isTrusted(key)).toBe(false);
  });

  it('stops trusting a workspace whose links changed [S-84]', async () => {
    const config = await store();
    const key = { id: 'ws00000001', path: 'C:\\Work\\Shop', links: '["../api",[]]' };
    await config.setTrusted(key, true);

    expect((await store()).isTrusted({ ...key, links: '["C:/Windows",[]]' })).toBe(false);
    expect((await store()).isTrusted(key)).toBe(true);
  });

  it('falls back to defaults with a warning when the file is broken', async () => {
    await writeFile(join(dir, CONFIG_FILE), '{ not json');

    expect((await store()).settings().export.typecheck).toBe(true);
    expect(warnings).toHaveLength(1);
  });

  it('reports keys from the environment and never returns key values', async () => {
    await writeFile(
      join(dir, CONFIG_FILE),
      JSON.stringify({ ai: { keys: { deepseek: 'sk-stored' } } }),
    );

    const settings = (await store({ OPENAI_API_KEY: 'sk-env' })).settings();

    expect(settings.ai.keys).toMatchObject({
      openai: 'fromEnv',
      deepseek: 'configured',
      anthropic: 'missing',
    });
    expect(JSON.stringify(settings)).not.toContain('sk-');
    expect(await readFile(join(dir, CONFIG_FILE), 'utf8')).toContain('sk-stored');
  });
});
