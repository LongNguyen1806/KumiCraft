// VG-12 (SPEC-01 section 9), third criterion: every screen of the Studio in `vi` (and `en`)
// without clipped text or broken layout. Runs the built CLI (`pnpm build` first) on a temporary
// project folder with its own settings, visits every screen at 1024 and 1440 px, saves screenshots to
// test-results/vg-12/ and reports any text cut off or any page wider than the window.
// The other criteria run in `pnpm verify`: `pnpm check:i18n` and ESLint `no-literal-string`.
// Run with: node scripts/vg/vg-12.mjs
/* global document, getComputedStyle, window */
import { spawn } from 'node:child_process';
import { cpSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { chromium } from '@playwright/test';

const CLI = join(import.meta.dirname, '..', '..', 'packages', 'cli', 'dist', 'index.js');
const SHOTS = join(import.meta.dirname, '..', '..', 'test-results', 'vg-12');
/** A supported project (R-PJ-07): a folder with only workspace.json is refused with E001. */
const FIXTURE = join(import.meta.dirname, '..', '..', 'fixtures', 'projects', 'vite8-react19-ts');
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
      // Text inside a box that grew wider than the dialog or panel clipping it (a fieldset keeps
      // its content width, so the text itself fits its parent but not the clipping box).
      let clipper = element.parentElement;
      while (clipper && getComputedStyle(clipper).overflowX === 'visible')
        clipper = clipper.parentElement;
      const clip = clipper ? clipper.getBoundingClientRect() : undefined;
      if (clip !== undefined && clipper !== document.documentElement && box.right > clip.right + 1)
        problems.push(
          `cut by ${clipper.tagName}: ${element.tagName} "${element.textContent.trim().slice(0, 40)}"`,
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

/** A `.reactcraft/workspace.json` (SPEC-03 section 3) written as a project pulled from Git. */
function writeProject(folder, text) {
  cpSync(FIXTURE, folder, { recursive: true });
  mkdirSync(join(folder, '.reactcraft'), { recursive: true });
  const file = {
    schemaVersion: 2,
    id: 'vg12000001',
    name: 'Cửa hàng thời trang mùa thu',
    createdAt: '2026-10-14T08:00:00.000Z',
    framework: 'vite-react',
    sourceDir: 'src',
    backends: [],
    responsiveMode: 'desktop-first',
    frames: [
      { id: 'desktop', label: 'Desktop', width: 1440, height: 900 },
      { id: 'tablet', label: 'Tablet', width: 768, height: 1024 },
      { id: 'mobile', label: 'Mobile', width: 375, height: 812 },
    ],
    primaryFrameId: 'desktop',
  };
  writeFileSync(join(folder, '.reactcraft', 'workspace.json'), text ?? JSON.stringify(file));
}

/** Connection lost, then the project error screen after workspace.json breaks and the CLI restarts. */
async function visitBrokenProject(context, results) {
  const { browser, page, child, folder, config, locale } = context;
  await stop(child);
  await check(page, 'connection-lost', results);
  writeProject(folder, JSON.stringify({ schemaVersion: 1, id: 'old', name: 'Old' }));
  const restarted = await startCli(folder, config);
  // The CLI opens a new tab for a new session; the old tab keeps the old token.
  await page.close();
  const reopened = await browser.newPage({ locale });
  await reopened.goto(restarted.url);
  await reopened.getByTestId('project-error').waitFor();
  await check(reopened, 'project-error', results);
  await reopened.close();
  await stop(restarted.child);
}

/** Every screen of one language, in the order a user meets them. */
async function visitAll(browser, language, results) {
  const empty = mkdtempSync(join(tmpdir(), 'vg12-empty-'));
  const folder = mkdtempSync(join(tmpdir(), 'vg12-project-'));
  const config = mkdtempSync(join(tmpdir(), 'vg12-config-'));
  writeFileSync(join(config, 'config.json'), JSON.stringify({ language }));
  const locale = language === 'vi' ? 'vi-VN' : 'en-US';

  const first = await startCli(empty, config);
  // Opened without the token: its own tab, since a hash change alone does not reload a page.
  const tokenless = await browser.newPage({ locale });
  await tokenless.goto(new URL(first.url).origin);
  await tokenless.getByRole('alert').waitFor();
  await check(tokenless, 'session-error', results);
  await tokenless.close();
  const welcome = await browser.newPage({ locale });
  await welcome.goto(first.url);
  await welcome.getByTestId('project-folder').waitFor();
  await check(welcome, 'no-project', results);
  await welcome.close();
  await stop(first.child);

  writeProject(folder);
  const { child, url } = await startCli(folder, config);
  const page = await browser.newPage({ locale });
  await page.goto(url);
  await page.getByRole('dialog').waitFor();
  await check(page, 'trust-dialog', results);
  await page.keyboard.press('Escape');
  await page.getByTestId('editor').waitFor();
  await check(page, 'editor-restricted', results);
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

  await visitBrokenProject({ browser, page, child, folder, config, locale }, results);
  for (const dir of [empty, folder, config]) rmSync(dir, { recursive: true, force: true });
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
