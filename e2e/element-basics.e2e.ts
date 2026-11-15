// E2E tests for K9.7-2 Part 3: tag switcher, list items, inline text bar, attributes, icons, image group & Image button check (Tests 10 & 11).
import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

import { expect, type Page, test } from '@playwright/test';

import { type CliSession, startCli } from './support/cli-session.ts';
import { copyFixture, makeTempDir, type TempDir } from './support/copy-fixture.ts';
import { getCanvasFrame, trustIfAsked } from './support/trust.ts';

const tempDirs: TempDir[] = [];
const sessions: CliSession[] = [];

async function openProject(fixture: string, label: string, page: Page): Promise<string> {
  const folder = await copyFixture(fixture);
  const config = await makeTempDir(`k972-basics-${label}`);
  tempDirs.push(folder, config);
  const session = await startCli(folder.path, config.path);
  sessions.push(session);
  await page.goto(session.studioUrl);
  await trustIfAsked(page);
  const canvas = await getCanvasFrame(page);
  await expect(canvas.getByRole('heading', { level: 1 }).first()).toBeVisible({ timeout: 20_000 });
  return folder.path;
}

async function openGroupIfClosed(page: Page, groupId: string): Promise<void> {
  const btn = page.getByTestId(`inspector-group-${groupId}`);
  const expanded = await btn.getAttribute('aria-expanded');
  if (expanded !== 'true') {
    await btn.click();
  }
}

test.afterEach(async () => {
  for (const session of sessions.splice(0)) await session.stop();
  for (const dir of tempDirs.splice(0)) await dir.remove();
});

test('10. Tailwind project: list add/remove, tag change, offline Lucide icon & replaceSvg, image button intact', async ({
  page,
}) => {
  const root = await openProject('projects/vite8-react19-ts', 'tw', page);
  const homeTsx = join(root, 'src', 'pages', 'Home.tsx');
  const pkgJson = join(root, 'package.json');
  const pkgBefore = await readFile(pkgJson, 'utf8');

  // 1. Insert Bullet List block into main -> add & remove item
  await page
    .getByRole('treeitem', { name: /\bmain\b/ })
    .first()
    .click();
  await page.getByTestId('activity-library').click();
  await expect(page.getByTestId('library-insert-image')).toBeEnabled();
  await page.getByTestId('library-add-content.list').click();
  await expect.poll(() => readFile(homeTsx, 'utf8')).toContain('<ul');

  await page.getByTestId('list-add-item').click();
  await expect
    .poll(async () => ((await readFile(homeTsx, 'utf8')).match(/<li/g) ?? []).length)
    .toBeGreaterThanOrEqual(5);
  await page.getByTestId('list-remove-item').click();
  await expect
    .poll(async () => ((await readFile(homeTsx, 'utf8')).match(/<li/g) ?? []).length)
    .toBeLessThanOrEqual(4);

  // 2. Insert offline Lucide icon without modifying package.json, then replaceSvg via Inspector
  await page.getByTestId('library-open-icons').click();
  await expect(page.getByTestId('icon-picker')).toBeVisible();
  await page.getByTestId('icon-search').fill('tim');
  await page.getByTestId('icon-item-heart').click();
  await expect.poll(() => readFile(homeTsx, 'utf8')).toContain('data-icon="heart"');
  expect(await readFile(pkgJson, 'utf8')).toBe(pkgBefore);

  await expect(page.getByTestId('inspector-icon')).toBeVisible();
  await page.getByTestId('icon-change-btn').click();
  await page.getByTestId('icon-search').fill('star');
  await page.getByTestId('icon-item-star').click();
  await expect.poll(() => readFile(homeTsx, 'utf8')).toContain('data-icon="star"');

  // 3. Tag switcher: switch <div className="mx-auto ..."> to <section>
  await page.getByTestId('activity-layers').click();
  await page
    .getByRole('treeitem', { name: /\bdiv mx-auto/ })
    .first()
    .click();
  await openGroupIfClosed(page, 'attributes');
  await page.getByTestId('inspector-tag-select').selectOption('section');
  await expect.poll(() => readFile(homeTsx, 'utf8')).toContain('<section className="mx-auto');

  // 4. Image Inspector group works when <img> selected; Image... button remains functional
  await page
    .getByRole('treeitem', { name: /^img\b/ })
    .first()
    .click();
  await expect(page.getByTestId('inspector-image')).toBeVisible();
  await page.getByTestId('image-aspect-ratio').selectOption('video');
  await expect.poll(() => readFile(homeTsx, 'utf8')).toContain('aspect-video');
  expect(existsSync(pkgJson)).toBe(true);
});

test('11. Plain CSS project: inline text selection toolbar, attributes allowlist & target=_blank rel pair', async ({
  page,
}) => {
  const root = await openProject('projects/react-css', 'css', page);
  const homeTsx = join(root, 'src', 'pages', 'Home.tsx');

  // 1. Canvas double-click text edit -> select substring -> InlineTextBar Bold
  const canvas = await getCanvasFrame(page);
  const pEl = canvas.locator('p.lead').first();
  await pEl.dblclick();
  await expect(pEl).toHaveAttribute('contenteditable', /true|plaintext-only/);
  await pEl.evaluate((el) => {
    const textNode = el.firstChild;
    const win = el.ownerDocument.defaultView;
    if (!textNode || !win) return;
    const range = el.ownerDocument.createRange();
    range.setStart(textNode, 0);
    range.setEnd(textNode, 4);
    const sel = win.getSelection();
    sel?.removeAllRanges();
    sel?.addRange(range);
    el.ownerDocument.dispatchEvent(new Event('selectionchange'));
  });

  await expect(page.getByTestId('inline-text-bar')).toBeVisible();
  await page.getByTestId('inline-text-bold').click();
  await expect.poll(() => readFile(homeTsx, 'utf8')).toContain('<strong>Hàng</strong> mới về');

  // 2. Attributes editor: add aria-label & reject blocked onClick; target=_blank auto-adds rel
  await page
    .getByRole('treeitem', { name: /^h1 title/ })
    .first()
    .click();
  await openGroupIfClosed(page, 'attributes');
  await page.getByTestId('attr-add-name').fill('onClick');
  await page.getByTestId('attr-add-value').fill('alert(1)');
  await page.getByTestId('attr-add-submit').click();
  await expect(page.getByTestId('attr-add-error')).toBeVisible();

  await page.getByTestId('attr-add-name').fill('aria-label');
  await page.getByTestId('attr-add-value').fill('Tiêu đề chính');
  await page.getByTestId('attr-add-submit').click();
  await expect.poll(() => readFile(homeTsx, 'utf8')).toContain('aria-label="Tiêu đề chính"');

  await page.getByTestId('attr-quick-target').click();
  await expect.poll(() => readFile(homeTsx, 'utf8')).toContain('target="_blank"');
  await expect.poll(() => readFile(homeTsx, 'utf8')).toContain('rel="noopener noreferrer"');
  expect(await readFile(homeTsx, 'utf8')).not.toContain('onClick=');
});
