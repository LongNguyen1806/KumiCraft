// E2E Tests 13 & 14: Quality tools (Advanced FreeFrame, A11y hints + 1-click fix) and multi-system form generation.
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import { expect, type Page, test } from '@playwright/test';

import { type CliSession, startCli } from './support/cli-session.ts';
import { copyFixture, makeTempDir, type TempDir } from './support/copy-fixture.ts';
import { getCanvasFrame, trustIfAsked } from './support/trust.ts';

const tempDirs: TempDir[] = [];
const sessions: CliSession[] = [];

async function openFixture(fixture: string, label: string, page: Page): Promise<string> {
  const folder = await copyFixture(fixture);
  const config = await makeTempDir(label);
  tempDirs.push(folder, config);
  const session = await startCli(folder.path, config.path);
  sessions.push(session);
  await page.goto(session.studioUrl);
  await trustIfAsked(page);
  const canvas = await getCanvasFrame(page);
  await expect(canvas.getByRole('heading', { level: 1 }).first()).toBeVisible({ timeout: 25_000 });
  return folder.path;
}

async function selectTreeItem(page: Page, pattern: RegExp): Promise<void> {
  const layersBtn = page.getByTestId('activity-layers');
  if ((await layersBtn.getAttribute('aria-pressed')) !== 'true') {
    await layersBtn.click();
  }
  await page.getByRole('treeitem', { name: pattern }).first().click();
}

test.afterEach(async () => {
  for (const session of sessions.splice(0)) await session.stop();
  for (const dir of tempDirs.splice(0)) await dir.remove();
});

test('13. Free-frame Advanced accordion on real page, and A11y contrast & 1-click aria-label fix', async ({
  page,
}) => {
  const root = await openFixture('projects/react-data', 'e2e-quality-tools', page);
  const homeTsx = join(root, 'src', 'pages', 'Home.tsx');
  const canvas = await getCanvasFrame(page);

  // Real page keeps FreeFrameToggle tucked inside "Advanced / Nâng cao" inside Auto layout group (for container elements)
  await selectTreeItem(page, /\bmain\b/);
  const layoutGroupBtn = page.getByTestId('inspector-group-layout');
  await expect(layoutGroupBtn).toBeVisible();
  if ((await layoutGroupBtn.getAttribute('aria-expanded')) !== 'true') {
    await layoutGroupBtn.click();
  }
  const advanced = page.getByTestId('free-frame-advanced');
  await expect(advanced).toBeVisible();
  await advanced.locator('summary').click();
  await expect(page.getByTestId('free-frame-toggle')).toBeVisible();

  // Select low-contrast paragraph -> contrast warning displays
  await canvas.getByTestId('low-contrast-text').click();
  await expect(page.getByTestId('a11y-hints')).toBeVisible({ timeout: 10_000 });
  await expect(page.getByTestId('a11y-contrast-warning')).toBeVisible();

  // Select unlabeled icon button -> apply 1-click aria-label fix
  await canvas.getByTestId('unlabeled-icon-btn').click();
  await expect(page.getByTestId('a11y-aria-label-input')).toBeVisible({ timeout: 10_000 });
  await page.getByTestId('a11y-aria-label-input').fill('Settings');
  await page.getByTestId('a11y-fix-aria-label').click();
  await expect.poll(() => readFile(homeTsx, 'utf8')).toContain('aria-label="Settings"');
});

test('14. Generating form from source works cleanly in plain CSS project fixture', async ({
  page,
}) => {
  const folder = await copyFixture('projects/react-css');
  await mkdir(join(folder.path, 'src', 'types'), { recursive: true });
  await writeFile(
    join(folder.path, 'src', 'types', 'contact.ts'),
    'export interface ContactForm {\n  name: string;\n  email: string;\n}\n',
    'utf8',
  );
  const config = await makeTempDir('e2e-data-css');
  tempDirs.push(folder, config);

  const session = await startCli(folder.path, config.path);
  sessions.push(session);
  await page.goto(session.studioUrl);
  await trustIfAsked(page);
  const canvas = await getCanvasFrame(page);
  await expect(canvas.getByRole('heading', { level: 1 }).first()).toBeVisible({ timeout: 25_000 });

  await selectTreeItem(page, /\bmain\b/);
  await page.getByTestId('activity-library').click();
  await page.getByTestId('library-add-data.form-from-source').click();

  const sourceSelect = page.getByTestId('data-source-select');
  await expect(sourceSelect).toBeVisible({ timeout: 15_000 });
  await expect(sourceSelect.locator('option', { hasText: 'ContactForm' })).toHaveCount(1);
  await page.getByTestId('data-source-confirm').click();

  const homeTsx = join(folder.path, 'src', 'pages', 'Home.tsx');
  await expect.poll(() => readFile(homeTsx, 'utf8')).toContain('kc-form');
  await expect(canvas.locator('form.kc-form input[type="email"]')).toBeVisible({ timeout: 10_000 });
});
