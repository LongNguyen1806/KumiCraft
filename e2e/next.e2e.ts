// End-to-end tests for Next.js projects (03b section 1.6): Next 16 with app/ at the root
// (Turbopack) and Next 15 with src/app (webpack) run in the Canvas, an element is selected at its
// file and line, a class edit is written to the file, and Undo gives the file back byte for byte.
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

import { expect, test } from '@playwright/test';

import { type CliSession, startCli } from './support/cli-session.ts';
import { copyFixture, makeTempDir, type TempDir } from './support/copy-fixture.ts';
import { getCanvasFrame, trustIfAsked } from './support/trust.ts';

const SAMPLES = [
  { major: 16, page: 'app/page.jsx' },
  { major: 15, page: 'src/app/page.jsx' },
] as const;

for (const { major, page } of SAMPLES) {
  test.describe(`Next ${String(major)} + React 19 JS`, () => {
    let folder: TempDir;
    let config: TempDir;
    let session: CliSession | undefined;

    test.beforeEach(async ({ browserName }) => {
      folder = await copyFixture(`projects/next${String(major)}-react19-js`, { insideRepo: true });
      config = await makeTempDir(`next${String(major)}-config-${browserName}`);
    });

    test.afterEach(async () => {
      await session?.stop();
      session = undefined;
      await folder.remove();
      await config.remove();
    });

    test(`Next ${String(major)}: runs in the Canvas, edits a class, Undo restores the file [03b 1.6]`, async ({
      page: studio,
      browserName,
    }) => {
      test.setTimeout(120_000);
      session = await startCli(folder.path, config.path);
      await studio.goto(session.studioUrl);
      await trustIfAsked(studio);

      const canvas = await getCanvasFrame(studio);
      await expect(canvas.getByRole('heading', { name: 'Cửa hàng mẫu' })).toBeVisible({
        timeout: 60_000,
      });
      const target = canvas.locator('p.p-4.text-lg');
      await expect(target).toHaveAttribute('data-rc-loc', `${page}:5:7`);

      const file = join(folder.path, page);
      const original = await readFile(file, 'utf8');
      await target.click();
      await studio.getByTestId('raw-class-details').locator('summary').click();
      const input = studio.getByTestId('raw-class-input');
      await expect(input).toHaveValue('p-4 text-lg');
      await input.fill('p-4 text-lg p-8');
      await input.press('Enter');
      await expect
        .poll(() => readFile(file, 'utf8'), { timeout: 15_000 })
        .toContain('p-4 text-lg p-8');

      await input.blur();
      await studio.keyboard.press(browserName === 'webkit' ? 'Meta+z' : 'Control+z');
      await expect.poll(() => readFile(file, 'utf8'), { timeout: 15_000 }).toBe(original);
    });
  });
}
