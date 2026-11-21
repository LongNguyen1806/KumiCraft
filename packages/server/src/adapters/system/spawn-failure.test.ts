// A command that cannot start (Mac E021 report, 2026-11-21): the job gets exit 127 and the reason,
// never a crash; a file without `#!` (pnpm 12 before its install script ran) runs like in a shell.
// The GitHub Mac workflow runs this file too.
import { chmod, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { fileKindOf, installedOf, type MachineInfo, withoutHome } from './machine-info.ts';
import { createNodeProcess } from './node-process.ts';

const isWin = process.platform === 'win32';

describe('a command that cannot start', () => {
  it('ends with 127 and says ENOENT when it is not on the PATH', async () => {
    const handle = createNodeProcess().spawn('kumicraft-no-such-command-kc', ['install'], {
      cwd: tmpdir(),
    });
    const out = await handle.wait();
    expect(out.exitCode).toBe(127);
    expect(out.spawnError).toBe('ENOENT');
  });

  it('ends with 127 when Node throws at once, instead of crashing the job', async () => {
    // A NUL byte makes Node throw inside spawn(), as ENOEXEC does on macOS.
    const handle = createNodeProcess().spawn('bad\0name', [], { cwd: tmpdir() });
    const out = await handle.wait();
    expect(out.exitCode).toBe(127);
    expect(out.spawnError).toMatch(/^ERR_|^E/);
  });

  it.skipIf(isWin)('runs a file without #! through /bin/sh, arguments kept apart', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'kc-noshebang-'));
    try {
      const script = join(dir, 'fake-pnpm');
      await writeFile(script, 'echo "ran:$1|$2"\n');
      await chmod(script, 0o755);
      const handle = createNodeProcess().spawn(script, ['a b', '$HOME'], { cwd: dir });
      const out = await handle.wait();
      expect(out.exitCode).toBe(0);
      expect(out.stdout.trim()).toBe('ran:a b|$HOME');
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});

describe('machine info for the log file', () => {
  it('tells a program from a script and from a file without #!', () => {
    expect(fileKindOf(new Uint8Array([0xcf, 0xfa, 0xed, 0xfe]))).toBe('binary');
    expect(fileKindOf(new Uint8Array([0x7f, 0x45, 0x4c, 0x46]))).toBe('binary');
    expect(fileKindOf(new TextEncoder().encode('#!/u'))).toBe('script');
    expect(fileKindOf(new TextEncoder().encode('# pn'))).toBe('textWithoutShebang');
  });

  it('writes the home folder as ~, so no user name reaches the log', () => {
    expect(withoutHome('/Users/an/.npm-global/bin/pnpm', '/Users/an')).toBe(
      '~/.npm-global/bin/pnpm',
    );
    expect(withoutHome('/usr/local/bin/pnpm', '/Users/an')).toBe('/usr/local/bin/pnpm');
  });

  it('falls back to the first package manager that answered', () => {
    const info: MachineInfo = {
      pnpm: { exitCode: 127, spawnError: 'ENOENT' },
      npm: { version: '11.6.0' },
      yarn: { version: '1.22.22' },
      bun: {},
    };
    expect(installedOf(info)).toBe('npm');
    expect(installedOf({ ...info, npm: {}, yarn: {} })).toBeUndefined();
  });
});
