// E2E Test 12: Data tools flow (form/table from sources, repeat element + DataGrid edit, DataTable preview, typed props + Undo).
import { existsSync } from 'node:fs';
import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';

import { expect, type Page, test } from '@playwright/test';

import { type CliSession, startCli } from './support/cli-session.ts';
import { copyFixture, makeTempDir, type TempDir } from './support/copy-fixture.ts';
import { getCanvasFrame, trustIfAsked } from './support/trust.ts';
import { ui } from './support/ui-text.ts';

const tempDirs: TempDir[] = [];
const sessions: CliSession[] = [];

const undoLabel = () => new RegExp(`^${ui('editor.undo').split(' (')[0] ?? ''}\\b.*\\(`);

async function openDataFixture(page: Page): Promise<string> {
  const folder = await copyFixture('projects/react-data');
  const config = await makeTempDir('e2e-data-tools');
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

test('12. Data sources picker (TS/Zod/Django/OpenAPI), Repeat element + DataGrid, DataTable live preview, and setProp + Undo', async ({
  page,
}) => {
  const root = await openDataFixture(page);
  const homeTsx = join(root, 'src', 'pages', 'Home.tsx');
  const dataDir = join(root, 'src', 'kumicraft', 'data');

  // 1) Insert Form from data source (verify TS, Zod, Django, OpenAPI all appear)
  await selectTreeItem(page, /\bmain\b/);
  await page.getByTestId('activity-library').click();
  await page.getByTestId('library-add-data.form-from-source').click();

  const sourceSelect = page.getByTestId('data-source-select');
  await expect(sourceSelect).toBeVisible({ timeout: 15_000 });
  const optionTexts = await sourceSelect.locator('option').allTextContents();
  expect(optionTexts.some((t) => t.includes('UserInput'))).toBe(true);
  expect(optionTexts.some((t) => t.includes('ProductSchema'))).toBe(true);
  expect(optionTexts.some((t) => t.includes('Customer'))).toBe(true);
  expect(optionTexts.some((t) => t.includes('Order'))).toBe(true);

  await expect(page.locator('[data-testid^="data-field-toggle-"]').first()).toBeVisible();
  await page.getByTestId('data-source-confirm').click();
  await expect.poll(() => readFile(homeTsx, 'utf8')).toContain('<form');

  // 2) Insert DataTable from Zod ProductSchema source and test Search + Sort in Preview
  await selectTreeItem(page, /\bmain\b/);
  await page.getByTestId('activity-library').click();
  await page.getByTestId('library-add-data.table-from-source').click();
  await expect(sourceSelect).toBeVisible({ timeout: 15_000 });
  const zodValue = await sourceSelect
    .locator('option', { hasText: 'ProductSchema' })
    .first()
    .getAttribute('value');
  if (zodValue) await sourceSelect.selectOption(zodValue);
  await expect(page.getByTestId('data-field-toggle-title')).toBeVisible();
  await page.getByTestId('data-source-confirm').click();

  await expect.poll(() => existsSync(join(root, 'src', 'kumicraft', 'DataTable.tsx'))).toBe(true);
  await expect.poll(() => readFile(homeTsx, 'utf8')).toContain('<DataTable');

  const canvas = await getCanvasFrame(page);
  await page.getByTestId('canvas-mode-toggle').click();
  const searchInput = canvas.getByPlaceholder(/Tìm kiếm|Search/);
  await expect(searchInput).toBeVisible({ timeout: 10_000 });
  const firstSortBtn = canvas.locator('th button').first();
  await firstSortBtn.click();
  await expect(canvas.locator('th[aria-sort="ascending"]').first()).toBeVisible();
  await page.getByTestId('canvas-mode-toggle').click();

  // 3) Repeat standalone card into *.data.ts and edit first cell in DataGrid
  await selectTreeItem(page, /\barticle\b/);
  await page.getByTestId('repeat-from-element').click();
  await expect.poll(() => readFile(homeTsx, 'utf8')).toContain('.map(');

  await expect(page.getByTestId('data-grid')).toBeVisible({ timeout: 10_000 });
  const firstCell = page.locator('[data-testid^="data-cell-0-"]').first();
  await firstCell.fill('Edited Plan');
  await page.getByTestId('data-grid-save').click();

  await expect
    .poll(async () => {
      const files = await readdir(dataDir).catch(() => []);
      for (const f of files) {
        const text = await readFile(join(dataDir, f), 'utf8');
        if (text.includes('Edited Plan')) return true;
      }
      return false;
    })
    .toBe(true);

  // 4) Edit typed component props on <ActionCard> + Undo
  await selectTreeItem(page, /\bActionCard\b/);
  const variantSelect = page.getByTestId('prop-input-variant');
  await expect(variantSelect).toBeVisible({ timeout: 15_000 });
  await variantSelect.selectOption('outline');
  await expect.poll(() => readFile(homeTsx, 'utf8')).toContain('variant="outline"');

  const undoBtn = page.getByRole('button', { name: undoLabel() });
  await expect(undoBtn).toBeEnabled();
  await undoBtn.click();
  await expect.poll(() => readFile(homeTsx, 'utf8')).toContain('variant="primary"');
});
