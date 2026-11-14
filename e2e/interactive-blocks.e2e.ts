import { existsSync } from 'node:fs';
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

async function openProject(fixture: string, label: string, page: Page): Promise<string> {
  const folder = await copyFixture(fixture);
  const config = await makeTempDir(`interactive-${label}`);
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

test('12. Interactive kit generation, design-mode preview/text-edit, live preview, and Undo', async ({
  page,
}) => {
  const root = await openProject('projects/vite8-react19-ts', 'vite8', page);
  const homeTsx = join(root, 'src', 'pages', 'Home.tsx');
  const tabsKit = join(root, 'src', 'kumicraft', 'Tabs.tsx');
  const modalKit = join(root, 'src', 'kumicraft', 'Modal.tsx');

  await selectMainAndOpenLibrary(page);
  await page.getByTestId('library-add-interactive.tabs').click();
  await expect.poll(() => existsSync(tabsKit)).toBe(true);
  await expect.poll(() => readFile(homeTsx, 'utf8')).toContain('<Tabs');

  await selectMainAndOpenLibrary(page);
  await page.getByTestId('library-add-interactive.modal').click();
  await expect.poll(() => existsSync(modalKit)).toBe(true);
  await expect.poll(() => readFile(homeTsx, 'utf8')).toContain('<Modal');

  const canvas = await getCanvasFrame(page);
  await expect(canvas.getByRole('button', { name: /Mở hộp thoại|Open dialog/ })).toBeVisible({
    timeout: 15_000,
  });

  // Select Modal trigger in Layers, open its <dialog> in Design mode, and edit inner paragraph text.
  await page.getByTestId('activity-layers').click();
  const modalTreeItem = page.getByRole('treeitem', { name: /Mở hộp thoại|Open dialog/ }).first();
  await expect(modalTreeItem).toBeVisible();
  await modalTreeItem.click();

  const previewBtn = page.getByTestId('inspector-preview-interactive');
  await expect(previewBtn).toBeVisible();
  await previewBtn.click();

  const modalParagraph = canvas.locator('dialog[open] p').first();
  await expect(modalParagraph).toBeVisible();
  await modalParagraph.dblclick();
  await expect(modalParagraph).toHaveAttribute('contenteditable', /true|plaintext-only/);
  await page.keyboard.press('Control+a');
  await page.keyboard.type('Updated modal text');
  await page.keyboard.press('Enter');
  await expect.poll(() => readFile(homeTsx, 'utf8')).toContain('Updated modal text');

  // Re-select Modal in Layers to close design-preview dialog, then switch to Preview mode.
  await modalTreeItem.click();
  await expect(previewBtn).toBeVisible();
  await previewBtn.click();
  await expect(canvas.locator('dialog[open]')).toHaveCount(0);
  await page.getByTestId('canvas-mode-toggle').click();

  const secondTab = canvas.getByRole('tab').nth(1);
  await secondTab.click();
  await expect(secondTab).toHaveAttribute('aria-selected', 'true');

  const triggerBtn = canvas.getByRole('button', { name: /Mở hộp thoại|Open dialog/ });
  await triggerBtn.click();
  const dialogEl = canvas.locator('dialog');
  await expect(dialogEl).toHaveAttribute('open', '');
  await page.keyboard.press('Escape');
  await expect(dialogEl).not.toHaveAttribute('open', '');
  await expect(triggerBtn).toBeFocused();

  // Switch back to Design mode and Undo text edit + Modal insertion cleanly.
  await page.getByTestId('canvas-mode-toggle').click();
  const undoBtn = page.getByRole('button', { name: undoLabel() });
  await undoBtn.click();
  await expect.poll(() => readFile(homeTsx, 'utf8')).not.toContain('Updated modal text');
  await undoBtn.click();
  await expect.poll(() => readFile(homeTsx, 'utf8')).not.toContain('<Modal');
  await expect.poll(() => existsSync(modalKit)).toBe(false);
});

test('13. Interactive blocks work with plain CSS and prefer shadcn Tabs when present', async ({
  page,
}) => {
  // Part A: plain CSS project generates .kc-* CSS rules + kit Tabs.
  const cssRoot = await openProject('projects/react-css', 'css', page);
  await selectMainAndOpenLibrary(page);
  await page.getByTestId('library-add-interactive.tabs').click();

  const cssHome = join(cssRoot, 'src', 'pages', 'Home.tsx');
  const cssFile = join(cssRoot, 'src', 'pages', 'Home.css');
  await expect.poll(() => existsSync(join(cssRoot, 'src', 'kumicraft', 'Tabs.tsx'))).toBe(true);
  await expect.poll(() => readFile(cssHome, 'utf8')).toContain('<Tabs');
  await expect.poll(() => readFile(cssFile, 'utf8')).toContain('.kc-');

  // Stop first session cleanly before launching shadcn project test.
  const firstSession = sessions.pop();
  if (firstSession !== undefined) await firstSession.stop();

  // Part B: react-shadcn uses @/components/ui/tabs without src/kumicraft/Tabs.tsx,
  // while interactive.modal falls back to generating src/kumicraft/Modal.tsx.
  const shadcnRoot = await openProject('projects/react-shadcn', 'shadcn', page);
  await selectMainAndOpenLibrary(page);
  await expect(page.getByTestId('library-kit-badge-interactive.tabs')).toBeVisible();
  await page.getByTestId('library-add-interactive.tabs').click();

  const shadcnHome = join(shadcnRoot, 'src', 'pages', 'Home.tsx');
  await expect.poll(() => readFile(shadcnHome, 'utf8')).toContain("from '@/components/ui/tabs'");
  expect(existsSync(join(shadcnRoot, 'src', 'kumicraft', 'Tabs.tsx'))).toBe(false);

  await selectMainAndOpenLibrary(page);
  await page.getByTestId('library-add-interactive.modal').click();
  await expect.poll(() => existsSync(join(shadcnRoot, 'src', 'kumicraft', 'Modal.tsx'))).toBe(true);
  await expect.poll(() => readFile(shadcnHome, 'utf8')).toContain('<Modal');
});
