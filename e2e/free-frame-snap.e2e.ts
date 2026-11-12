// Snapping in a free frame (spec-log #125): dragging an element to within a few screen pixels of
// another one's edge sticks it there, at the Canvas zoom the user has; Alt held drags freely.
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import { expect, type Page, test } from '@playwright/test';

import { type CliSession, startCli } from './support/cli-session.ts';
import { copyFixture, makeTempDir, type TempDir } from './support/copy-fixture.ts';
import { getCanvasFrame, trustIfAsked } from './support/trust.ts';

let folder: TempDir;
let config: TempDir;
const sessions: CliSession[] = [];

const FREE_PAGE = `export function Home() {
  return (
    <main className="min-h-screen bg-slate-50 p-6">
      <section data-rc-free className="relative h-[400px] w-[800px] bg-white">
        <div className="absolute top-[40px] left-[40px] h-[50px] w-[100px] bg-blue-200">Khối A</div>
        <div className="absolute top-[200px] left-[300px] h-[50px] w-[100px] bg-pink-200">Khối B</div>
      </section>
    </main>
  );
}

export default Home;
`;

test.beforeEach(async ({ browserName }) => {
  folder = await copyFixture('projects/vite8-react19-ts');
  config = await makeTempDir(`free-snap-config-${browserName}`);
  await writeFile(join(folder.path, 'src', 'pages', 'Home.tsx'), FREE_PAGE);
});

test.afterEach(async () => {
  for (const session of sessions.splice(0)) await session.stop();
  await folder.remove();
  await config.remove();
});

const lineOfA = async (): Promise<string> => {
  const text = await readFile(join(folder.path, 'src', 'pages', 'Home.tsx'), 'utf8');
  return text.split('\n').find((line) => line.includes('Khối A')) ?? '';
};

/**
 * Selects A, then drags it so its left edge stops 5 screen pixels right of B's left edge, which is
 * outside the old 4 page-pixel reach at the fitted zoom and inside the new 8 screen-pixel one.
 */
async function dragANearB(tab: Page, holdAlt: boolean): Promise<void> {
  const canvas = await getCanvasFrame(tab);
  const a = canvas.getByText('Khối A');
  const b = canvas.getByText('Khối B');
  await expect(a).toBeVisible({ timeout: 15_000 });
  await a.click();
  // A child of a free frame: the short warning shows (spec-log #125).
  await expect(tab.getByTestId('free-frame-page-warning')).toBeVisible();

  const boxA = await a.boundingBox();
  const boxB = await b.boundingBox();
  if (!boxA || !boxB) throw new Error('No box for A or B');
  // The fitted zoom must leave the old reach under 5 screen pixels, or the test proves nothing.
  expect(boxB.width / 100).toBeLessThan(0.8);

  const startX = boxA.x + boxA.width / 2;
  const startY = boxA.y + boxA.height / 2;
  const endX = startX + (boxB.x + 5 - boxA.x);
  await tab.mouse.move(startX, startY);
  await tab.mouse.down();
  if (holdAlt) await tab.keyboard.down('Alt');
  await tab.mouse.move(endX, startY, { steps: 12 });
  await tab.mouse.up();
  if (holdAlt) await tab.keyboard.up('Alt');
}

test('a drag that ends a few screen pixels from an edge snaps onto it [R-FF-18, spec-log #125]', async ({
  page,
}) => {
  const session = await startCli(folder.path, config.path);
  sessions.push(session);
  const tab = await page.context().newPage();
  await tab.goto(session.studioUrl);
  await trustIfAsked(tab);
  await expect(tab.getByTestId('canvas-snap-toggle')).toHaveAttribute('aria-pressed', 'true');

  await dragANearB(tab, false);

  await expect.poll(lineOfA, { timeout: 10_000 }).not.toContain('left-[40px]');
  // 300 px is left-75 in Tailwind 4: the very edge of B, not the grid step next to it.
  expect(await lineOfA()).toMatch(/\bleft-(75|\[300px\])(?=[\s"])/);
});

test('holding Alt drags freely: the element stays on the grid, off the edge [spec-log #125]', async ({
  page,
}) => {
  const session = await startCli(folder.path, config.path);
  sessions.push(session);
  const tab = await page.context().newPage();
  await tab.goto(session.studioUrl);
  await trustIfAsked(tab);

  await dragANearB(tab, true);

  await expect.poll(lineOfA, { timeout: 10_000 }).not.toContain('left-[40px]');
  const line = await lineOfA();
  expect(line).toMatch(/\bleft-/);
  expect(line).not.toMatch(/\bleft-(75|\[300px\])(?=[\s"])/);
});
