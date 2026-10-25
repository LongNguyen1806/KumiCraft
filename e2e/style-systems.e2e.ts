// Style layer on Bootstrap, Sass and Less projects (SPEC-04 M-ST, R-ST-02): the Inspector shows
// and edits the real source, Brand reads the system's tokens, and Library blocks use its classes.
import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

import { expect, type Page, test } from '@playwright/test';

import { type CliSession, startCli } from './support/cli-session.ts';
import { copyFixture, makeTempDir, type TempDir } from './support/copy-fixture.ts';
import { getCanvasFrame, trustIfAsked } from './support/trust.ts';

let folder: TempDir | undefined;
let config: TempDir;
const sessions: CliSession[] = [];

async function openProject(page: Page, fixture: string, visibleText: string): Promise<string> {
  folder = await copyFixture(fixture);
  const session = await startCli(folder.path, config.path);
  sessions.push(session);
  await page.goto(session.studioUrl);
  await trustIfAsked(page);
  const canvas = await getCanvasFrame(page);
  await expect(canvas.getByText(visibleText).first()).toBeVisible({ timeout: 20_000 });
  return folder.path;
}

test.beforeEach(async ({ browserName }) => {
  config = await makeTempDir(`style-systems-config-${browserName}`);
});

test.afterEach(async () => {
  for (const session of sessions.splice(0)) await session.stop();
  await folder?.remove();
  folder = undefined;
  await config.remove();
});

test('Bootstrap: a utility class is the source, a scale value becomes a utility, the card block uses Bootstrap classes [R-ST-04, R-ST-10, R-ST-12]', async ({
  page,
}) => {
  const root = await openProject(page, 'projects/react-bootstrap', 'Sản phẩm');
  const home = join(root, 'src', 'pages', 'Home.tsx');

  await page
    .getByRole('treeitem', { name: /^div card/ })
    .first()
    .click();
  await expect(page.getByTestId('style-source-paddingTop')).toContainText('p-3');
  const padding = page.getByTestId('style-input-paddingTop');
  await padding.fill('24px');
  await padding.press('Enter');
  await expect
    .poll(() => readFile(home, 'utf8'))
    .toContain('<div className="card p-3 mb-3 pt-4">Bàn phím</div>');

  // The card is still selected: the block goes into it.
  await page.getByTestId('activity-library').click();
  await page.getByTestId('library-add-composite.card').click();
  await expect.poll(() => readFile(home, 'utf8')).toContain('card-body');
  // Bootstrap's own classes style the block: no CSS file is made for it.
  expect(existsSync(join(root, 'src', 'pages', 'Home.css'))).toBe(false);
});

for (const [system, fixture, cardFile, variable] of [
  ['Sass', 'projects/react-sass', ['src', 'styles', '_card.scss'], '$brand'],
  ['Less', 'projects/react-less', ['src', 'styles', 'card.less'], '@brand'],
] as const) {
  test(`${system}: a nested rule shows and edits its own file and line, and Brand reads ${variable} [R-ST-04, R-ST-06, R-ST-11]`, async ({
    page,
  }) => {
    const root = await openProject(page, fixture, 'Thẻ 1');
    const card = join(root, ...cardFile);
    const before = await readFile(card, 'utf8');

    await page
      .getByRole('treeitem', { name: /^h2 title/ })
      .first()
      .click();
    await expect(page.getByTestId('style-source-fontSize')).toContainText(
      `${cardFile.join('/')}:4`,
    );
    const fontSize = page.getByTestId('style-input-fontSize');
    await fontSize.fill('20px');
    await fontSize.press('Enter');
    await expect
      .poll(() => readFile(card, 'utf8'))
      .toBe(before.replace('font-size: 18px;', 'font-size: 20px;'));

    await page.getByTestId('activity-brand').click();
    await expect(
      page.getByTestId('brand-token-variable').filter({ hasText: variable }),
    ).toBeVisible();
  });
}
