import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

import { expect, type Page, test } from '@playwright/test';

import { type CliSession, startCli } from './support/cli-session.ts';
import { copyFixture, makeTempDir, type TempDir } from './support/copy-fixture.ts';
import { getCanvasFrame, trustIfAsked } from './support/trust.ts';
import { ui } from './support/ui-text.ts';

const tempDirs: TempDir[] = [];
const sessions: CliSession[] = [];

const undoLabel = () => new RegExp(`^${ui('editor.undo').split(' (')[0] ?? ''}\\b.*\\(`);
const iframes = (page: Page) => page.locator('iframe[data-testid="canvas-iframe"]');

async function openProject(fixture: string, label: string, page: Page): Promise<string> {
  const folder = await copyFixture(fixture);
  const config = await makeTempDir(`library-landing-${label}`);
  tempDirs.push(folder, config);
  const session = await startCli(folder.path, config.path);
  sessions.push(session);
  await page.goto(session.studioUrl);
  await trustIfAsked(page);
  const canvas = await getCanvasFrame(page);
  await expect(canvas.getByRole('heading', { level: 1 }).first()).toBeVisible({ timeout: 20_000 });
  return folder.path;
}

async function selectMainAndOpenLibrary(page: Page): Promise<void> {
  const layersBtn = page.getByTestId('activity-layers');
  if ((await layersBtn.getAttribute('aria-pressed')) !== 'true') {
    await layersBtn.click();
  }
  await page
    .getByRole('treeitem', { name: /\bmain\b/ })
    .first()
    .click();
  await page.getByTestId('activity-library').click();
}

test.afterEach(async () => {
  for (const session of sessions.splice(0)) await session.stop();
  for (const dir of tempDirs.splice(0)) await dir.remove();
});

test('11. Landing page blocks, accent-insensitive search, 375px mobile fit, and clean Undo', async ({
  page,
}) => {
  const root = await openProject('projects/vite8-react19-ts', 'vite8', page);
  const homeTsx = join(root, 'src', 'pages', 'Home.tsx');
  const initialSource = await readFile(homeTsx, 'utf8');

  await selectMainAndOpenLibrary(page);
  const search = page.getByTestId('library-search');
  await search.fill('bang gia');
  await expect(page.getByTestId('library-block-landing.pricing')).toBeVisible();
  await expect(page.getByTestId('library-block-form.button')).toBeHidden();
  await search.fill('');

  const landingIds = [
    'landing.hero-image',
    'landing.features',
    'landing.pricing',
    'landing.footer-columns',
  ] as const;
  for (const id of landingIds) {
    await selectMainAndOpenLibrary(page);
    const before = await readFile(homeTsx, 'utf8');
    await page.getByTestId(`library-add-${id}`).click();
    await expect.poll(() => readFile(homeTsx, 'utf8'), { timeout: 10_000 }).not.toBe(before);
  }

  await expect.poll(() => readFile(homeTsx, 'utf8')).toContain('<footer');
  const updated = await readFile(homeTsx, 'utf8');
  expect((updated.match(/<section\b/g) ?? []).length).toBeGreaterThanOrEqual(3);

  await page.getByTestId('add-frame-btn').click();
  await page.getByTestId('add-frame-item-mobile').click();
  await expect(iframes(page)).toHaveCount(2);

  const mobileHandle = await iframes(page).nth(1).elementHandle();
  const mobileFrame = (await mobileHandle.contentFrame()) ?? undefined;
  if (mobileFrame === undefined) throw new Error('Mobile iframe missing');
  await expect(mobileFrame.locator('footer')).toBeVisible({ timeout: 20_000 });

  const metrics = await mobileFrame.evaluate(() => ({
    scrollW: document.documentElement.scrollWidth,
    innerW: window.innerWidth,
  }));
  expect(metrics.innerW).toBeGreaterThanOrEqual(370);
  expect(metrics.innerW).toBeLessThanOrEqual(375);
  expect(metrics.scrollW).toBeLessThanOrEqual(metrics.innerW);

  const undoBtn = page.getByRole('button', { name: undoLabel() });
  for (let i = 0; i < landingIds.length; i++) {
    const prev = await readFile(homeTsx, 'utf8');
    await undoBtn.click();
    await expect.poll(() => readFile(homeTsx, 'utf8')).not.toBe(prev);
  }
  await expect.poll(() => readFile(homeTsx, 'utf8')).toBe(initialSource);
});
