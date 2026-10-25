// Project file tree (SPEC-04 K3b, spec-log #70): create, rename and delete from the tree land on
// disk, the real watcher keeps them as Studio steps so Undo brings the file back, and a refused
// name shows its reason.
import { existsSync } from 'node:fs';
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import { expect, type Page, test } from '@playwright/test';

import { type CliSession, startCli } from './support/cli-session.ts';
import { copyFixture, makeTempDir, type TempDir } from './support/copy-fixture.ts';
import { getCanvasFrame, trustIfAsked } from './support/trust.ts';
import { ui } from './support/ui-text.ts';

let folder: TempDir;
let config: TempDir;
const sessions: CliSession[] = [];

const undoLabel = () => new RegExp(`^${ui('editor.undo').split(' (')[0] ?? ''}\\b.*\\(`);

async function openTree(page: Page): Promise<void> {
  const session = await startCli(folder.path, config.path);
  sessions.push(session);
  await page.goto(session.studioUrl);
  await trustIfAsked(page);
  await getCanvasFrame(page);
  await page.getByTestId('activity-files').click();
  await expect(page.getByTestId('file-row-src')).toBeVisible();
}

async function rowMenu(page: Page, path: string, item: string): Promise<void> {
  await page.getByTestId(`file-row-${path}`).hover();
  await page.getByTestId(`file-menu-btn-${path}`).click();
  await page.getByTestId(item).click();
}

test.beforeEach(async ({ browserName }) => {
  folder = await copyFixture('projects/vite8-react19-ts');
  config = await makeTempDir(`file-tree-config-${browserName}`);
});

test.afterEach(async () => {
  for (const session of sessions.splice(0)) await session.stop();
  await folder.remove();
  await config.remove();
});

test('create, rename and delete a file from the tree, then Undo restores it [K3b]', async ({
  page,
}) => {
  await openTree(page);
  const notes = join(folder.path, 'notes.md');
  const guide = join(folder.path, 'guide.md');

  await page.getByTestId('files-top-new-file').click();
  const create = page.getByTestId('files-inline-create-input');
  await create.fill('notes.md');
  await create.press('Enter');
  await expect.poll(() => existsSync(notes)).toBe(true);
  await expect(page.getByTestId('file-row-notes.md')).toBeVisible();

  await rowMenu(page, 'notes.md', 'files-menu-rename');
  const rename = page.getByTestId('files-inline-rename-input');
  await rename.fill('guide.md');
  await rename.press('Enter');
  await expect.poll(() => existsSync(guide)).toBe(true);
  expect(existsSync(notes)).toBe(false);
  await expect(page.getByTestId('file-row-guide.md')).toBeVisible();

  await rowMenu(page, 'guide.md', 'files-menu-delete');
  await page.getByTestId('files-delete-confirm').click();
  await expect.poll(() => existsSync(guide)).toBe(false);
  await expect(page.getByTestId('file-row-guide.md')).toHaveCount(0);

  // An outside write after the delete: watcher batches run in order, so once it shows in the
  // tree the watcher has also seen the delete.
  await writeFile(join(folder.path, 'outside.txt'), 'x');
  await expect(page.getByTestId('file-row-outside.txt')).toBeVisible();

  // The watcher saw Studio's own writes: the steps survive and Undo puts the file back.
  const undo = page.getByRole('button', { name: undoLabel() });
  await expect(undo).toBeEnabled();
  await undo.click();
  await expect.poll(() => existsSync(guide)).toBe(true);
  expect(await readFile(guide, 'utf8')).toBe('');
  await expect(page.getByTestId('file-row-guide.md')).toBeVisible();
});

test('a name that already exists is refused with its reason, nothing changes [K3b]', async ({
  page,
}) => {
  await openTree(page);
  const before = await readFile(join(folder.path, 'package.json'), 'utf8');

  await page.getByTestId('files-top-new-file').click();
  const create = page.getByTestId('files-inline-create-input');
  await create.fill('package.json');
  await create.press('Enter');
  await expect(page.getByTestId('files-inline-create-error')).toContainText('(E016)');
  expect(await readFile(join(folder.path, 'package.json'), 'utf8')).toBe(before);
});
