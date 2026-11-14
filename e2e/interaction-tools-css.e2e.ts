// E2E test for K9.8-1 Group 12: Plain CSS project (react-css) SelectGroup + Dark style rules in .css (no Tailwind classes).
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import { expect, test } from '@playwright/test';

import { type CliSession, startCli } from './support/cli-session.ts';
import { copyFixture, makeTempDir, type TempDir } from './support/copy-fixture.ts';
import { getCanvasFrame, trustIfAsked } from './support/trust.ts';

let folder: TempDir | undefined;
let config: TempDir;
const sessions: CliSession[] = [];

test.beforeEach(async ({ browserName }) => {
  config = await makeTempDir(`interaction-css-cfg-${browserName}`);
});

test.afterEach(async () => {
  for (const session of sessions.splice(0)) await session.stop();
  await folder?.remove();
  folder = undefined;
  await config.remove();
});

test('Group 12: Plain CSS SelectGroup writes [data-selected="true"] rule and dark style writes .dark selector in CSS', async ({
  page,
}) => {
  folder = await copyFixture('projects/react-css');
  const home = join(folder.path, 'src', 'pages', 'Home.tsx');
  const indexCss = join(folder.path, 'src', 'index.css');

  await writeFile(
    home,
    [
      'export function Home() {',
      '  return (',
      '    <main className="home">',
      '      <div className="plans">',
      '        <div className="plan-card plan-card-selected">Cơ bản</div>',
      '        <div className="plan-card">Nâng cao</div>',
      '      </div>',
      '      <div className="box">Khối nền tối</div>',
      '    </main>',
      '  );',
      '}',
      '',
    ].join('\n'),
    'utf8',
  );
  await writeFile(
    indexCss,
    [
      '.plan-card { padding: 12px; color: #0f172a; }',
      '.plan-card-selected { border: 2px solid #2563eb; }',
      '.box { padding: 12px; background-color: #ffffff; color: #0f172a; }',
      '',
    ].join('\n'),
    'utf8',
  );

  const session = await startCli(folder.path, config.path);
  sessions.push(session);
  await page.goto(session.studioUrl);
  await trustIfAsked(page);
  const canvas = await getCanvasFrame(page);
  await expect(canvas.getByText('Cơ bản')).toBeVisible({ timeout: 20_000 });

  // Drill onto Card 1 then Shift-select Card 2 on Canvas, then Make SelectGroup
  await canvas.getByText('Cơ bản').click();
  await canvas.getByText('Cơ bản').click();
  await canvas.getByText('Nâng cao').click({ modifiers: ['Shift'] });
  const makeBtn = page.getByTestId('make-select-group');
  await expect(makeBtn).toBeEnabled({ timeout: 10_000 });
  await makeBtn.click();

  await expect.poll(() => readFile(home, 'utf8')).toContain('<SelectGroup');
  const homeAfterGroup = await readFile(home, 'utf8');
  expect(homeAfterGroup).not.toContain('data-[selected=true]:');
  await expect.poll(() => readFile(indexCss, 'utf8')).toContain('[data-selected="true"]');
  // [QA K9.8-1] No wrapper: the chosen card stays a direct child of its own container.
  const chosen = canvas.locator('[data-selected="true"]').first();
  await expect(chosen).toBeVisible({ timeout: 10_000 });
  expect(
    await chosen.evaluate((el) =>
      el.parentElement ? getComputedStyle(el.parentElement).display : 'none',
    ),
  ).not.toBe('contents');

  // Select .box via Layer Tree and apply dark mode background color -> writes .dark selector into CSS
  await page
    .getByRole('treeitem', { name: /div box/ })
    .first()
    .click();
  const darkToggle = page.getByTestId('inspector-dark-toggle');
  await expect(darkToggle).toBeVisible({ timeout: 10_000 });
  await darkToggle.click();
  // This plain-CSS project has no dark mode yet: setting it up is handed to the AI tab.
  await expect(page.getByTestId('dark-mode-ask-ai').first()).toBeVisible({ timeout: 10_000 });
  const bgInput = page.getByTestId('style-input-backgroundColor');
  await expect(bgInput).toBeVisible({ timeout: 10_000 });
  await bgInput.fill('#0f172a');
  await bgInput.press('Enter');

  await expect.poll(() => readFile(indexCss, 'utf8')).toContain('.dark ');
  await expect.poll(() => readFile(indexCss, 'utf8')).toContain('#0f172a');
  const finalHome = await readFile(home, 'utf8');
  expect(finalHome).not.toContain('dark:bg-');
});
