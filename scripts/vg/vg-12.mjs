// VG-12 (SPEC-01.2 section 13), third criterion: every screen of the Studio in `vi` (and `en`)
// without clipped text or broken layout. Runs the built CLI (`pnpm build` first) on a temporary
// workspace with its own settings, visits every screen at 1024 and 1440 px, saves screenshots to
// test-results/vg-12/ and reports any text cut off or any page wider than the window.
// The other criteria run in `pnpm verify`: `pnpm check:i18n` and ESLint `no-literal-string`.
// Run with: node scripts/vg/vg-12.mjs
/* global document, getComputedStyle, window */
import { spawn } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { chromium } from '@playwright/test';

const CLI = join(import.meta.dirname, '..', '..', 'packages', 'cli', 'dist', 'index.js');
const SHOTS = join(import.meta.dirname, '..', '..', 'test-results', 'vg-12');
const SIZES = [
  { width: 1024, height: 768 },
  { width: 1440, height: 900 },
];

function startCli(workspace, config) {
  const child = spawn(process.execPath, [CLI, workspace, '--no-open', '--log-level', 'warn'], {
    stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env, REACTCRAFT_CONFIG_DIR: config },
  });
  return new Promise((resolve) => {
    let output = '';
    child.stdout.on('data', (chunk) => {
      output += chunk;
      const url = /Studio: (\S+)/.exec(output)?.[1];
      if (url !== undefined) resolve({ child, url });
    });
  });
}

const stop = (child) =>
  new Promise((resolve) => {
    child.on('exit', resolve);
    child.kill();
  });

/** Text cut off by its box (except deliberate `…` truncation) and horizontal page overflow. */
const findProblems = (page) =>
  page.evaluate(() => {
    const problems = [];
    if (document.documentElement.scrollWidth > window.innerWidth + 1)
      problems.push('page wider than the window');
    for (const element of document.querySelectorAll('body *')) {
      const hasText = [...element.childNodes].some(
        (node) => node.nodeType === 3 && node.textContent.trim() !== '',
      );
      if (!hasText || element.tagName === 'OPTION') continue;
      const style = getComputedStyle(element);
      if (style.textOverflow === 'ellipsis' || style.display === 'none') continue;
      const clipsX = element.scrollWidth > element.clientWidth + 1 && style.overflowX !== 'visible';
      const clipsY =
        element.scrollHeight > element.clientHeight + 1 && style.overflowY === 'hidden';
      if (clipsX || clipsY)
        problems.push(`clipped: ${element.tagName} "${element.textContent.trim().slice(0, 40)}"`);
      // Text that wraps or grows out of the pill, button or panel around it.
      const box = element.getBoundingClientRect();
      const parent = element.parentElement?.getBoundingClientRect();
      const sticksOut =
        parent !== undefined &&
        element.parentElement !== document.body &&
        style.position !== 'absolute' &&
        style.position !== 'fixed' &&
        (box.bottom > parent.bottom + 1 ||
          box.right > parent.right + 1 ||
          box.top < parent.top - 1);
      if (sticksOut)
        problems.push(
          `sticks out: ${element.tagName} "${element.textContent.trim().slice(0, 40)}"`,
        );
    }
    return problems;
  });

async function check(page, name, results) {
  for (const size of SIZES) {
    await page.setViewportSize(size);
    await page.waitForTimeout(250);
    const lang = await page.evaluate(() => document.documentElement.lang);
    await page.screenshot({ path: join(SHOTS, `${name}-${lang}-${String(size.width)}.png`) });
    results.push({ screen: name, lang, width: size.width, problems: await findProblems(page) });
  }
}

const api = async (url, path, method = 'GET', body) => {
  const studio = new URL(url);
  const response = await globalThis.fetch(`${studio.origin}/api/v1/${path}`, {
    method,
    headers: {
      authorization: `Bearer ${studio.hash.slice(3)}`,
      'content-type': 'application/json',
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  return response.json();
};

/** Connection lost, then the workspace error screen after a page file breaks and the CLI restarts. */
async function visitBrokenWorkspace(context, results) {
  const { browser, page, workspace, config, locale } = context;
  let { child, url } = context;
  const document = await api(url, 'workspace/document');
  const pageId = document.data.document.workspace.pageOrder[0];
  await stop(child);
  await check(page, 'connection-lost', results);
  writeFileSync(join(workspace, '.reactcraft', 'pages', `${pageId}.json`), '{ broken');
  ({ child, url } = await startCli(workspace, config));
  // The CLI opens a new tab for a new session; the old tab keeps the old token.
  await page.close();
  const reopened = await browser.newPage({ locale });
  await reopened.goto(url);
  await reopened.getByTestId('problem-file').waitFor();
  await check(reopened, 'workspace-error', results);

  await reopened.close();
  await stop(child);
}

/** Every screen of one language, in the order a user meets them. */
async function visitAll(browser, language, results) {
  const workspace = mkdtempSync(join(tmpdir(), 'vg12-ws-'));
  const config = mkdtempSync(join(tmpdir(), 'vg12-config-'));
  writeFileSync(join(config, 'config.json'), JSON.stringify({ language }));
  const { child, url } = await startCli(workspace, config);
  const locale = language === 'vi' ? 'vi-VN' : 'en-US';
  // Opened without the token: its own tab, since a hash change alone does not reload a page.
  const tokenless = await browser.newPage({ locale });
  await tokenless.goto(new URL(url).origin);
  await tokenless.getByRole('alert').waitFor();
  await check(tokenless, 'session-error', results);
  await tokenless.close();

  const page = await browser.newPage({ locale });
  await page.goto(url);
  await page.getByTestId('workspace-directory').waitFor();
  await check(page, 'welcome', results);
  await page.locator('details summary').click();
  await page.getByRole('radio', { name: /Custom|Tùy chỉnh/ }).check({ force: true });
  await page.getByRole('button', { name: /Create workspace|Tạo workspace/ }).click();
  await check(page, 'welcome-form-errors', results);

  await page.getByLabel(/Workspace name|Tên workspace/).fill('Cửa hàng thời trang mùa thu');
  await page.getByRole('radio', { name: /Desktop\s*1440/ }).check({ force: true });
  await page.getByRole('button', { name: /Create workspace|Tạo workspace/ }).click();
  await page.getByTestId('frame').waitFor();
  await page.getByTestId('layer-list').getByRole('button').first().click();
  await check(page, 'editor', results);
  await page.getByRole('button', { name: /^(Settings|Cài đặt)$/ }).click();
  await check(page, 'settings', results);
  await page.keyboard.press('Escape');

  await page.setViewportSize({ width: 900, height: 700 });
  await page.screenshot({ path: join(SHOTS, `narrow-${language}-900.png`) });
  results.push({
    screen: 'narrow',
    lang: language,
    width: 900,
    problems: await findProblems(page),
  });

  await visitBrokenWorkspace({ browser, page, child, url, workspace, config, locale }, results);
  rmSync(workspace, { recursive: true, force: true });
  rmSync(config, { recursive: true, force: true });
}

async function main() {
  mkdirSync(SHOTS, { recursive: true });
  const browser = await chromium.launch();
  const results = [];
  for (const language of ['vi', 'en']) await visitAll(browser, language, results);
  await browser.close();
  console.table(results.map((row) => ({ ...row, problems: row.problems.join('; ') || 'none' })));
  const failed = results.filter((row) => row.problems.length > 0);
  console.log(
    `VG-12 screens: ${String(results.length - failed.length)}/${String(results.length)} clean. Screenshots: ${SHOTS}`,
  );
  if (failed.length > 0) process.exitCode = 1;
}

await main();
