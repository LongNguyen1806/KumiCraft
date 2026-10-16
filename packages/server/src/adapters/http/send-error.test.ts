// The common error response and what it leaves in the log (SPEC-03 section 4.1, S-26).
import { Writable } from 'node:stream';

import Fastify from 'fastify';
import { afterEach, describe, expect, it } from 'vitest';

import { sendError } from './send-error.ts';

const lines: string[] = [];
const app = Fastify({
  logger: {
    level: 'warn',
    stream: new Writable({
      write(chunk: Buffer, _encoding, done) {
        lines.push(chunk.toString('utf8'));
        done();
      },
    }),
  },
});
app.get('/refused', (_request, reply) =>
  sendError(reply, { code: 'E012', params: { path: 'C:/Windows', reason: 'systemFolder' } }),
);
app.get('/missing', (_request, reply) => sendError(reply, { code: 'E015' }));

afterEach(() => {
  lines.length = 0;
});

describe('sendError', () => {
  it('answers a refused path with E012 and logs a warning with the normalized path [S-26]', async () => {
    const res = await app.inject({ method: 'GET', url: '/refused' });

    expect(res.statusCode).toBe(403);
    expect(res.json()).toMatchObject({
      error: { code: 'E012', params: { reason: 'systemFolder' } },
    });
    const warning = lines.map((line) => JSON.parse(line) as Record<string, unknown>);
    expect(warning).toHaveLength(1);
    expect(warning[0]).toMatchObject({
      level: 40,
      code: 'E012',
      path: 'C:/Windows',
      reason: 'systemFolder',
    });
  });

  it('does not log ordinary client errors', async () => {
    const res = await app.inject({ method: 'GET', url: '/missing' });

    expect(res.statusCode).toBe(404);
    expect(lines).toHaveLength(0);
  });
});
