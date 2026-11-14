// E2E tests for K9.8-1 Group 11: SelectGroup, Linked Content, Toast, and Mixed Text Edit.
import { existsSync } from 'node:fs';
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
  config = await makeTempDir(`interaction-tools-cfg-${browserName}`);
});

test.afterEach(async () => {
  for (const session of sessions.splice(0)) await session.stop();
  await folder?.remove();
  folder = undefined;
  await config.remove();
});

test('Group 11a: SelectGroup multi-select wrap, link content panels, and live Preview switching', async ({
  page,
}) => {
  folder = await copyFixture('projects/vite8-react19-ts');
  const home = join(folder.path, 'src', 'pages', 'Home.tsx');
  await writeFile(
    home,
    [
      'export function Home() {',
      '  return (',
      '    <main className="p-6 space-y-6">',
      '      <div className="grid grid-cols-4 gap-3">',
      '        <div className="p-3 rounded border-2 border-blue-600 bg-blue-50">Gói 1</div>',
      '        <div className="p-3 rounded">Gói 2</div>',
      '        <div className="p-3 rounded">Gói 3</div>',
      '        <div className="p-3 rounded">Gói 4</div>',
      '      </div>',
      '      <section id="feature-preview" className="p-4 border rounded">Khối xem trước</section>',
      '    </main>',
      '  );',
      '}',
      'export default Home;',
      '',
    ].join('\n'),
    'utf8',
  );

  const session = await startCli(folder.path, config.path);
  sessions.push(session);
  await page.goto(session.studioUrl);
  await trustIfAsked(page);
  const canvas = await getCanvasFrame(page);
  await expect(canvas.getByText('Gói 1')).toBeVisible({ timeout: 20_000 });

  // Click twice to drill past the grid container onto Card 1, then Shift-select Cards 2..4 on Canvas
  await canvas.getByText('Gói 1').click();
  await canvas.getByText('Gói 1').click();
  await canvas.getByText('Gói 2').click({ modifiers: ['Shift'] });
  await canvas.getByText('Gói 3').click({ modifiers: ['Shift'] });
  await canvas.getByText('Gói 4').click({ modifiers: ['Shift'] });

  const makeBtn = page.getByTestId('make-select-group');
  await expect(makeBtn).toBeEnabled({ timeout: 10_000 });
  await makeBtn.click();

  await expect.poll(() => readFile(home, 'utf8')).toContain('<SelectGroup');
  await expect.poll(() => readFile(home, 'utf8')).toContain('<SelectItem');
  expect(existsSync(join(folder.path, 'src', 'kumicraft', 'SelectGroup.tsx'))).toBe(true);

  // The group renders no element (QA K9.8-1): its cards stay selectable (Layers lists them) and
  // selecting one opens the group tools. Wait for the page to reload with the kit first.
  await expect(canvas.locator('[role="radio"]')).toHaveCount(4, { timeout: 15_000 });
  await expect(page.getByRole('treeitem', { name: 'div p-3' })).toHaveCount(4, { timeout: 15_000 });
  await canvas.getByText('Gói 1').click();
  await canvas.getByText('Gói 1').click();
  const targetSelect = page.getByTestId('select-group-link-target');
  await expect(targetSelect).toBeVisible({ timeout: 10_000 });
  const sectionOption = await targetSelect
    .locator('option', { hasText: '<section>' })
    .first()
    .getAttribute('value');
  if (typeof sectionOption === 'string' && sectionOption.length > 0) {
    await targetSelect.selectOption(sectionOption);
  }
  await page.getByTestId('select-group-link').click();

  await expect.poll(() => readFile(home, 'utf8')).toContain('<SelectPanel');
  await expect.poll(() => readFile(home, 'utf8')).toContain('linked');

  // Switch to Preview mode and click Card 3 -> data-selected moves to Card 3
  await page.getByTestId('canvas-mode-toggle').click();
  const card3 = canvas.locator('[role="tab"]', { hasText: 'Gói 3' });
  await card3.click();
  await expect(card3).toHaveAttribute('data-selected', 'true');
});

