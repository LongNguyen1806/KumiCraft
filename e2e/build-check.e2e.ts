// Build check in the real app (K9 C1, M-BC): the status bar button runs the project's tsc and
// vite build, lists the error at its file:line:col, marks the file in the tree, and after the fix
// says "Build OK"; the project's dist/ is never made.
import { existsSync } from 'node:fs';
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import { expect, test } from '@playwright/test';

import { type CliSession, startCli } from './support/cli-session.ts';
import { copyFixture, makeTempDir, type TempDir } from './support/copy-fixture.ts';
import { getCanvasFrame, trustIfAsked } from './support/trust.ts';
import { ui } from './support/ui-text.ts';

let folder: TempDir;
let config: TempDir;
const sessions: CliSession[] = [];

test.beforeEach(async ({ browserName }) => {
  folder = await copyFixture('projects/vite8-react19-ts');
  // The linked TypeScript is 6, which stops on the fixture's `baseUrl` (TS5101) as the project's
  // own `tsc -b` would; relative `paths` work without it.
  const tsconfig = join(folder.path, 'tsconfig.json');
  const text = (await readFile(tsconfig, 'utf8')).replace(/\s*"baseUrl": "\.",/, '');
  await writeFile(tsconfig, text.replace('"src/*"', '"./src/*"'));
  // Vite templates ship this; TypeScript 6 needs it for `import './index.css'`.
  await writeFile(
    join(folder.path, 'src/vite-env.d.ts'),
    '/// <reference types="vite/client" />\n',
  );
  config = await makeTempDir(`build-check-${browserName}`);
});

test.afterEach(async () => {
  for (const session of sessions.splice(0)) await session.stop();
  await folder.remove();
  await config.remove();
});

test('build check lists a type error at file:line:col, marks the file, then says Build OK [WP-4.00, M-BC]', async ({
  page,
}) => {
  test.setTimeout(180_000);
  const bad = join(folder.path, 'src/broken.ts');
  await writeFile(bad, 'export const total: number = 1;\n\nexport const label: number = "x";\n');
  const session = await startCli(folder.path, config.path);
  sessions.push(session);
  await page.goto(session.studioUrl);
  await trustIfAsked(page);
  await getCanvasFrame(page);

  await page.getByTestId('build-check-btn').click();
  const result = page.getByTestId('build-check-result');
  await expect(result).toBeVisible({ timeout: 120_000 });
  await expect(result).toContainText(ui('buildCheck.problems_one').replace('{{count}}', '1'));
  const row = page.getByTestId('build-check-problem');
  await expect(row).toHaveCount(1);
  await expect(row).toContainText('src/broken.ts:3:14');
  await expect(row).toContainText('TS2322');

  await page.getByTestId('activity-files').click();
  const srcFolder = page.getByRole('treeitem', { name: /\bsrc\b/ }).first();
  await expect(srcFolder.getByTestId('build-error-folder-dot')).toBeVisible();

  await writeFile(bad, 'export const total: number = 1;\n');
  await page.getByRole('button', { name: ui('buildCheck.again') }).click();
  await expect(result).toContainText(ui('buildCheck.ok'), { timeout: 120_000 });
  await expect(page.getByTestId('build-error-folder-dot')).toHaveCount(0);
  expect(existsSync(join(folder.path, 'dist'))).toBe(false);
  expect(await readFile(bad, 'utf8')).toBe('export const total: number = 1;\n');
});
