// Style layer on a CSS Modules project (VG-19, SPEC-04 M-ST, R-ST-08): the hashed class the
// browser sees comes back to the source rule by `ruleIndex`, and both targets write the module.
import { readFile } from 'node:fs/promises';
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

test.beforeEach(async ({ browserName }) => {
  folder = await copyFixture('projects/react-css-modules');
  config = await makeTempDir(`style-modules-config-${browserName}`);
});

test.afterEach(async () => {
  for (const session of sessions.splice(0)) await session.stop();
  await folder.remove();
  await config.remove();
});

test('CSS Modules: the source rule behind a hashed class, "all 3" and "only this element", one Undo each [VG-19, R-ST-04, R-ST-08, R-ST-15]', async ({
  page,
}) => {
  const session = await startCli(folder.path, config.path);
  sessions.push(session);
  await page.goto(session.studioUrl);
  await trustIfAsked(page);
  const canvas = await getCanvasFrame(page);
  await expect(canvas.getByRole('heading', { name: 'Sản phẩm' })).toBeVisible({ timeout: 20_000 });
  const frame = canvasFrame(page);
  const cardCss = join(folder.path, 'src', 'components', 'Card.module.css');
  const homeCss = join(folder.path, 'src', 'pages', 'Home.module.css');
  const homeTsx = join(folder.path, 'src', 'pages', 'Home.tsx');
  const before = {
    card: await readFile(cardCss, 'utf8'),
    homeCss: await readFile(homeCss, 'utf8'),
    home: await readFile(homeTsx, 'utf8'),
  };
  const undo = page.getByRole('button', { name: undoLabel() });

  await page
    .getByRole('treeitem', { name: /^article\b/ })
    .first()
    .click();
  await expect(page.getByTestId('style-input-paddingTop')).toHaveValue('16px');
  await expect(page.getByTestId('style-source-paddingTop')).toContainText(
    'src/components/Card.module.css:2',
  );
  await expect(page.getByTestId('style-target-rule')).toBeChecked();
  const padding = page.getByTestId('style-input-paddingTop');
  await padding.fill('24px');
  await padding.press('Enter');
  await expect
    .poll(() => computedOf(frame, 'article', 'padding-top'))
    .toEqual(['24px', '24px', '24px']);
  expect(await readFile(cardCss, 'utf8')).toBe(
    before.card.replace('border-radius: 8px;', 'border-radius: 8px;\n  padding-top: 24px;'),
  );
  await undo.click();
  await expect.poll(() => readFile(cardCss, 'utf8')).toBe(before.card);

  await page.getByRole('treeitem', { name: /^p\b/ }).first().click();
  await page.getByTestId('style-target-element').check();
  const fontSize = page.getByTestId('style-input-fontSize');
  await fontSize.fill('22px');
  await fontSize.press('Enter');
  await expect.poll(() => computedOf(frame, 'main > p', 'font-size')).toEqual(['22px', '18px']);
  expect(await readFile(homeTsx, 'utf8')).toMatch(
    /<p className=\{`\$\{styles\.lead\} \$\{styles\.lead_rc[a-z0-9]{4}\}`\}>Hàng mới về/,
  );
  expect(await readFile(homeCss, 'utf8')).toMatch(
    /\n\.lead_rc[a-z0-9]{4} \{\n {2}font-size: 22px;\n\}\n$/,
  );
  await undo.click();
  // One history entry, written back file by file: wait for both.
  await expect.poll(() => readFile(homeTsx, 'utf8')).toBe(before.home);
  await expect.poll(() => readFile(homeCss, 'utf8')).toBe(before.homeCss);
});
