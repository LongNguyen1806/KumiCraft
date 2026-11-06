// One frame at a time (owner 2026-11-06): ⤢ on a frame shows it alone, ‹ › and N / Shift+N step
// between frames without reloading them, the ends are disabled, Esc goes back side by side.
import { expect, type Page, test } from '@playwright/test';

import { type CliSession, startCli } from './support/cli-session.ts';
import { copyFixture, makeTempDir, type TempDir } from './support/copy-fixture.ts';
import { getCanvasFrame, trustIfAsked } from './support/trust.ts';

let folder: TempDir;
let config: TempDir;
const sessions: CliSession[] = [];

test.beforeEach(async ({ browserName }) => {
  folder = await copyFixture('projects/react-router-jsx');
  config = await makeTempDir(`frame-focus-config-${browserName}`);
});

test.afterEach(async () => {
  for (const session of sessions.splice(0)) await session.stop();
  await folder.remove();
  await config.remove();
});

const tiles = (page: Page) => page.locator('[data-testid^="canvas-frame-tile-"]');
const shown = (page: Page): Promise<boolean[]> =>
  tiles(page).evaluateAll((all: Element[]) => all.map((tile) => !tile.hasAttribute('data-hidden')));

/** Marks the page of every frame, to tell later whether a frame was reloaded. */
async function markPages(page: Page): Promise<void> {
  for (const frame of page.frames()) {
    if (frame !== page.mainFrame()) {
      await frame.evaluate(() => {
        Object.assign(window, { kcMark: 'kept' });
      });
    }
  }
}

const marks = (page: Page): Promise<unknown[]> =>
  Promise.all(
    page
      .frames()
      .filter((frame) => frame !== page.mainFrame())
      .map((frame) =>
        frame.evaluate((): unknown => {
          const mark: unknown = Reflect.get(window, 'kcMark');
          return mark;
        }),
      ),
  );

test('one frame at a time: show one, step with ‹ › and N, no reload, Esc back [K9]', async ({
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

  // One frame: no switch, no ⤢.
  await expect(page.getByTestId('frame-layout-focus')).toHaveCount(0);
  await page.getByTestId('add-frame-btn').click();
  await page.getByTestId('add-frame-item-mobile').click();
  await expect(tiles(page)).toHaveCount(2);
  await expect(page.locator('iframe[data-testid="canvas-iframe"]').nth(1)).toBeVisible();
  await expect.poll(async () => (await marks(page)).length, { timeout: 20_000 }).toBe(2);
  await markPages(page);

  // ⤢ on the first frame: it alone is shown, full size.
  await tiles(page).nth(0).getByTestId('frame-focus-btn').click();
  await expect.poll(() => shown(page)).toEqual([true, false]);
  await expect(page.getByTestId('frame-focus-position')).toHaveText('1 / 2');
  await expect(page.getByTestId('frame-focus-prev')).toBeDisabled();
  await expect(page.getByTestId('frame-layout-focus')).toHaveAttribute('aria-pressed', 'true');

  // › steps to the second frame; it is the last, so › is disabled there.
  await page.getByTestId('frame-focus-next').click();
  await expect.poll(() => shown(page)).toEqual([false, true]);
  await expect(page.getByTestId('frame-focus-next')).toBeDisabled();
  await expect(page.getByTestId('frame-focus-status')).toContainText('2');

  // Shift+N back, N forward again (the Studio has the keyboard after the click on ›).
  await page.keyboard.press('Shift+N');
  await expect.poll(() => shown(page)).toEqual([true, false]);
  await page.keyboard.press('n');
  await expect.poll(() => shown(page)).toEqual([false, true]);

  // Switching never reloaded a page: both still carry the mark.
  expect(await marks(page)).toEqual(['kept', 'kept']);

  // Esc goes back side by side.
  await page.keyboard.press('Escape');
  await expect.poll(() => shown(page)).toEqual([true, true]);
  await expect(page.getByTestId('frame-focus-controls')).toHaveCount(0);
});
