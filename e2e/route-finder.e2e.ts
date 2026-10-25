// Route finder (SPEC-04 K3d, spec-log #74): a project whose router lives in
// src/router/AppRouter.jsx as JSX <Routes> (like WorkTracker) lists its pages, and Add page writes
// a route there that matches the file's style, so the new page opens on the Canvas.
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

import { expect, test } from '@playwright/test';

import { type CliSession, startCli } from './support/cli-session.ts';
import { copyFixture, makeTempDir, type TempDir } from './support/copy-fixture.ts';
import { getCanvasFrame, trustIfAsked } from './support/trust.ts';

let folder: TempDir;
let config: TempDir;
const sessions: CliSession[] = [];

test.beforeEach(async ({ browserName }) => {
  folder = await copyFixture('projects/react-router-jsx');
  config = await makeTempDir(`route-finder-config-${browserName}`);
});

test.afterEach(async () => {
  for (const session of sessions.splice(0)) await session.stop();
  await folder.remove();
  await config.remove();
});

test('a JSX router outside src/routes gets the new page in its own style [K3d]', async ({
  page,
}) => {
  const session = await startCli(folder.path, config.path);
  sessions.push(session);
  await page.goto(session.studioUrl);
  await trustIfAsked(page);
  const canvas = await getCanvasFrame(page);
  await expect(canvas.getByRole('heading', { name: 'Bảng điều khiển' })).toBeVisible({
    timeout: 20_000,
  });

  await page.getByTestId('activity-pages').click();
  const panel = page.getByTestId('pages-panel');
  await expect(panel).toContainText('/tasks');
  await page.getByTestId('page-name').fill('Reports');
  await page.getByTestId('page-add').click();

  const router = join(folder.path, 'src', 'router', 'AppRouter.jsx');
  await expect
    .poll(() => readFile(router, 'utf8'))
    .toContain("import Reports from '../pages/Reports';");
  const routerText = await readFile(router, 'utf8');
  expect(routerText).toContain("<Route path='reports' element={<Reports />} />");
  expect(await readFile(join(folder.path, 'src', 'pages', 'Reports.jsx'), 'utf8')).toContain(
    'export default function Reports()',
  );

  // The page renders inside the layout: the import matches the export, so nothing breaks.
  await expect(canvas.getByRole('heading', { name: 'Reports' })).toBeVisible({ timeout: 20_000 });
  await expect(canvas.getByRole('link', { name: 'Công việc' })).toBeVisible();
});
