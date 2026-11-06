// Several Canvas frames (Phase 4 K9 stage A, M-MF): frames side by side, each in its own login
// session, "Fit" fits the whole row, and clicking an element in a frame that is not the working one
// makes it the working frame and selects that element.
import { expect, type Page, test } from '@playwright/test';

import { type CliSession, startCli } from './support/cli-session.ts';
import { copyFixture, makeTempDir, type TempDir } from './support/copy-fixture.ts';
import { getCanvasFrame, trustIfAsked } from './support/trust.ts';

let folder: TempDir;
let config: TempDir;
const sessions: CliSession[] = [];

test.beforeEach(async ({ browserName }) => {
  folder = await copyFixture('projects/react-router-jsx');
  config = await makeTempDir(`multi-frame-config-${browserName}`);
});

test.afterEach(async () => {
  for (const session of sessions.splice(0)) await session.stop();
  await folder.remove();
  await config.remove();
});

const iframes = (page: Page) => page.locator('iframe[data-testid="canvas-iframe"]');

/** Clicks the heading of the n-th frame, scaled to the Canvas zoom (Playwright ignores it). */
async function clickHeadingInFrame(
  page: Page,
  index: number,
  button: 'left' | 'right' = 'left',
): Promise<void> {
  const outer = (await iframes(page).nth(index).boundingBox()) ?? undefined;
  const handle = await iframes(page).nth(index).elementHandle();
  const frame = (await handle.contentFrame()) ?? undefined;
  if (outer === undefined || frame === undefined) throw new Error(`frame ${String(index)} missing`);
  const inner = await frame.evaluate(() => {
    const rect = document.querySelector('h1')?.getBoundingClientRect();
    return rect === undefined
      ? undefined
      : { x: rect.x, y: rect.y, height: rect.height, width: window.innerWidth };
  });
  if (inner === undefined) throw new Error('heading missing');
  const scale = outer.width / inner.width;
  await page.mouse.click(
    outer.x + (inner.x + 10) * scale,
    outer.y + (inner.y + inner.height / 2) * scale,
    { button },
  );
}

/** Which frame tiles are the working one (bold ring), in order. */
const isWorking = (page: Page): Promise<boolean[]> =>
  page
    .locator('[data-testid^="canvas-frame-tile-"]')
    .evaluateAll((tiles: Element[]) => tiles.map((tile) => tile.classList.contains('ring-2')));

test('two frames in two sessions; clicking in the other frame makes it the working one [K9 M-MF]', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1366, height: 768 });
  const session = await startCli(folder.path, config.path);
  sessions.push(session);
  await page.goto(session.studioUrl);
  await trustIfAsked(page);
  const canvas = await getCanvasFrame(page);
  await expect(canvas.getByRole('heading', { name: 'Bảng điều khiển' })).toBeVisible({
    timeout: 20_000,
  });
  await page.getByTestId('activity-settings').click();
  await page.getByTestId('settings-login-sessions').check();
  await page.keyboard.press('Escape');

  // The status bar clips its overflow: the menu must still be on screen and clickable.
  await page.getByTestId('add-frame-btn').click();
  await page.getByTestId('add-frame-item-mobile').click();
  await expect(iframes(page)).toHaveCount(2);
  await expect.poll(() => isWorking(page)).toEqual([false, true]);

  // The new frame signs in as Farmer (session 2); the first stays in session 1.
  await page.getByTestId('session-select-trigger').nth(1).click();
  await page.getByTestId('session-add-input').fill('Farmer');
  await page.getByTestId('session-add-btn').click();
  await page.getByTestId('session-item-2').click();
  await expect.poll(() => iframes(page).nth(1).getAttribute('src')).toContain('s2.localhost');
  expect(await iframes(page).nth(0).getAttribute('src')).toContain('127.0.0.1');

  // "Fit" fits the whole row: no sideways scrolling.
  await page.getByRole('button', { name: 'Vừa khung' }).click();
  await expect
    .poll(() =>
      page.getByTestId('canvas-placeholder').evaluate((el) => el.scrollWidth - el.clientWidth),
    )
    .toBeLessThanOrEqual(1);

  // Clicking the heading of the first frame: it becomes the working frame, the element selected.
  await clickHeadingInFrame(page, 0);
  await expect.poll(() => isWorking(page)).toEqual([true, false]);
  // R-SL-02: the first click picks the section the heading sits in, the second one the heading.
  await expect(page.getByTestId('inspector-panel')).toContainText('<section>');
  await clickHeadingInFrame(page, 0);
  await expect(page.getByTestId('inspector-panel')).toContainText('src/pages/Dashboard.jsx:4');

  // A right click in the other frame: that frame becomes the working one and alone shows the menu.
  await clickHeadingInFrame(page, 1, 'right');
  await expect.poll(() => isWorking(page)).toEqual([false, true]);
  await expect(page.getByTestId('layer-menu')).toHaveCount(1);
  await page.keyboard.press('Escape');

  // Preview: the drawing tools go, Pan stays so it can be turned on and off.
  await page.getByTestId('canvas-mode-toggle').click();
  await expect(page.getByTestId('draw-tool-select')).toHaveCount(0);
  await expect(page.getByTestId('draw-tool-pan')).toBeVisible();
});
