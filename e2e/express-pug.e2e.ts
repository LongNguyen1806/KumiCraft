// Express + Pug (Phase 4 K4, spec-log #80; editable since 03d): KumiCraft runs the app behind its
// Bridge proxy, so a page helmet() forbids framing still shows on the Canvas, an element names its
// own .pug line (layout, partial and mixin included), text is edited on the Canvas into the .pug,
// a duplicate shows once Express renders the view again, Undo gives the file back, and the page
// list follows Express routes and can be added to.
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

import { expect, type Page, test } from '@playwright/test';

import { type CliSession, startCli } from './support/cli-session.ts';
import { copyFixture, makeTempDir, type TempDir } from './support/copy-fixture.ts';
import { getCanvasFrame, trustIfAsked } from './support/trust.ts';

let folder: TempDir;
let config: TempDir;
const sessions: CliSession[] = [];

/** Clicks the start of an element's text in the Canvas, scaled to the Canvas zoom. */
async function clickInCanvas(page: Page, selector: string, clickCount = 1): Promise<void> {
  const iframe = page.locator('iframe[data-testid="canvas-iframe"]');
  const outer = (await iframe.boundingBox()) ?? undefined;
  const frame = page.frames().find((f) => f !== page.mainFrame());
  if (outer === undefined || frame === undefined) throw new Error('canvas frame missing');
  const inner = await frame.evaluate((sel) => {
    const rect = document.querySelector(sel)?.getBoundingClientRect();
    return rect === undefined
      ? undefined
      : { x: rect.x, y: rect.y, height: rect.height, width: window.innerWidth };
  }, selector);
  if (inner === undefined) throw new Error(`${selector} missing in the Canvas`);
  const scale = outer.width / inner.width;
  await page.mouse.click(
    outer.x + (inner.x + 15) * scale,
    outer.y + (inner.y + inner.height / 2) * scale,
    { clickCount },
  );
}

test.beforeEach(async ({ browserName }) => {
  folder = await copyFixture('projects/express-pug');
  config = await makeTempDir(`express-pug-config-${browserName}`);
});

test.afterEach(async () => {
  for (const session of sessions.splice(0)) await session.stop();
  await folder.remove();
  await config.remove();
});

test('an Express + Pug app shows on the Canvas, edits its .pug, Undo, and lists its routes [K4, 03d]', async ({
  page,
  browserName,
}) => {
  const session = await startCli(folder.path, config.path);
  sessions.push(session);
  await page.goto(session.studioUrl);
  await trustIfAsked(page);
  const canvas = await getCanvasFrame(page);

  // helmet() sends X-Frame-Options and frame-ancestors 'self'; the proxy lets the Studio frame it.
  const hero = canvas.locator('h1.hero-title');
  await expect(hero).toHaveText('Sản phẩm hôm nay', { timeout: 30_000 });
  await expect(page.getByTestId('view-only-chip')).toHaveCount(0);

  // Each element carries the .pug line it comes from, in the page, a partial and a mixin.
  await expect(hero).toHaveAttribute('data-rc-loc', 'views/index.pug:5:3');
  await expect(canvas.locator('nav.site-nav')).toHaveAttribute(
    'data-rc-loc',
    'views/partials/nav.pug:1:1',
  );
  await expect(canvas.locator('article.card').first()).toHaveAttribute(
    'data-rc-loc',
    'views/mixins.pug:2:3',
  );
  // The app's own CSS loads through the proxy.
  await expect(canvas.locator('nav.site-nav')).toHaveCSS('display', 'flex');

  // Text edited on the Canvas is written to the .pug line, and Undo gives the file back.
  const file = join(folder.path, 'views/index.pug');
  const original = await readFile(file, 'utf8');
  await clickInCanvas(page, 'h1.hero-title', 2);
  await expect(hero).toHaveAttribute('contenteditable', /plaintext-only|true/);
  await page.keyboard.press('End');
  await page.keyboard.type(' mới');
  await page.keyboard.press('Enter');
  await expect
    .poll(() => readFile(file, 'utf8'), { timeout: 15_000 })
    .toContain('  h1.hero-title Sản phẩm hôm nay mới\n');
  const undo = browserName === 'webkit' ? 'Meta+z' : 'Control+z';
  await page.keyboard.press(undo);
  await expect.poll(() => readFile(file, 'utf8'), { timeout: 15_000 }).toBe(original);

  // A duplicate shows only once Express renders the view again: it has the stamp of its line.
  await clickInCanvas(page, 'h1.hero-title');
  await page.keyboard.press(browserName === 'webkit' ? 'Meta+d' : 'Control+d');
  await expect
    .poll(() => readFile(file, 'utf8'), { timeout: 15_000 })
    .toContain('  h1.hero-title Sản phẩm hôm nay\n  h1.hero-title Sản phẩm hôm nay\n');
  await expect(canvas.locator('[data-rc-loc="views/index.pug:6:3"]')).toHaveText(
    'Sản phẩm hôm nay',
    { timeout: 20_000 },
  );
  await page.keyboard.press(undo);
  await expect.poll(() => readFile(file, 'utf8'), { timeout: 15_000 }).toBe(original);

  // The page list follows the Express routes, the mounted router included; choosing one loads it.
  const select = page.getByTestId('canvas-page-select');
  await expect(select.locator('option[value="/products/:id"]')).toHaveCount(1);
  await select.selectOption('/about');
  await expect(canvas.getByRole('heading', { name: 'Giới thiệu' })).toBeVisible({
    timeout: 20_000,
  });
  await expect(canvas.locator('h1')).toHaveAttribute('data-rc-loc', 'views/about.pug:4:3');

  // Pages can be added: a route and a view (03d section 2.2).
  await page.getByTestId('activity-pages').click();
  await expect(page.getByTestId('pages-panel')).toContainText('/about');
  await expect(page.getByTestId('page-add')).toBeVisible();
});
