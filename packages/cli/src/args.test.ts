import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

import { parseCliArgs, USAGE, USAGE_EXIT_CODE } from './args.ts';

const CWD = resolve('/work');

describe('parseCliArgs', () => {
  it('uses the current directory, a random port, opening and info logs by default', () => {
    expect(parseCliArgs([], CWD)).toEqual({
      ok: true,
      options: { workspaceDir: CWD, port: undefined, shouldOpen: true, logLevel: 'info' },
    });
  });

  it('reads the directory, port, --no-open and log level [S-02]', () => {
    const parsed = parseCliArgs(
      ['site', '--port', '51000', '--no-open', '--log-level', 'debug'],
      CWD,
    );

    expect(parsed).toEqual({
      ok: true,
      options: {
        workspaceDir: resolve(CWD, 'site'),
        port: 51000,
        shouldOpen: false,
        logLevel: 'debug',
      },
    });
  });

  it.each([
    [['--port', '80']],
    [['--port', 'abc']],
    [['--log-level', 'loud']],
    [['a', 'b']],
    [['--unknown']],
  ])('rejects invalid arguments %j [R-CL-01]', (argv) => {
    expect(parseCliArgs(argv, CWD).ok).toBe(false);
  });

  it.each([
    [['--help'], 'help'],
    [['-h'], 'help'],
    [['site', '--port', '51000', '--help'], 'help'],
    [['--version'], 'version'],
    [['-v'], 'version'],
  ])('%j asks to show the %s instead of starting [R-CL-01]', (argv, show) => {
    expect(parseCliArgs(argv, CWD)).toEqual({ ok: true, show });
  });

  it('documents every option in the usage and exits with code 2 on wrong arguments [R-CL-01]', () => {
    for (const option of [
      '[dir]',
      '--port <n>',
      '--no-open',
      '--log-level <level>',
      '--help',
      '--version',
    ]) {
      expect(USAGE).toContain(option);
    }
    expect(USAGE_EXIT_CODE).toBe(2);
  });
});
