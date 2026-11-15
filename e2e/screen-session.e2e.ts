// "Edit for Mobile only" (spec-log #144), the owner's own steps: a two-column block 808 px wide in
// a free frame; on Mobile the user starts an edit for Mobile only, narrows it and stacks the columns,
// then goes back to Desktop, where the block must still be 808 px wide with two columns side by
// side. Before, the W field and Canvas resizing ignored the screen choice and changed Desktop too.
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import { expect, type FrameLocator, type Page, test } from '@playwright/test';

import { type CliSession, startCli } from './support/cli-session.ts';
import { copyFixture, makeTempDir, type TempDir } from './support/copy-fixture.ts';
import { getCanvasFrame, trustIfAsked } from './support/trust.ts';

let folder: TempDir;
let config: TempDir;
const sessions: CliSession[] = [];

const PAGE = `export function Home() {
  return (
    <main className="min-h-screen bg-slate-50 p-6">
      <section data-rc-free className="relative h-[400px] w-[1000px] bg-white">
        <div className="absolute top-[0px] left-[0px] flex w-[808px] h-[96px] bg-blue-100">
          <div className="flex-1 p-2">Cột 1</div>
          <div className="flex-1 p-2">Cột 2</div>
        </div>
      </section>
    </main>
  );
}

export default Home;
`;

test.beforeEach(async ({ browserName }) => {
  folder = await copyFixture('projects/vite8-react19-ts');
  config = await makeTempDir(`screen-session-${browserName}`);
  await writeFile(join(folder.path, 'src', 'pages', 'Home.tsx'), PAGE);
});

test.afterEach(async () => {
  for (const session of sessions.splice(0)) await session.stop();
  await folder.remove();
  await config.remove();
});

/** Width in px and flex direction of the two-column block, as the frame draws it. */
async function blockLook(canvas: FrameLocator): Promise<{ width: string; direction: string }> {
  // The block is the column's parent: `.absolute` is the one element that carries it.
  return canvas.locator('div.absolute').evaluate((block) => {
    const style = getComputedStyle(block);
    return { width: style.width, direction: style.flexDirection };
  });
}

/** Selects the two-column block: a click lands on a column, the path above goes to its parent. */
async function selectBlock(tab: Page, canvas: FrameLocator): Promise<void> {
  await canvas.getByText('Cột 1').click();
  await tab.getByTestId('inspector-panel').getByText('div.absolute').click();
  await expect(tab.getByTestId('inspector-panel')).toContainText('Home.tsx:5:');
}

test('an edit for Mobile only leaves Desktop as designed [R-IN-12] (spec-log #144)', async ({
  page,
}) => {
  const session = await startCli(folder.path, config.path);
  sessions.push(session);
  const tab = await page.context().newPage();
  await tab.goto(session.studioUrl);
  await trustIfAsked(tab);
  const homeFile = join(folder.path, 'src', 'pages', 'Home.tsx');

  let canvas = await getCanvasFrame(tab);
  await expect(canvas.getByText('Cột 1')).toBeVisible({ timeout: 15_000 });
  // Desktop is where the page is designed: no "only this screen" there.
  await selectBlock(tab, canvas);
  await expect(tab.getByTestId('free-pos-w')).toBeVisible();
  await expect(tab.getByTestId('screen-session-start')).toHaveCount(0);

  await tab.getByTestId('canvas-frame-select').selectOption('mobile');
  canvas = await getCanvasFrame(tab);
  await selectBlock(tab, canvas);
  await tab.getByTestId('screen-session-start').click();
  await expect(tab.getByTestId('screen-session-bar')).toBeVisible();

  // Narrow it with the W field (a Canvas path) and stack the columns (an Inspector field).
  const w = tab.getByTestId('free-pos-w');
  await w.fill('320');
  await w.press('Enter');
  await expect.poll(async () => (await blockLook(canvas)).width, { timeout: 10_000 }).toBe('320px');
  await tab.getByTestId('segment-flexDirection-col').click();
  await expect
    .poll(async () => (await blockLook(canvas)).direction, { timeout: 10_000 })
    .toBe('column');
  await tab.getByTestId('screen-session-done').click();
  await expect(tab.getByTestId('screen-session-bar')).toHaveCount(0);

  // Back on Desktop: still 808 px, two columns side by side.
  await tab.getByTestId('canvas-frame-select').selectOption('desktop');
  canvas = await getCanvasFrame(tab);
  await expect
    .poll(async () => blockLook(canvas), { timeout: 10_000 })
    .toEqual({
      width: '808px',
      direction: 'row',
    });
  // The file says the same: the Mobile values are screen classes, the Desktop ones stay.
  const code = await readFile(homeFile, 'utf8');
  const block = code.split(/\r?\n/).find((line) => line.includes('bg-blue-100')) ?? '';
  // 320 px is w-80 on the Tailwind scale; both Mobile values carry the phone prefix.
  expect(block).toContain(' w-[808px] ');
  expect(block).toContain('max-md:w-80');
  expect(block).toContain('max-md:flex-col');
});
