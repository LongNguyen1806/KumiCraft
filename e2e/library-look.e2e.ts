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
  const config = await makeTempDir(`library-look-${label}`);
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

test('14. Tailwind project: inserted button adopts @theme brand token', async ({ page }) => {
  const root = await openProject('projects/vite8-react19-ts', 'tw-look', page);
  await selectMainAndOpenLibrary(page);
  await page.getByTestId('library-add-form.button').click();

  const homeTsx = join(root, 'src', 'pages', 'Home.tsx');
  await expect.poll(() => readFile(homeTsx, 'utf8')).toContain('bg-brand');
});

test('15. Tailwind project: outline variant renders border without solid fill', async ({
  page,
}) => {
  const root = await openProject('projects/vite8-react19-ts', 'tw-variant', page);
  await selectMainAndOpenLibrary(page);
  await page.getByTestId('library-variant-form.button').click();
  await expect(page.getByTestId('library-variant-menu')).toBeVisible();
  await page.getByTestId('library-variant-form.button-outline').click();
  await page.getByTestId('library-add-form.button').click();

  const homeTsx = join(root, 'src', 'pages', 'Home.tsx');
  await expect.poll(() => readFile(homeTsx, 'utf8')).toContain('border-brand');
  const content = await readFile(homeTsx, 'utf8');
  expect(content).not.toContain('bg-brand');
});

test('16. Plain CSS project: inserted button emits CSS variables without Tailwind classes', async ({
  page,
}) => {
  const root = await openProject('projects/react-css', 'css-look', page);
  await selectMainAndOpenLibrary(page);
  await page.getByTestId('library-add-form.button').click();

  const homeTsx = join(root, 'src', 'pages', 'Home.tsx');
  const homeCss = join(root, 'src', 'pages', 'Home.css');
  await expect.poll(() => readFile(homeTsx, 'utf8')).toContain('kc-button');
  const tsx = await readFile(homeTsx, 'utf8');
  expect(tsx).not.toMatch(/\bbg-[a-z]/);
  expect(tsx).not.toMatch(/\brounded-[a-z]/);

  await expect
    .poll(() => (existsSync(homeCss) ? readFile(homeCss, 'utf8') : ''))
    .toContain('var(--brand)');
  const css = await readFile(homeCss, 'utf8');
  expect(css).toContain('var(--brand)');
  expect(css).toContain('var(--radius)');
});
