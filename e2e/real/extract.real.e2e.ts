// K9.5, FR-72: "Create component" on COPIES of real projects (`pnpm test:real`). KC_REAL_EXTRACT
// lists `appDir|loc|tag|Name` entries separated by `;`. For each: extract through the API, the
// new component takes the old one's names as props, the project still builds (the build check),
// and Undo gives every file back. The copy is always put back as it started.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { expect, test } from '@playwright/test';

import { type CliSession, startCli } from '../support/cli-session.ts';
import { makeTempDir } from '../support/copy-fixture.ts';
import { backup, changedSince, restore, snapshot } from './real-files.ts';

const ENTRIES = (process.env.KC_REAL_EXTRACT ?? '')
  .split(';')
  .map((e) => e.trim().split('|'))
  .filter((parts) => parts.length === 4);

test.use({ trace: 'off' });

function dataOf(body: unknown): unknown {
  return body instanceof Object && 'data' in body ? body.data : body;
}

/** The build check's result: `{ ok, problems, … }` once the job ended. */
async function buildCheck(session: CliSession): Promise<unknown> {
  const started = dataOf(await session.api('project/build-check', 'POST', {}));
  const jobId = started instanceof Object && 'jobId' in started ? String(started.jobId) : '';
  for (let i = 0; i < 240; i++) {
    const status = dataOf(await session.api(`jobs/${jobId}`));
    const state = status instanceof Object && 'state' in status ? status.state : 'running';
    if (state !== 'running') {
      return status instanceof Object && 'result' in status ? status.result : status;
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  return 'build check timed out';
}

const okOf = (result: unknown) => (result instanceof Object && 'ok' in result ? result.ok : 'none');

for (const [appDir = '', loc = '', tag = '', name = ''] of ENTRIES) {
  test(`extract ${name} from ${loc} in ${appDir} [K9.5, FR-72]`, async () => {
    test.setTimeout(10 * 60_000);
    const base = snapshot(appDir);
    const saved = backup(appDir);
    const config = await makeTempDir('real-extract');
    let session: CliSession | undefined;
    try {
      session = await startCli(appDir, config.path);
      await session.api('project/trust', 'POST', { trusted: true });
      const before = await buildCheck(session);
      process.stdout.write(`[real] build before: ${JSON.stringify(before)}\n`);

      const res = dataOf(
        await session.api('project/components/extract', 'POST', { loc, tag, name }),
      );
      process.stdout.write(`[real] extract: ${JSON.stringify(res)}\n`);
      const changed = changedSince(appDir, base).filter((f) => !f.startsWith('.kumicraft/'));
      process.stdout.write(`[real] files: ${JSON.stringify(changed)}\n`);
      const created = changed.find((f) => f.endsWith(`/${name}.tsx`) || f.endsWith(`/${name}.jsx`));
      expect(created, 'the new component file').toBeDefined();
      const text = readFileSync(join(appDir, created ?? ''), 'utf8');
      process.stdout.write(`[real] new file:\n${text}\n`);
      expect(text).toContain(`export function ${name}(`);

      const after = await buildCheck(session);
      process.stdout.write(`[real] build after: ${JSON.stringify(after)}\n`);
      expect(okOf(after), 'the project builds as before').toBe(okOf(before));

      await session.api('history/undo', 'POST', {});
      await expect
        .poll(() => changedSince(appDir, base).filter((f) => !f.startsWith('.kumicraft/')), {
          timeout: 15_000,
        })
        .toEqual([]);
    } finally {
      await session?.stop();
      await config.remove();
      const fixed = restore(appDir, saved);
      if (fixed.length > 0) process.stdout.write(`[real] restored: ${JSON.stringify(fixed)}\n`);
    }
  });
}
