// Express + Pug, view only (Phase 4 K4, spec-log #80): KumiCraft runs the app behind its Bridge
// proxy, so a page helmet() forbids framing still shows on the Canvas, an element names its own
// .pug line (layout, partial and mixin included), the page list follows Express routes, and
// nothing in the Studio offers to edit the code.
import { expect, type Page, test } from '@playwright/test';

import { type CliSession, startCli } from './support/cli-session.ts';
import { copyFixture, makeTempDir, type TempDir } from './support/copy-fixture.ts';
import { getCanvasFrame, trustIfAsked } from './support/trust.ts';

let folder: TempDir;
let config: TempDir;
const sessions: CliSession[] = [];

/** Clicks the start of an element's text in the Canvas, scaled to the Canvas zoom. */
async function clickInCanvas(page: Page, selector: string): Promise<void> {
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

test('an Express + Pug app shows on the Canvas, view only, each element naming its .pug line [K4]', async ({
  page,
}) => {
  const session = await startCli(folder.path, config.path);
  sessions.push(session);
  await page.goto(session.studioUrl);
  await trustIfAsked(page);
  const canvas = await getCanvasFrame(page);

  // helmet() sends X-Frame-Options and frame-ancestors 'self'; the proxy lets the Studio frame it.
  const hero = canvas.locator('h1.hero-title');
  await expect(hero).toHaveText('Sản phẩm hôm nay', { timeout: 30_000 });
  await expect(page.getByTestId('view-only-chip')).toBeVisible();

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

  // Selecting an element: the Inspector names the line and offers the editor, no edit fields.
  // Click where a person would, on the title's text. Playwright places an element of a scaled
  // iframe as if it were not scaled, so the point is worked out from the frame's own layout.
  await clickInCanvas(page, 'h1.hero-title');
  const banner = page.getByTestId('view-only-inspector-banner');
  await expect(banner).toContainText('views/index.pug:5:3');
  await expect(banner.getByTestId('open-in-editor-btn')).toBeVisible();
  await expect(page.getByTestId('raw-class-details')).toHaveCount(0);

  // The page list follows the Express routes, the mounted router included; choosing one loads it.
  const select = page.getByTestId('canvas-page-select');
  await expect(select.locator('option[value="/products/:id"]')).toHaveCount(1);
  await select.selectOption('/about');
  await expect(canvas.getByRole('heading', { name: 'Giới thiệu' })).toBeVisible({
    timeout: 20_000,
  });
  await expect(canvas.locator('h1')).toHaveAttribute('data-rc-loc', 'views/about.pug:4:3');

  // No page editing in a view-only project.
  await page.getByTestId('activity-pages').click();
  await expect(page.getByTestId('pages-panel')).toContainText('/about');
  await expect(page.getByTestId('page-add')).toHaveCount(0);
});
