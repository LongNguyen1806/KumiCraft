// Login sessions (spec-log #76): session 2 frames the same dev server as s2.localhost, so its
// storage is its own (customer and farmer signed in side by side), and selecting still works.
import { expect, type FrameLocator, type Page, test } from '@playwright/test';

import { type CliSession, startCli } from './support/cli-session.ts';
import { copyFixture, makeTempDir, type TempDir } from './support/copy-fixture.ts';
import { getCanvasFrame, trustIfAsked } from './support/trust.ts';

let folder: TempDir;
let config: TempDir;
const sessions: CliSession[] = [];

const canvasUrl = (page: Page) =>
  page.locator('iframe[data-testid="canvas-iframe"]').getAttribute('src');

function canvasFrame(page: Page) {
  const frame = page.frames().find((f) => f !== page.mainFrame());
  if (frame === undefined) throw new Error('canvas frame missing');
  return frame;
}

/** The project page's own localStorage, read inside the Canvas frame. */
async function storageOf(page: Page): Promise<string> {
  return canvasFrame(page).evaluate(() => window.localStorage.getItem('kc-e2e-login') ?? '');
}

async function setStorage(page: Page, value: string): Promise<void> {
  await canvasFrame(page).evaluate((v) => {
    window.localStorage.setItem('kc-e2e-login', v);
  }, value);
}

async function headingVisible(canvas: FrameLocator): Promise<void> {
  await expect(canvas.getByRole('heading').first()).toBeVisible({ timeout: 20_000 });
}

test.beforeEach(async ({ browserName }) => {
  folder = await copyFixture('projects/vite8-react19-ts');
  config = await makeTempDir(`login-sessions-config-${browserName}`);
});

test.afterEach(async () => {
  for (const session of sessions.splice(0)) await session.stop();
  await folder.remove();
  await config.remove();
});

test('turned on in Settings, session 2 is s2.localhost with its own storage, and selecting still works [K3d D]', async ({
  page,
}) => {
  const session = await startCli(folder.path, config.path);
  sessions.push(session);
  await page.goto(session.studioUrl);
  await trustIfAsked(page);
  const canvas = await getCanvasFrame(page);
  await headingVisible(canvas);
  expect(await canvasUrl(page)).toContain('//localhost:');
  await setStorage(page, 'customer');

  // Off by default (spec-log #77): no picker until the option is turned on in Settings.
  await expect(page.getByTestId('session-select-trigger')).toHaveCount(0);
  await page.getByTestId('activity-settings').click();
  await page.getByTestId('settings-section-canvas').click();
  await page.getByTestId('settings-login-sessions').check();
  await page.keyboard.press('Escape');

  await page.getByTestId('session-select-trigger').click();
  await page.getByTestId('session-add-input').fill('Farmer');
  await page.getByTestId('session-add-btn').click();
  await page.getByTestId('session-item-2').click();

  await expect.poll(() => canvasUrl(page)).toContain('s2.localhost');
  await expect(page.getByTestId('session-error')).toHaveCount(0);
  await headingVisible(canvas);
  // Its own origin: nothing from session 1 is there.
  await expect.poll(() => storageOf(page)).toBe('');
  await setStorage(page, 'farmer');

  // The Bridge answers from s2.localhost: clicking an element selects it.
  await canvas.getByRole('heading', { name: 'Sản phẩm nổi bật' }).click();
  await page.getByTestId('raw-class-details').locator('summary').click();
  await expect(page.getByTestId('raw-class-input')).toBeVisible({ timeout: 5_000 });

  await page.getByTestId('session-select-trigger').click();
  await page.getByTestId('session-item-1').click();
  await expect.poll(() => canvasUrl(page)).toContain('//localhost:');
  await expect.poll(() => storageOf(page)).toBe('customer');
});

async function turnSessionsOn(page: Page): Promise<void> {
  await page.getByTestId('activity-settings').click();
  await page.getByTestId('settings-section-canvas').click();
  await page.getByTestId('settings-login-sessions').check();
  await page.keyboard.press('Escape');
}

test('only the user changes the session, and the page on screen stays [K3d D, spec-log #79]', async ({
  page,
}) => {
  await folder.remove();
  folder = await copyFixture('projects/react-router-jsx');
  const session = await startCli(folder.path, config.path);
  sessions.push(session);
  await page.goto(session.studioUrl);
  await trustIfAsked(page);
  const canvas = await getCanvasFrame(page);
  await expect(canvas.getByRole('heading', { name: 'Bảng điều khiển' })).toBeVisible({
    timeout: 20_000,
  });
  await turnSessionsOn(page);
  await page.getByTestId('session-select-trigger').click();
  await page.getByTestId('session-add-input').fill('Farmer');
  await page.getByTestId('session-add-btn').click();

  // On /tasks, Farmer opens the same page with another login.
  await page.keyboard.press('Escape');
  await page.getByTestId('canvas-page-select').selectOption('/tasks');
  await expect(canvas.getByRole('heading', { name: 'Danh sách việc' })).toBeVisible();
  await page.getByTestId('session-select-trigger').click();
  await page.getByTestId('session-item-2').click();
  await expect.poll(() => canvasUrl(page)).toContain('s2.localhost');
  await expect.poll(() => canvasUrl(page)).toContain('/tasks');
  await expect(canvas.getByRole('heading', { name: 'Danh sách việc' })).toBeVisible();
  await expect(page.getByTestId('session-select-label')).toHaveText('Farmer');

  // Opening another page keeps Farmer: nothing switches by itself.
  await page.getByTestId('canvas-page-select').selectOption('/');
  await expect(canvas.getByRole('heading', { name: 'Bảng điều khiển' })).toBeVisible();
  await expect.poll(() => canvasUrl(page)).toContain('s2.localhost');
  await expect(page.getByTestId('session-select-label')).toHaveText('Farmer');
});
