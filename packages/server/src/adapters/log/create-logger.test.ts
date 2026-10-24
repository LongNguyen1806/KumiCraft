import { mkdtemp, readdir, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { createServerLogger } from './create-logger.ts';
import { createRotatingFile, LOG_FILE_NAME } from './rotating-file.ts';

let dir: string;

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), 'kumicraft-log-'));
});

afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

describe('createRotatingFile', () => {
  it('rotates by size and keeps a fixed number of files [S-88]', async () => {
    const file = createRotatingFile(dir, 100, 3);

    for (let i = 0; i < 20; i++) file.write(`${'x'.repeat(30)}\n`);
    file.close();

    const names = (await readdir(dir)).sort();
    expect(names).toEqual([LOG_FILE_NAME, `${LOG_FILE_NAME}.1`, `${LOG_FILE_NAME}.2`]);
    for (const name of names)
      expect((await readFile(join(dir, name))).length).toBeLessThanOrEqual(100);
  });
});

describe('createServerLogger', () => {
  it('redacts tokens, keys and authorization headers in terminal and file [S-89, S-36]', async () => {
    const lines: string[] = [];
    const logger = createServerLogger({
      level: 'info',
      logDir: dir,
      terminal: { write: (chunk) => lines.push(chunk) },
    });

    logger.port.info(
      {
        sessionToken: 'TOKEN-123',
        apiKey: 'sk-SECRET',
        nested: { token: 'NESTED' },
        req: { headers: { authorization: 'Bearer XYZ' } },
      },
      'started',
    );
    logger.close();

    const fileText = await readFile(join(dir, LOG_FILE_NAME), 'utf8');
    for (const text of [lines.join(''), fileText]) {
      expect(text).toContain('started');
      for (const secret of ['TOKEN-123', 'sk-SECRET', 'NESTED', 'Bearer XYZ'])
        expect(text).not.toContain(secret);
    }
  });

  it('keeps writing info to the file when the terminal is silent', async () => {
    const lines: string[] = [];
    const logger = createServerLogger({
      level: 'silent',
      logDir: dir,
      terminal: { write: (chunk) => lines.push(chunk) },
    });

    logger.port.child({ module: 'test' }).info({ n: 1 }, 'quiet');
    logger.close();

    expect(lines).toEqual([]);
    expect(await readFile(join(dir, LOG_FILE_NAME), 'utf8')).toContain('"module":"test"');
  });
});
