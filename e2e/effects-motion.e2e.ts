// E2E tests for K9.7-2 Part 4: gradient, hover scope, motion presets, preview, Scroll Reveal & CSS composite merge/@keyframes (Tests 19 & 20).
import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

import { expect, type Page, test } from '@playwright/test';

import { type CliSession, startCli } from './support/cli-session.ts';
import { copyFixture, makeTempDir, type TempDir } from './support/copy-fixture.ts';
import { getCanvasFrame, trustIfAsked } from './support/trust.ts';

const tempDirs: TempDir[] = [];
const sessions: CliSession[] = [];

async function openProject(fixture: string, label: string, page: Page): Promise<string> {
  const folder = await copyFixture(fixture);
  const config = await makeTempDir(`k972-effects-${label}`);
  tempDirs.push(folder, config);
  const session = await startCli(folder.path, config.path);
  sessions.push(session);
  await page.goto(session.studioUrl);
  await trustIfAsked(page);
  const canvas = await getCanvasFrame(page);
  await expect(canvas.getByRole('heading', { level: 1 }).first()).toBeVisible({ timeout: 20_000 });
  return folder.path;
}

async function openGroupIfClosed(page: Page, groupId: string): Promise<void> {
  const btn = page.getByTestId(`inspector-group-${groupId}`);
  const expanded = await btn.getAttribute('aria-expanded');
  if (expanded !== 'true') {
    await btn.click();
  }
}

test.afterEach(async () => {
  for (const session of sessions.splice(0)) await session.stop();
  for (const dir of tempDirs.splice(0)) await dir.remove();
});

test('19. Tailwind project: gradient, hover scope motion preset, preview without file edits, and Scroll Reveal', async ({
  page,
}) => {
  const root = await openProject('projects/vite8-react19-ts', 'tw', page);
  const homeTsx = join(root, 'src', 'pages', 'Home.tsx');
  const revealFile = join(root, 'src', 'kumicraft', 'Reveal.tsx');

  await page
    .getByRole('treeitem', { name: /\bdiv mx-auto/ })
    .first()
    .click();

  // 1. Toggle Gradient ON
  await openGroupIfClosed(page, 'effects');
  await page.getByTestId('effect-gradient-toggle').click();
  await expect.poll(() => readFile(homeTsx, 'utf8')).toMatch(/bg-(linear|gradient)-to-r/);

  // 2. Apply motion preset & hover opacity
  await openGroupIfClosed(page, 'motion');
  await page.getByTestId('motion-preset-select').selectOption('hover-lift');
  await expect.poll(() => readFile(homeTsx, 'utf8')).toContain('transition-all');
  await expect.poll(() => readFile(homeTsx, 'utf8')).toContain('hover:shadow-lg');
  // "None" takes the whole effect off, hover parts included; then it goes back on.
  await page.getByTestId('motion-preset-select').selectOption('none');
  await expect.poll(() => readFile(homeTsx, 'utf8')).not.toContain('hover:shadow-lg');
  expect(await readFile(homeTsx, 'utf8')).not.toContain('transition-all');
  await page.getByTestId('motion-preset-select').selectOption('hover-lift');
  await expect.poll(() => readFile(homeTsx, 'utf8')).toContain('hover:shadow-lg');

  await page.getByTestId('interaction-state-select').selectOption('hover');
  const opacityInput = page.getByTestId('input-opacity');
  await opacityInput.fill('75');
  await opacityInput.press('Enter');
  await expect.poll(() => readFile(homeTsx, 'utf8')).toContain('hover:opacity-75');

  // 3. Motion Preview does NOT modify source files
  const beforePreview = await readFile(homeTsx, 'utf8');
  await page.getByTestId('motion-preview').click();
  expect(await readFile(homeTsx, 'utf8')).toBe(beforePreview);

  // 4. Scroll Reveal creates Reveal.tsx once, wraps, then unwraps cleanly
  await page.getByTestId('motion-reveal-toggle').click();
  await expect.poll(() => existsSync(revealFile)).toBe(true);
  await expect.poll(() => readFile(homeTsx, 'utf8')).toContain('<Reveal');

  await expect(page.getByRole('treeitem', { name: /\bReveal\b/ }).first()).toBeVisible();
  await page
    .getByRole('treeitem', { name: /\bdiv mx-auto/ })
    .first()
    .click();
  await openGroupIfClosed(page, 'motion');
  await page.getByTestId('motion-reveal-toggle').click();
  await expect.poll(() => readFile(homeTsx, 'utf8')).not.toContain('<Reveal');

  // 5. Any number can be typed; a wrong one says why and writes nothing (owner, 2026-11-18).
  await openGroupIfClosed(page, 'effects');
  const beforeWrong = await readFile(homeTsx, 'utf8');
  await page.getByTestId('effect-field-rotate-input').fill('abc');
  await expect(page.getByTestId('effect-field-rotate-error')).toBeVisible();
  await page.getByTestId('effect-field-rotate-input').fill('999');
  await expect(page.getByTestId('effect-field-rotate-error')).toContainText('360');
  await page.getByTestId('effect-field-rotate-input').press('Enter');
  expect(await readFile(homeTsx, 'utf8')).toBe(beforeWrong);
  await typeNumber(page, 'effect-field-rotate', '15');
  await expect.poll(() => readFile(homeTsx, 'utf8')).toContain('rotate-15');
  await typeNumber(page, 'motion-duration', '400');
  await expect.poll(() => readFile(homeTsx, 'utf8')).toContain('duration-400');
});

/** Types a number into a slider field and presses Enter, as a user does. */
async function typeNumber(page: Page, testId: string, value: string): Promise<void> {
  const input = page.getByTestId(`${testId}-input`);
  await input.fill(value);
  await input.press('Enter');
}

test('20. Plain CSS project: composite transform/backdrop-filter merge and single @keyframes injection', async ({
  page,
}) => {
  const root = await openProject('projects/react-css', 'css', page);
  const indexCss = join(root, 'src', 'index.css');

  await page
    .getByRole('treeitem', { name: /\bh1 title/ })
    .first()
    .click();
  await openGroupIfClosed(page, 'css-effects');
  // Numbers are typed (or dragged) now, not picked from a list (owner, 2026-11-18).
  await typeNumber(page, 'effect-backdrop-blur', '12');
  await expect.poll(() => readFile(indexCss, 'utf8')).toContain('backdrop-filter: blur(12px)');

  await typeNumber(page, 'effect-field-rotate', '45');
  await expect.poll(() => readFile(indexCss, 'utf8')).toContain('rotate(45deg)');
  await typeNumber(page, 'effect-field-scale', '105');
  await expect.poll(() => readFile(indexCss, 'utf8')).toContain('rotate(45deg) scale(1.05)');

  await openGroupIfClosed(page, 'motion');
  await page.getByTestId('motion-animation').selectOption('kc-fade-in 0.4s ease-out both');
  await expect.poll(() => readFile(indexCss, 'utf8')).toContain('@keyframes kc-fade-in');
  const cssText = await readFile(indexCss, 'utf8');
  expect(cssText.match(/@keyframes\s+kc-fade-in/g) ?? []).toHaveLength(1);
});
