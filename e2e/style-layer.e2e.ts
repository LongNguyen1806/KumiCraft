// Style layer on a plain CSS project (VG-19, SPEC-04 M-ST): the browser's cascade comes back to the
// right file and line, and editing a declaration updates the page by HMR without a reload.
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import { expect, type Frame, type Page, test } from '@playwright/test';

import { type CliSession, startCli } from './support/cli-session.ts';
import { copyFixture, makeTempDir, type TempDir } from './support/copy-fixture.ts';
import { getCanvasFrame, trustIfAsked } from './support/trust.ts';
import { ui } from './support/ui-text.ts';

let folder: TempDir;
let config: TempDir;
const sessions: CliSession[] = [];

/** The Canvas iframe is the only frame of the Studio page. */
function canvasFrame(page: Page): Frame {
  const frame = page.frames().find((f) => f.parentFrame() === page.mainFrame());
  if (frame === undefined) throw new Error('The Canvas has no frame');
  return frame;
}

const firstCardPadding = (frame: Frame) =>
  frame.evaluate(() => {
    const card = document.querySelector('article.card');
    return card instanceof HTMLElement ? getComputedStyle(card).paddingTop : '';
  });

/** Undo of the top bar: "Undo (Ctrl+Z)", or "Undo <step> (Ctrl+Z)" once there is a step. */
const undoLabel = () => new RegExp(`^${ui('editor.undo').split(' (')[0] ?? ''}\\b.*\\(`);

const computedOf = (frame: Frame, selector: string, property: string) =>
  frame.evaluate(
    ([sel, prop]) =>
      Array.from(document.querySelectorAll(sel)).map((el) =>
        getComputedStyle(el).getPropertyValue(prop),
      ),
    [selector, property] as const,
  );

async function openProject(page: Page): Promise<void> {
  const session = await startCli(folder.path, config.path);
  sessions.push(session);
  await page.goto(session.studioUrl);
  await trustIfAsked(page);
  const canvas = await getCanvasFrame(page);
  await expect(canvas.getByRole('heading', { name: 'Sản phẩm' })).toBeVisible({ timeout: 20_000 });
}

test.beforeEach(async ({ browserName }) => {
  folder = await copyFixture('projects/react-css');
  config = await makeTempDir(`style-config-${browserName}`);
});

test.afterEach(async () => {
  for (const session of sessions.splice(0)) await session.stop();
  await folder.remove();
  await config.remove();
});

test('plain CSS: the Inspector shows the winning file:line and the shared rule, and a CSS edit hot-reloads [VG-19, R-ST-04, R-ST-05]', async ({
  page,
}) => {
  const session = await startCli(folder.path, config.path);
  sessions.push(session);
  await page.goto(session.studioUrl);
  await trustIfAsked(page);
  const canvas = await getCanvasFrame(page);
  await expect(canvas.getByRole('heading', { name: 'Sản phẩm' })).toBeVisible({ timeout: 20_000 });

  const card = page.getByRole('treeitem', { name: /^article card/ }).first();
  await card.click();

  // `.card { padding: 16px }` (line 2) is shared by 3 cards; `.home .card` (line 8) wins the background.
  const padding = page.getByTestId('style-source-paddingTop');
  await expect(page.getByTestId('style-input-paddingTop')).toHaveValue('16px');
  await expect(padding).toContainText('src/components/Card.css:2');
  await expect(page.getByTestId('style-affects-paddingTop')).toBeVisible();
  await expect(page.getByTestId('style-source-backgroundColor')).toContainText(
    'src/components/Card.css:8',
  );
  await expect(page.getByTestId('style-source-borderRadius')).toContainText(
    'src/components/Card.css:4',
  );

  const frame = canvasFrame(page);
  await frame.evaluate(() => {
    Object.assign(window, { rcNoReloadMark: true });
  });
  const cssFile = join(folder.path, 'src', 'components', 'Card.css');
  await writeFile(
    cssFile,
    (await readFile(cssFile, 'utf8')).replace('padding: 16px;', 'padding: 20px;'),
  );

  await expect.poll(() => firstCardPadding(frame), { timeout: 15_000 }).toBe('20px');
  expect(await frame.evaluate(() => 'rcNoReloadMark' in window)).toBe(true);

  await page.getByRole('treeitem', { name: /^h1 title/ }).click();
  await card.click();
  await expect(page.getByTestId('style-input-paddingTop')).toHaveValue('20px');
  await expect(padding).toContainText('src/components/Card.css:2');
});

test('plain CSS: "all 3" changes the shared rule, "only this element" gets its own class, one Undo each [R-ST-06, R-ST-07, R-ST-15]', async ({
  page,
}) => {
  await openProject(page);
  const frame = canvasFrame(page);
  const cardCss = join(folder.path, 'src', 'components', 'Card.css');
  const indexCss = join(folder.path, 'src', 'index.css');
  const homeTsx = join(folder.path, 'src', 'pages', 'Home.tsx');
  const before = {
    card: await readFile(cardCss, 'utf8'),
    index: await readFile(indexCss, 'utf8'),
    home: await readFile(homeTsx, 'utf8'),
  };
  const undo = page.getByRole('button', { name: undoLabel() });

  await page
    .getByRole('treeitem', { name: /^article card/ })
    .first()
    .click();
  await expect(page.getByTestId('style-target-rule')).toBeChecked();
  const padding = page.getByTestId('style-input-paddingTop');
  await padding.fill('24px');
  await padding.press('Enter');
  await expect
    .poll(() => computedOf(frame, 'article.card', 'padding-top'))
    .toEqual(['24px', '24px', '24px']);
  expect(await readFile(cardCss, 'utf8')).toBe(
    before.card.replace(
      'border-radius: var(--radius);',
      'border-radius: var(--radius);\n  padding-top: 24px;',
    ),
  );
  await undo.click();
  await expect.poll(() => readFile(cardCss, 'utf8')).toBe(before.card);

  await page
    .getByRole('treeitem', { name: /^p lead/ })
    .first()
    .click();
  await page.getByTestId('style-target-element').check();
  const fontSize = page.getByTestId('style-input-fontSize');
  await fontSize.fill('22px');
  await fontSize.press('Enter');
  await expect.poll(() => computedOf(frame, 'p.lead', 'font-size')).toEqual(['22px', '18px']);
  expect(await readFile(homeTsx, 'utf8')).toMatch(
    /<p className="lead lead-[a-z0-9]{4}">Hàng mới về/,
  );
  expect(await readFile(indexCss, 'utf8')).toMatch(
    /\.lead\.lead-[a-z0-9]{4} \{\n {2}font-size: 22px;\n\}\n$/,
  );
  await undo.click();
  // One history entry, written back file by file: wait for both.
  await expect.poll(() => readFile(homeTsx, 'utf8')).toBe(before.home);
  await expect.poll(() => readFile(indexCss, 'utf8')).toBe(before.index);
});
