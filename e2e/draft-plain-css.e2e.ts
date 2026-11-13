// A new draft in a plain-CSS project (spec-log #130, like MarketLink): its root is written without
// Tailwind so it has a size, a Library block lands in it, and opening the draft from Files keeps
// it a draft instead of designing it as a component of the page shown.
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

import { expect, test } from '@playwright/test';

import { type CliSession, startCli } from './support/cli-session.ts';
import { copyFixture, makeTempDir, type TempDir } from './support/copy-fixture.ts';
import { getCanvasFrame, trustIfAsked } from './support/trust.ts';

let folder: TempDir;
let config: TempDir;
const sessions: CliSession[] = [];

test.beforeEach(async ({ browserName }) => {
  folder = await copyFixture('projects/react-css');
  config = await makeTempDir(`draft-css-config-${browserName}`);
});

test.afterEach(async () => {
  for (const session of sessions.splice(0)) await session.stop();
  await folder.remove();
  await config.remove();
});

test('a draft in a plain-CSS project has a size, takes a Library block and opens from Files as a draft [R-DR-10, spec-log #130]', async ({
  page,
}) => {
  const session = await startCli(folder.path, config.path);
  sessions.push(session);
  const tab = await page.context().newPage();
  await tab.goto(session.studioUrl);
  await trustIfAsked(tab);
  await getCanvasFrame(tab);

  await tab.getByTestId('activity-drafts').click();
  await tab.getByTestId('drafts-new-btn').click();
  await tab.getByTestId('draft-create').click();

  const draftFile = await (async () => {
    const files = ['BanNhap1.jsx', 'BanNhap1.tsx'].map((f) =>
      join(folder.path, 'src', 'drafts', f),
    );
    for (let i = 0; i < 50; i += 1) {
      for (const f of files) {
        const text = await readFile(f, 'utf8').catch(() => '');
        if (text !== '') return f;
      }
      await tab.waitForTimeout(200);
    }
    throw new Error('No draft file was written');
  })();
  const code = await readFile(draftFile, 'utf8');
  expect(code).not.toContain('min-h-screen');
  expect(code).toContain('minHeight');

  // The root fills the frame: there is something to select and somewhere to drop.
  const canvas = await getCanvasFrame(tab);
  const root = canvas.locator('[data-rc-loc*="drafts/BanNhap1"]').first();
  await expect.poll(async () => (await root.boundingBox())?.height ?? 0).toBeGreaterThan(100);
  const box = await root.boundingBox();
  if (!box) throw new Error('No box for the draft root');
  await tab.mouse.click(box.x + 20, box.y + 20);
  await expect(tab.getByText(/src\/drafts\/BanNhap1\.(jsx|tsx):/)).toBeVisible();

  await tab.getByTestId('activity-library').click();
  await tab.getByTestId('library-add-layout.section').click();
  await expect
    .poll(async () => readFile(draftFile, 'utf8'), { timeout: 10_000 })
    .toMatch(/<section/);

  // Opening it from Files keeps it a draft: no "Back to page", nothing greyed out.
  await tab.getByTestId('activity-files').click();
  const draftRow = tab.getByTestId(`file-row-src/drafts/${draftFile.split(/[\\/]/).pop() ?? ''}`);
  const draftsRow = tab.getByTestId('file-row-src/drafts');
  // The tree may already show the folders of the open file; expand only what is closed.
  const srcRow = tab.getByTestId('file-row-src');
  if ((await srcRow.getAttribute('aria-expanded')) !== 'true') await srcRow.click();
  if ((await draftsRow.getAttribute('aria-expanded')) !== 'true') await draftsRow.click();
  await draftRow.click();
  await expect(tab.getByTestId('design-bar-back')).toHaveCount(0);
});
