// Turning a free frame off gives back what turning it on replaced (spec-log #126), on a block like
// the owner's login page: a decoration placed by its author and a centred text block above it.
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import { expect, type Page, test } from '@playwright/test';

import { type CliSession, startCli } from './support/cli-session.ts';
import { copyFixture, makeTempDir, type TempDir } from './support/copy-fixture.ts';
import { getCanvasFrame, trustIfAsked } from './support/trust.ts';

let folder: TempDir;
let config: TempDir;
const sessions: CliSession[] = [];

const PAGE = `export function Home() {
  return (
    <main className="min-h-screen bg-slate-50 p-6">
      <section className="flex h-[400px] w-[800px] flex-col items-center justify-center bg-white">
        <div className="absolute top-8 right-8 h-20 w-20 bg-pink-200">Trang trí</div>
        <div className="relative z-10 max-w-xl text-center">Chào mừng</div>
      </section>
    </main>
  );
}

export default Home;
`;

const pageFile = () => join(folder.path, 'src', 'pages', 'Home.tsx');
const lineWith = async (text: string): Promise<string> =>
  (await readFile(pageFile(), 'utf8')).split('\n').find((line) => line.includes(text)) ?? '';

test.beforeEach(async ({ browserName }) => {
  folder = await copyFixture('projects/vite8-react19-ts');
  config = await makeTempDir(`free-restore-config-${browserName}`);
  await writeFile(pageFile(), PAGE);
});

test.afterEach(async () => {
  for (const session of sessions.splice(0)) await session.stop();
  await folder.remove();
  await config.remove();
});

/** Opens the page, selects the section (through its text block, then Esc) and turns it free. */
async function openAndTurnOn(page: Page): Promise<Page> {
  const session = await startCli(folder.path, config.path);
  sessions.push(session);
  const tab = await page.context().newPage();
  await tab.goto(session.studioUrl);
  await trustIfAsked(tab);
  const canvas = await getCanvasFrame(tab);
  const text = canvas.getByText('Chào mừng');
  await expect(text).toBeVisible({ timeout: 15_000 });
  await text.click();
  await tab.keyboard.press('Escape');
  const toggle = tab.getByTestId('free-frame-toggle');
  await expect(toggle).toHaveAttribute('aria-checked', 'false');
  await toggle.click();
  await expect.poll(() => lineWith('<section'), { timeout: 10_000 }).toContain('data-rc-free');
  await expect(toggle).toHaveAttribute('aria-checked', 'true');
  return tab;
}

async function turnOff(tab: Page): Promise<void> {
  const toggle = tab.getByTestId('free-frame-toggle');
  await toggle.click();
  await expect.poll(() => lineWith('<section'), { timeout: 10_000 }).not.toContain('data-rc-free');
  await expect(tab.getByTestId('free-frame-restored')).toBeVisible();
}

test('on then off with nothing moved gives the file back byte for byte [spec-log #126]', async ({
  page,
}) => {
  const tab = await openAndTurnOn(page);
  // Turning on placed both children by coordinates.
  expect(await lineWith('Trang trí')).not.toContain('right-8');

  await turnOff(tab);
  expect(await readFile(pageFile(), 'utf8')).toBe(PAGE);
});

test('a block moved while free keeps its place when turned off; the rest comes back [spec-log #126]', async ({
  page,
}) => {
  const tab = await openAndTurnOn(page);
  const canvas = await getCanvasFrame(tab);
  const text = canvas.getByText('Chào mừng');
  const before = await lineWith('Chào mừng');
  await text.click();
  const box = await text.boundingBox();
  if (!box) throw new Error('No box for the text block');
  const x = box.x + box.width / 2;
  const y = box.y + box.height / 2;
  await tab.mouse.move(x, y);
  await tab.mouse.down();
  await tab.mouse.move(x + 60, y + 40, { steps: 10 });
  await tab.mouse.up();
  await expect.poll(() => lineWith('Chào mừng'), { timeout: 10_000 }).not.toBe(before);
  const moved = await lineWith('Chào mừng');

  // Select the section again to reach its switch.
  await tab.keyboard.press('Escape');
  await turnOff(tab);
  expect(await lineWith('Chào mừng')).toBe(moved);
  expect(await lineWith('Trang trí')).toContain('absolute top-8 right-8 h-20 w-20 bg-pink-200');
  // Still the positioning parent of the moved block.
  expect(await lineWith('<section')).toMatch(/\brelative\b/);
});

const NESTED = `export function Home() {
  return (
    <main data-rc-free className="relative h-[700px] w-[1000px] bg-slate-50">
      <section className="absolute top-[40px] left-[300px] h-[400px] w-[500px] bg-white">
        <div className="absolute top-8 right-8 h-20 w-20 bg-pink-200">Góc</div>
        <div className="mx-auto max-w-xl text-center">Khung con</div>
      </section>
    </main>
  );
}

export default Home;
`;

test('a block already placed in a free frame stays put when turned free itself [spec-log #127]', async ({
  page,
}) => {
  await writeFile(pageFile(), NESTED);
  const session = await startCli(folder.path, config.path);
  sessions.push(session);
  const tab = await page.context().newPage();
  await tab.goto(session.studioUrl);
  await trustIfAsked(tab);
  const canvas = await getCanvasFrame(tab);
  const text = canvas.getByText('Khung con');
  await expect(text).toBeVisible({ timeout: 15_000 });
  const section = canvas.locator('section');
  const before = await section.boundingBox();

  await text.click();
  await tab.keyboard.press('Escape');
  await tab.getByTestId('free-frame-toggle').click();
  await expect.poll(() => lineWith('<section'), { timeout: 10_000 }).toContain('data-rc-free');

  // Its own `absolute` is kept: no `relative` beside it to pull it out of its place.
  expect(await lineWith('<section')).not.toMatch(/\brelative\b/);
  await expect
    .poll(async () => {
      const now = await section.boundingBox();
      return now && before ? Math.abs(now.x - before.x) + Math.abs(now.y - before.y) : -1;
    })
    .toBeLessThan(1);
});
