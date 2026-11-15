// A Library block added with its button into a free-frame draft (spec-log #143): it gets a free
// position like a pasted one, so a press on its content selects it, a drag moves it and Delete
// removes it. Before, it stayed in the flow: the press selected the draft root, the drag did
// nothing and Delete answered E023 (root of the component).
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
  folder = await copyFixture('projects/vite8-react19-ts');
  config = await makeTempDir(`free-draft-insert-${browserName}`);
});

test.afterEach(async () => {
  for (const session of sessions.splice(0)) await session.stop();
  await folder.remove();
  await config.remove();
});

const mainLine = async (file: string): Promise<string> =>
  (await readFile(file, 'utf8')).split('\n').find((line) => line.includes('<main')) ?? '';

test('a block added into a free draft can be selected, dragged and deleted [R-FF-12, spec-log #143]', async ({
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
  await tab.getByTestId('draft-kind-free').click();
  await tab.getByTestId('draft-create').click();
  const draftFile = join(folder.path, 'src', 'drafts', 'BanNhap1.tsx');
  await expect
    .poll(() => readFile(draftFile, 'utf8').catch(() => ''), { timeout: 10_000 })
    .toContain('data-rc-free');

  const canvas = await getCanvasFrame(tab);
  const root = canvas.locator('[data-rc-loc*="drafts/BanNhap1"]').first();
  await expect.poll(async () => (await root.boundingBox())?.height ?? 0).toBeGreaterThan(100);
  const box = await root.boundingBox();
  if (!box) throw new Error('No box for the draft root');
  await tab.mouse.click(box.x + 20, box.y + 20);

  await tab.getByTestId('activity-library').click();
  await tab.getByTestId('library-add-screen.list-detail').click();
  // The block lands at a free position inside the frame.
  await expect
    .poll(() => mainLine(draftFile), { timeout: 10_000 })
    .toMatch(/absolute left-\S+ top-\S+/);
  const placed = await mainLine(draftFile);

  // A press on its content selects the block, not the draft root.
  const text = canvas.getByText('Chi tiết nội dung công việc');
  await text.click();
  await expect(tab.getByTestId('inspector-panel')).toContainText('BanNhap1.tsx:3:');

  // A drag moves it.
  const start = await text.boundingBox();
  if (!start) throw new Error('No box for the block text');
  await tab.mouse.move(start.x + 20, start.y + 5);
  await tab.mouse.down();
  await tab.mouse.move(start.x + 140, start.y + 95, { steps: 15 });
  await tab.mouse.up();
  await expect.poll(() => mainLine(draftFile), { timeout: 10_000 }).not.toBe(placed);
  await expect.poll(() => mainLine(draftFile)).toMatch(/absolute left-\S+ top-\S+/);

  // Delete removes it, with no error.
  await tab.keyboard.press('Delete');
  await expect.poll(() => readFile(draftFile, 'utf8'), { timeout: 10_000 }).not.toContain('<main');
  await expect(tab.getByText('(E023)')).toHaveCount(0);
});
