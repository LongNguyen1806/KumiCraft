// Opening a folder with the built CLI: a folder without a project, a project pulled from Git that
// asks for trust (S-80, S-81) and remembers it (S-82), and a broken or old `.reactcraft/workspace.json`
// that is shown, never overwritten (V-105). Projects are copies of the supported fixture (R-PJ-07).
import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import { expect, type Page, test } from '@playwright/test';

import { type CliSession, startCli } from './support/cli-session.ts';
import { copyFixture, makeTempDir, type TempDir } from './support/copy-fixture.ts';
import { getCanvasFrame, trustIfAsked } from './support/trust.ts';
import { ui } from './support/ui-text.ts';

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

/** Turns the test folder into a copy of the supported fixture with the given workspace.json. */
async function writeProject(text = JSON.stringify(PROJECT, undefined, 2)) {
  await folder.remove();
  folder = await copyFixture('projects/vite8-react19-ts');
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

  await expect(page.getByRole('heading', { name: ui('noProject.title') })).toBeVisible();
  await expect(page.getByTestId('project-folder')).toHaveText(folder.path);
});

test('a project pulled from Git asks for trust, and the answer is remembered [S-80, S-81, S-82]', async ({
  page,
}) => {
  await writeProject();
  const tab = await open(page, await start());

  await expect(tab.getByRole('dialog', { name: ui('trust.title') })).toBeVisible();
  await expect(tab.getByTestId('trust-project')).toHaveText('Cửa hàng');
  await tab.getByRole('button', { name: ui('trust.later') }).click();
  await expect(tab.getByTestId('trust-bar')).toBeVisible();
  await expect(tab.getByTestId('trust-status')).toContainText(ui('editor.restricted'));
  await tab.getByRole('button', { name: ui('trust.review') }).click();
  await tab.getByRole('button', { name: ui('trust.confirm') }).click();
  await expect(tab.getByTestId('trust-bar')).toHaveCount(0);

  for (const session of sessions.splice(0)) await session.stop();
  const again = await open(page, await start());
  await expect(again.getByTestId('project-name')).toHaveText('Cửa hàng');
  await expect(again.getByTestId('trust-bar')).toHaveCount(0);
  await expect(again.getByTestId('trust-status')).toContainText(ui('editor.trusted'));
});

test('a 0.18 workspace.json is reported and left untouched [V-105]', async ({ page }) => {
  const old = JSON.stringify({ schemaVersion: 1, id: 'old', name: 'Thiết kế cũ' });
  const file = await writeProject(old);
  const tab = await open(page, await start());

  await expect(tab.getByTestId('project-error')).toContainText('E003');
  await expect(tab.getByText(ui('projectError.oldVersion'))).toBeVisible();
  expect(await readFile(file, 'utf8')).toBe(old);
});

test('a second ReactCraft on the same project is refused while the first runs [E018]', async () => {
  await writeProject();
  await start();

  await expect(start()).rejects.toThrow(/already open in another ReactCraft session/);
});

test('a new project is created, trusted, installed and shown on the canvas [AC-01, R-QA-03] @network', async ({
  page,
}) => {
  test.setTimeout(300_000);

  const session = await start();
  const tab = await open(page, session);

  await expect(tab.getByRole('heading', { name: ui('noProject.title') })).toBeVisible({
    timeout: 20_000,
  });
  await tab.getByTestId('no-project-open-btn').click();

  const nameInput = tab.getByTestId('create-project-name');
  await expect(nameInput).toBeVisible({ timeout: 10_000 });
  await nameInput.fill('shop');
  await tab.getByTestId('create-project-pm').selectOption('pnpm');
  await tab.getByTestId('create-project-btn').click();

  await trustIfAsked(tab);

  const installDialog = tab.getByTestId('install-dialog');
  await expect(installDialog).toBeVisible({ timeout: 20_000 });
  await expect(tab.getByTestId('install-command')).toContainText('pnpm install');
  await tab.getByTestId('install-btn').click();

  // Waits until the install ends either way, then fails at once with the error text if it failed.
  const installError = tab.getByTestId('install-error');
  const installState = async (): Promise<string> => {
    if (await installError.isVisible())
      return `failed: ${(await installError.textContent()) ?? ''}`;
    return (await installDialog.isVisible()) ? 'installing' : 'done';
  };
  await expect.poll(installState, { timeout: 240_000, intervals: [1_000] }).not.toBe('installing');
  expect(await installState()).toBe('done');

  const canvas = await getCanvasFrame(tab);
  const welcomeHeading = canvas.getByRole('heading', { name: 'Welcome' });
  await expect(welcomeHeading).toBeVisible({ timeout: 60_000 });

  const pkgJsonText = await readFile(join(folder.path, 'package.json'), 'utf8');
  const pkgJson = JSON.parse(pkgJsonText) as { name?: string };
  expect(pkgJson.name).toBe('shop');

  const wsStat = await stat(join(folder.path, '.reactcraft', 'workspace.json'));
  expect(wsStat.isFile()).toBe(true);

  const viteStat = await stat(join(folder.path, 'node_modules', 'vite'));
  expect(viteStat.isDirectory()).toBe(true);
});
