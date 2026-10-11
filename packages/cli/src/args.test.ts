import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

import { parseCliArgs } from './args.ts';

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
  ])('rejects invalid arguments %j', (argv) => {
    expect(parseCliArgs(argv, CWD).ok).toBe(false);
  });
});
