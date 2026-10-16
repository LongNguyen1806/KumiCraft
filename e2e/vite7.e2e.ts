// End-to-end integration tests for Vite 7 + React 18 JS (VG-15, AC-02, AC-03).
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

import { expect, type Page, test } from '@playwright/test';

import { type CliSession, startCli } from './support/cli-session.ts';
import { copyFixture, makeTempDir, type TempDir } from './support/copy-fixture.ts';
import { getCanvasFrame, trustIfAsked } from './support/trust.ts';

let folder: TempDir;
let config: TempDir;
const sessions: CliSession[] = [];

const start = async () => {
  const session = await startCli(folder.path, config.path);
  sessions.push(session);
  return session;
};

async function open(page: Page, session: CliSession): Promise<Page> {
  const tab = await page.context().newPage();
  await tab.goto(session.studioUrl);
  return tab;
}

async function triggerUndo(tab: Page, browserName: string): Promise<void> {
  if (browserName === 'webkit') {
    await tab.keyboard.press('Meta+z');
  } else {
    await tab.keyboard.press('Control+z');
  }
}

test.beforeEach(async ({ browserName }) => {
  folder = await copyFixture('projects/vite7-react18-js');
  config = await makeTempDir(`vite7-config-${browserName}`);
});

test.afterEach(async () => {
  for (const session of sessions.splice(0)) await session.stop();
  await folder.remove();
  await config.remove();
});

test('runs a Vite 7 + React 18 JavaScript project in the Canvas [VG-15, AC-02]', async ({
  page,
}) => {
  const session = await start();
  const tab = await open(page, session);
  await trustIfAsked(tab);

  const canvas = await getCanvasFrame(tab);
  await expect(canvas.getByRole('heading', { name: 'Cửa hàng mẫu' })).toBeVisible({
    timeout: 15_000,
  });
});

test('edits a class in a JSX file and undoes it byte for byte [VG-15, AC-03]', async ({
  page,
  browserName,
}) => {
  const session = await start();
  const tab = await open(page, session);
  await trustIfAsked(tab);

  const canvas = await getCanvasFrame(tab);
  const targetElement = canvas.locator('.p-4.text-lg');
  await expect(targetElement).toBeVisible({ timeout: 15_000 });

  const homeFile = join(folder.path, 'src', 'pages', 'Home.jsx');
  const originalCode = await readFile(homeFile, 'utf8');

  await targetElement.click();
  await tab.getByTestId('raw-class-details').locator('summary').click();
  const rawClassInput = tab.getByTestId('raw-class-input');
  await expect(rawClassInput).toBeVisible({ timeout: 5_000 });

  const currentClass = await rawClassInput.inputValue();
  const updatedClass = `${currentClass} p-8`;
  await rawClassInput.fill(updatedClass);
  await rawClassInput.press('Enter');

  await expect
    .poll(
      async () => {
        const code = await readFile(homeFile, 'utf8');
        return code.includes('p-8');
      },
      { timeout: 10_000 },
    )
    .toBe(true);

  // Blur input so typing target doesn't suppress global undo shortcut
  await rawClassInput.blur();

  // Undo (Mod+Z)
  await triggerUndo(tab, browserName);

  await expect
    .poll(
      async () => {
        const code = await readFile(homeFile, 'utf8');
        return code;
      },
      { timeout: 10_000 },
    )
    .toBe(originalCode);
});