test('Group 11b: No dark tools, Toast on click, and Mixed text run edit preserving SVG', async ({
  page,
}) => {
  folder = await copyFixture('projects/vite8-react19-ts');
  const home = join(folder.path, 'src', 'pages', 'Home.tsx');
  const indexCss = join(folder.path, 'src', 'index.css');
  await writeFile(
    home,
    [
      'export function Home() {',
      '  return (',
      '    <main className="p-6 space-y-4 bg-white text-slate-900">',
      '      <h3 className="flex items-center gap-2 text-lg font-bold">',
      '        <svg data-icon="battery" width="16" height="16" viewBox="0 0 16 16">',
      '          <rect width="16" height="16" />',
      '        </svg>',
      '        Pin &amp; Kết nối',
      '      </h3>',
      '      <button type="button" className="px-4 py-2 rounded bg-blue-600 text-white">',
      '        Đặt hàng',
      '      </button>',
      '    </main>',
      '  );',
      '}',
      'export default Home;',
      '',
    ].join('\n'),
    'utf8',
  );

  const session = await startCli(folder.path, config.path);
  sessions.push(session);
  await page.goto(session.studioUrl);
  await trustIfAsked(page);
  const canvas = await getCanvasFrame(page);
  await expect(canvas.getByRole('button', { name: 'Đặt hàng' })).toBeVisible({ timeout: 20_000 });

  // Dark mode is a job for the AI tab (owner 2026-11-15): no Dark button on the Canvas toolbar and
  // nothing dark is ever written by KumiCraft itself.
  const cssBefore = await readFile(indexCss, 'utf8');
  await expect(page.getByTestId('canvas-dark-preview')).toHaveCount(0);
  expect(await readFile(indexCss, 'utf8')).toBe(cssBefore);
  expect(existsSync(join(folder.path, 'src', 'kumicraft', 'theme.ts'))).toBe(false);

  // Select Đặt hàng button on Canvas, and attach Toast on click
  await canvas.getByRole('button', { name: 'Đặt hàng' }).click();
  await page.getByTestId('open-toast-config-btn').click();
  await page.getByTestId('toast-message-input').fill('Đã thêm vào giỏ');
  await page.getByTestId('apply-toast-on-click').click();
  await expect.poll(() => readFile(home, 'utf8')).toContain('<ToastTrigger');
  await expect.poll(() => readFile(home, 'utf8')).toContain('<ToastHost');

  // Switch to Preview -> clicking Đặt hàng shows the Toast
  await page.getByTestId('canvas-mode-toggle').click();
  await canvas.getByRole('button', { name: 'Đặt hàng' }).click();
  await expect(canvas.getByRole('status')).toContainText('Đã thêm vào giỏ');

  // Switch back to Design -> edit mixed text run on <h3> without removing inline <svg data-icon="battery">
  await page.getByTestId('canvas-mode-toggle').click();
  await page.getByRole('treeitem', { name: /h3/ }).first().click();
  const runInput = page.getByTestId('text-run-input-0');
  await expect(runInput).toBeVisible({ timeout: 10_000 });
  await runInput.fill('Pin 40 giờ');
  await runInput.press('Enter');

  await expect.poll(() => readFile(home, 'utf8')).toContain('Pin 40 giờ');
  await expect.poll(() => readFile(home, 'utf8')).toContain('<svg data-icon="battery"');
});

test('Group 11c: a project with its own toast library gets "Ask AI" instead of a second system [QA K9.8-1]', async ({
  page,
}) => {
  folder = await copyFixture('projects/vite8-react19-ts');
  const home = join(folder.path, 'src', 'pages', 'Home.tsx');
  const pkgPath = join(folder.path, 'package.json');
  // Only the dependency list is read: nothing imports sonner, so the page still builds.
  const pkgText = await readFile(pkgPath, 'utf8');
  expect(pkgText).toContain('"dependencies": {');
  await writeFile(
    pkgPath,
    pkgText.replace('"dependencies": {', '"dependencies": {\n    "sonner": "2.0.7",'),
    'utf8',
  );
  await writeFile(
    home,
    [
      'export function Home() {',
      '  return (',
      '    <main className="p-6">',
      '      <button type="button" className="px-4 py-2 rounded bg-blue-600 text-white">Đặt hàng</button>',
      '    </main>',
      '  );',
      '}',
      'export default Home;',
      '',
    ].join('\n'),
    'utf8',
  );
  const before = await readFile(home, 'utf8');

  const session = await startCli(folder.path, config.path);
  sessions.push(session);
  await page.goto(session.studioUrl);
  await trustIfAsked(page);
  const canvas = await getCanvasFrame(page);
  await canvas.getByRole('button', { name: 'Đặt hàng' }).click({ timeout: 20_000 });
  await page.getByTestId('open-toast-config-btn').click();
  await page.getByTestId('toast-message-input').fill('Đã thêm vào giỏ');
  await page.getByTestId('apply-toast-on-click').click();

  const askAi = page.getByTestId('interaction-ask-ai');
  await expect(askAi).toBeVisible({ timeout: 10_000 });
  expect(await readFile(home, 'utf8')).toBe(before);
  await askAi.click();
  await expect(page.getByTestId('chat-input')).toHaveValue(/sonner/);
  await expect(page.getByTestId('chat-input')).toHaveValue(/Đã thêm vào giỏ/);
});
