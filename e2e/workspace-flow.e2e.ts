// SPEC-04.1 section 17.2 and SPEC-07 WP-1.06: the main path of a user, on the built CLI.
// AC-01 (create, then come back to the same design), workspace trust (S-80, S-81) and restoring a
// broken file from its backup (NFR-07, R-WS-02).
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import { expect, type Page, test } from '@playwright/test';

import { type CliSession, startCli } from './support/cli-session.ts';
import { makeTempDir, type TempDir } from './support/copy-fixture.ts';

type DocumentData = {
  readonly data: {
    readonly revision: number;
    readonly document: {
      readonly workspace: { readonly pageOrder: readonly string[] };
      readonly pages: Readonly<Record<string, { readonly root: { readonly id: string } }>>;
    };
  };
};

let workspace: TempDir;
let config: TempDir;
const sessions: CliSession[] = [];

const start = async (configDir = config.path) => {
  const session = await startCli(workspace.path, configDir);
  sessions.push(session);
  return session;
};

test.beforeEach(async ({ browserName }) => {
  workspace = await makeTempDir(`flow-${browserName}`);
  config = await makeTempDir(`flow-config-${browserName}`);
});

test.afterEach(async () => {
  for (const session of sessions.splice(0)) await session.stop();
  await workspace.remove();
  await config.remove();
});

/** Opens a session in a new tab, as the CLI does for each start. */
async function open(page: Page, session: CliSession): Promise<Page> {
  const tab = await page.context().newPage();
  await tab.goto(session.studioUrl);
  return tab;
}

async function createInStudio(page: Page, name: string) {
  await page.getByLabel('Tên workspace').fill(name);
  await page.getByRole('button', { name: 'Tạo workspace' }).click();
  await expect(page.getByTestId('frame')).toBeVisible();
}

/** Adds a heading through the API and waits until it is on disk (writes land within 2 s). */
async function addHeading(session: CliSession, text: string) {
  const { data } = (await session.api('workspace/document')) as DocumentData;
  const pageId = data.document.workspace.pageOrder[0] ?? '';
  await session.api('workspace/operations', 'POST', {
    baseRevision: data.revision,
    meta: { source: 'user', label: 'Add heading' },
    ops: [
      {
        op: 'insert',
        target: { kind: 'page', pageId },
        parentId: data.document.pages[pageId]?.root.id,
        index: 0,
        node: { id: 'n_heading001', type: 'Heading', content: { kind: 'heading', text, level: 1 } },
      },
    ],
  });
  const file = join(workspace.path, '.reactcraft', 'pages', `${pageId}.json`);
  await expect
    .poll(async () => (await readFile(file, 'utf8')).includes(text), { timeout: 5000 })
    .toBe(true);
  return file;
}

test('AC-01: an empty folder leads to Welcome, then to the Editor with the Home page', async ({
  page,
}) => {
  const session = await start();
  await page.goto(session.studioUrl);

  await expect(page.getByRole('heading', { name: 'Chào mừng tới ReactCraft' })).toBeVisible();
  await createInStudio(page, 'Cửa hàng');

  await expect(page.getByTestId('page-picker').locator('option:checked')).toHaveText('Home');
  await expect(page.getByTestId('layer-list')).toContainText('Stack');
  await expect(page.getByTestId('sync-status')).toHaveText('Đã lưu');
  // Made here by the user: trusted at once (spec-log #57).
  await expect(page.getByTestId('trust-bar')).toHaveCount(0);
});

test('AC-01: closing ReactCraft and opening it again keeps the design', async ({ page }) => {
  const first = await start();
  await page.goto(first.studioUrl);
  await createInStudio(page, 'Cửa hàng');
  await addHeading(first, 'Bộ sưu tập thu');
  await first.stop();

  const tab = await open(page, await start());

  await expect(tab.getByTestId('layer-list')).toContainText('Bộ sưu tập thu');
  await expect(tab.getByText('revision 1')).toBeVisible();
});

test('S-80, S-81: a workspace made elsewhere asks for trust, and the answer is remembered', async ({
  page,
}) => {
  const elsewhere = await makeTempDir('flow-elsewhere');
  const author = await start(elsewhere.path);
  await author.api('workspace', 'POST', { name: 'Từ Git' });
  await author.stop();

  const tab = await open(page, await start());
  await expect(tab.getByRole('dialog', { name: 'Bạn có tin tưởng workspace này?' })).toBeVisible();
  await tab.getByRole('button', { name: 'Chưa, chỉ xem và sửa thiết kế' }).click();
  await expect(tab.getByTestId('trust-bar')).toBeVisible();
  await tab.getByRole('button', { name: 'Xem và tin cậy' }).click();
  await tab.getByRole('button', { name: 'Tin cậy workspace này' }).click();
  await expect(tab.getByTestId('trust-bar')).toHaveCount(0);

  for (const session of sessions.splice(0)) await session.stop();
  const again = await open(page, await start());
  await expect(again.getByTestId('frame')).toBeVisible();
  await expect(again.getByTestId('trust-bar')).toHaveCount(0);
  await elsewhere.remove();
});

test('NFR-07, R-WS-02: a broken page file is restored from its latest backup', async ({ page }) => {
  const first = await start();
  await first.api('workspace', 'POST', { name: 'Cửa hàng' });
  const file = await addHeading(first, 'Bộ sưu tập thu');
  await first.stop();
  await writeFile(file, '{ "broken');

  const tab = await open(page, await start());
  await expect(tab.getByTestId('problem-file')).toContainText('.reactcraft/pages/');
  await tab.getByRole('button', { name: 'Khôi phục bản sao lưu gần nhất' }).click();

  await expect(tab.getByTestId('frame')).toBeVisible();
});
