// Design folders and the folder for new CSS files, set from the project tree (SPEC-04 K3c,
// spec-log #73): workspace.json keeps lists, and a Library block in a page without CSS writes its
// rules to the chosen folder.
import { mkdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';

import { expect, type Page, test } from '@playwright/test';

import { type CliSession, startCli } from './support/cli-session.ts';
import { copyFixture, makeTempDir, type TempDir } from './support/copy-fixture.ts';
import { getCanvasFrame, trustIfAsked } from './support/trust.ts';

let folder: TempDir;
let config: TempDir;
const sessions: CliSession[] = [];

const workspace = () => readFile(join(folder.path, '.kumicraft', 'workspace.json'), 'utf8');

async function folderMenu(page: Page, path: string, item: string): Promise<void> {
  await page.getByTestId(`file-row-${path}`).hover();
  await page.getByTestId(`file-menu-btn-${path}`).click();
  await page.getByTestId(item).click();
}

test.beforeEach(async ({ browserName }) => {
  folder = await copyFixture('projects/react-css');
  config = await makeTempDir(`design-folders-config-${browserName}`);
  await mkdir(join(folder.path, 'src', 'widgets'));
  await mkdir(join(folder.path, 'src', 'styles'));
});

test.afterEach(async () => {
  for (const session of sessions.splice(0)) await session.stop();
  await folder.remove();
  await config.remove();
});

test('a second component folder and the new CSS folder come from the tree [K3c]', async ({
  page,
}) => {
  const session = await startCli(folder.path, config.path);
  sessions.push(session);
  await page.goto(session.studioUrl);
  await trustIfAsked(page);
  const canvas = await getCanvasFrame(page);
  await expect(canvas.getByText('Sản phẩm').first()).toBeVisible({ timeout: 20_000 });

  await page.getByTestId('activity-files').click();
  await page.getByTestId('file-row-src').click();
  await folderMenu(page, 'src/widgets', 'files-menu-use-components-dir');
  await expect
    .poll(workspace)
    .toMatch(/"components":\s*\[\s*"src\/components",\s*"src\/widgets"\s*\]/);

  await folderMenu(page, 'src/styles', 'files-menu-set-new-css-dir');
  await expect.poll(workspace).toMatch(/"newCssDir":\s*"src\/styles"/);

  // Home.tsx imports no CSS: the block's rules go to src/styles, imported relatively.
  await page.getByTestId('activity-layers').click();
  await page
    .getByRole('treeitem', { name: /main home$/ })
    .first()
    .click();
  await page.getByTestId('activity-library').click();
  await page.getByTestId('library-add-layout.row').click();
  const home = join(folder.path, 'src', 'pages', 'Home.tsx');
  await expect.poll(() => readFile(home, 'utf8')).toContain("import '../styles/Home.css';");
  expect(await readFile(join(folder.path, 'src', 'styles', 'Home.css'), 'utf8')).toContain(
    '.kc-row',
  );
});
