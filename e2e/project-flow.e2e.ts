// What remains of the user's main path until M-PJ (WP-1.03): a folder without a project, a project
// pulled from Git that asks for trust (S-80, S-81) and remembers it (S-82), and a broken or old
// `.reactcraft/workspace.json` that is shown, never overwritten (V-105). Runs the built CLI.
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import { expect, type Page, test } from '@playwright/test';

import { type CliSession, startCli } from './support/cli-session.ts';
import { makeTempDir, type TempDir } from './support/copy-fixture.ts';

let folder: TempDir;
let config: TempDir;
const sessions: CliSession[] = [];

const start = async () => {
  const session = await startCli(folder.path, config.path);
  sessions.push(session);
  return session;
};

/** `.reactcraft/workspace.json` of SPEC-03 section 3, as a project pulled from Git has it. */
const PROJECT = {
  schemaVersion: 2,
  id: 'e2eshop001',
  name: 'Cửa hàng',
  createdAt: '2026-10-14T08:00:00.000Z',
  framework: 'vite-react',
  sourceDir: 'src',
  backends: [],
  responsiveMode: 'desktop-first',
  frames: [
    { id: 'desktop', label: 'Desktop', width: 1440, height: 900 },
    { id: 'mobile', label: 'Mobile', width: 375, height: 812 },
  ],
  primaryFrameId: 'desktop',
};

async function writeProject(text = JSON.stringify(PROJECT, undefined, 2)) {
  await mkdir(join(folder.path, '.reactcraft'), { recursive: true });
  const file = join(folder.path, '.reactcraft', 'workspace.json');
  await writeFile(file, text);
  return file;
}

/** Opens a session in a new tab, as the CLI does for each start. */
async function open(page: Page, session: CliSession): Promise<Page> {
  const tab = await page.context().newPage();
  await tab.goto(session.studioUrl);
  return tab;
}

test.beforeEach(async ({ browserName }) => {
  folder = await makeTempDir(`flow-${browserName}`);
  config = await makeTempDir(`flow-config-${browserName}`);
});

test.afterEach(async () => {
  for (const session of sessions.splice(0)) await session.stop();
  await folder.remove();
  await config.remove();
});

test('a folder without a project says so and shows the folder [R-PJ-18]', async ({ page }) => {
  const session = await start();
  await page.goto(session.studioUrl);

  await expect(page.getByRole('heading', { name: 'Chưa mở dự án nào' })).toBeVisible();
  await expect(page.getByTestId('project-folder')).toHaveText(folder.path);
});

test('a project pulled from Git asks for trust, and the answer is remembered [S-80, S-81, S-82]', async ({
  page,
}) => {
  await writeProject();
  const tab = await open(page, await start());

  await expect(tab.getByRole('dialog', { name: 'Bạn có tin tưởng dự án này?' })).toBeVisible();
  await expect(tab.getByTestId('trust-project')).toHaveText('Cửa hàng');
  await tab.getByRole('button', { name: 'Để sau' }).click();
  await expect(tab.getByTestId('trust-bar')).toBeVisible();
  await expect(tab.getByTestId('trust-status')).toContainText('Chế độ hạn chế');
  await tab.getByRole('button', { name: 'Xem và tin cậy' }).click();
  await tab.getByRole('button', { name: 'Tin cậy dự án này' }).click();
  await expect(tab.getByTestId('trust-bar')).toHaveCount(0);

  for (const session of sessions.splice(0)) await session.stop();
  const again = await open(page, await start());
  await expect(again.getByTestId('project-name')).toHaveText('Cửa hàng');
  await expect(again.getByTestId('trust-bar')).toHaveCount(0);
  await expect(again.getByTestId('trust-status')).toContainText('Dự án đã tin cậy');
});

test('a 0.18 workspace.json is reported and left untouched [V-105]', async ({ page }) => {
  const old = JSON.stringify({ schemaVersion: 1, id: 'old', name: 'Thiết kế cũ' });
  const file = await writeProject(old);
  const tab = await open(page, await start());

  await expect(tab.getByTestId('project-error')).toContainText('E003');
  await expect(tab.getByText(/ReactCraft bản cũ/)).toBeVisible();
  expect(await readFile(file, 'utf8')).toBe(old);
});

test('a second ReactCraft on the same project is refused while the first runs [E018]', async () => {
  await writeProject();
  await start();

  await expect(start()).rejects.toThrow(/already open in another ReactCraft session/);
});
