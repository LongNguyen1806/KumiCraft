// Canvas navigation with the mouse (owner 2026-11-06, like AutoCAD and design tools): Ctrl + wheel
// zooms around the pointer, over the empty Canvas and over the page alike; holding the wheel button
// and dragging pans, over the page too; a plain wheel over the empty Canvas pans.
import { expect, type Page, test } from '@playwright/test';

import { type CliSession, startCli } from './support/cli-session.ts';
import { copyFixture, makeTempDir, type TempDir } from './support/copy-fixture.ts';
import { getCanvasFrame, trustIfAsked } from './support/trust.ts';

let folder: TempDir;
let config: TempDir;
const sessions: CliSession[] = [];

test.beforeEach(async ({ browserName }) => {
  folder = await copyFixture('projects/react-router-jsx');
  config = await makeTempDir(`canvas-nav-config-${browserName}`);
});

test.afterEach(async () => {
  for (const session of sessions.splice(0)) await session.stop();
  await folder.remove();
  await config.remove();
});

const percent = async (page: Page): Promise<number> =>
  Number.parseInt((await page.getByTestId('canvas-zoom-percent').textContent()) ?? '', 10);

const frameBox = async (page: Page) => {
  const box = (await page.getByTestId('canvas-zoom-box').first().boundingBox()) ?? undefined;
  if (box === undefined) throw new Error('frame box missing');
  return box;
};

/** Where a point of the page (fraction of the frame) sits on screen now. */
const onScreen = async (page: Page, fx: number, fy: number) => {
  const box = await frameBox(page);
  return { x: box.x + fx * box.width, y: box.y + fy * box.height };
};

test('Ctrl + wheel zooms around the pointer, the wheel button pans, over the page too [K9]', async ({
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

  // Over the page: Ctrl + wheel zooms the Canvas (not the page), keeping the point under the pointer.
  const start = await percent(page);
  const target = await onScreen(page, 0.25, 0.3);
  await page.mouse.move(target.x, target.y);
  await page.keyboard.down('Control');
  await page.mouse.wheel(0, -300);
  await page.keyboard.up('Control');
  await expect.poll(() => percent(page)).toBeGreaterThan(start);
  const after = await onScreen(page, 0.25, 0.3);
  expect(Math.abs(after.x - target.x)).toBeLessThan(4);
  expect(Math.abs(after.y - target.y)).toBeLessThan(4);
  // The page itself was not zoomed by the browser.
  expect(await page.evaluate(() => window.devicePixelRatio)).toBe(1);

  // Holding the wheel button over the page and dragging moves the Canvas by the same amount.
  const before = await frameBox(page);
  const from = await onScreen(page, 0.5, 0.5);
  await page.mouse.move(from.x, from.y);
  await page.mouse.down({ button: 'middle' });
  await page.mouse.move(from.x + 80, from.y + 40, { steps: 5 });
  await page.mouse.up({ button: 'middle' });
  await expect.poll(async () => Math.round((await frameBox(page)).x - before.x)).toBe(80);
  expect(Math.round((await frameBox(page)).y - before.y)).toBe(40);

  // A plain wheel over the empty Canvas pans it up.
  const placeholder = (await page.getByTestId('canvas-placeholder').boundingBox()) ?? undefined;
  if (placeholder === undefined) throw new Error('canvas missing');
  const top = (await frameBox(page)).y;
  await page.mouse.move(placeholder.x + 8, placeholder.y + placeholder.height - 8);
  await page.mouse.wheel(0, 120);
  await expect.poll(async () => Math.round(top - (await frameBox(page)).y)).toBe(120);
});
