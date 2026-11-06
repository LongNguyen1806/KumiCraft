// PB-05 and PB-04 (K9 C6): the built CLI starts and serves a ready Studio within 2 s; the Vite
// runner of the installed TS fixture goes from `starting` to `ready` within 15 s.
import { expect, test } from '@playwright/test';

import { startCli } from '../support/cli-session.ts';
import { copyFixture, makeTempDir } from '../support/copy-fixture.ts';

test.use({ trace: 'off' });

function runnerState(body: unknown): string | undefined {
  if (!(body instanceof Object) || !('data' in body)) return undefined;
  const data: unknown = body.data;
  if (!(data instanceof Object) || !('state' in data)) return undefined;
  return typeof data.state === 'string' ? data.state : undefined;
}

test('PB-05 and PB-04: CLI to a ready Studio ≤ 2 s; Vite runner starting → ready ≤ 15 s [WP-4.00]', async ({
  page,
}) => {
  test.setTimeout(120_000);
  const folder = await copyFixture('projects/vite8-react19-ts');
  const config = await makeTempDir('perf-startup');
  try {
    const started = Date.now();
    const session = await startCli(folder.path, config.path);
    // Ready = the Studio page loaded and its session call answered.
    const sessionCall = page.waitForResponse((res) => res.url().includes('/api/v1/session'));
    await page.goto(session.studioUrl);
    expect((await sessionCall).ok()).toBe(true);
    const cliToStudio = Date.now() - started;

    await session.api('project/trust', 'POST', { trusted: true });
    let startingAt: number | undefined;
    let readyAt: number | undefined;
    const deadline = Date.now() + 60_000;
    while (readyAt === undefined && Date.now() < deadline) {
      const state = runnerState(await session.api('runner'));
      if (state === 'starting' && startingAt === undefined) startingAt = Date.now();
      if (state === 'ready') readyAt = Date.now();
      else await page.waitForTimeout(50);
    }
    await session.stop();
    expect(readyAt).toBeDefined();
    const runnerReady = (readyAt ?? 0) - (startingAt ?? readyAt ?? 0);
    process.stdout.write(
      `PB-05 cli→studio ms: ${String(cliToStudio)}, PB-04 runner ms: ${String(runnerReady)}\n`,
    );
    expect(cliToStudio).toBeLessThanOrEqual(2000);
    expect(runnerReady).toBeLessThanOrEqual(15_000);
  } finally {
    await folder.remove();
    await config.remove();
  }
});
