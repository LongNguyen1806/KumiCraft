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
  const config = await makeTempDir(`library-b-${label}`);
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

test('24. react-shadcn project: inserts Button with alias import and Card with glass style', async ({
  page,
}) => {
  const root = await openProject('projects/react-shadcn', 'shadcn', page);
  await selectMainAndOpenLibrary(page);

  await expect(page.getByTestId('library-kit-badge-form.button')).toBeVisible();
  await expect(page.getByTestId('library-kit-badge-composite.card')).toBeVisible();

  await page.getByTestId('library-add-form.button').click();

  const homeTsx = join(root, 'src', 'pages', 'Home.tsx');
  await expect.poll(() => readFile(homeTsx, 'utf8')).toContain('<Button');
  await expect
    .poll(() => readFile(homeTsx, 'utf8'))
    .toContain("import { Button } from '@/components/ui/button'");

  // Re-select main container before inserting glass card
  await selectMainAndOpenLibrary(page);
  await page.getByTestId('library-style-select').selectOption('glass');
  await page.getByTestId('library-add-composite.card').click();

  await expect.poll(() => readFile(homeTsx, 'utf8')).toContain('<Card');
  await expect.poll(() => readFile(homeTsx, 'utf8')).toContain('backdrop-blur-md');
});

test('25. Brand palette suggestion: picks seed color and adds primary + primary-foreground to theme', async ({
  page,
}) => {
  const root = await openProject('projects/vite8-react19-ts', 'palette', page);
  await page.getByTestId('activity-brand').click();
  await expect(page.getByTestId('brand-panel')).toBeVisible();

  await page.getByTestId('brand-palette-open').click();
  await expect(page.getByTestId('brand-palette-panel')).toBeVisible();

  const seedInput = page.getByTestId('brand-palette-seed');
  await seedInput.fill('#0f172a');
  await page.getByTestId('brand-palette-apply').click();

  const indexCss = join(root, 'src', 'index.css');
  await expect.poll(() => readFile(indexCss, 'utf8')).toContain('--color-primary:');
  await expect.poll(() => readFile(indexCss, 'utf8')).toContain('--color-primary-foreground:');
});
