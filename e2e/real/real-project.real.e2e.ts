// K9.5 "Chạy ổn định": KumiCraft against COPIES of real projects (`pnpm test:real`). Each folder in
// KC_REAL_PROJECTS (separated by `;`) is an app folder the owner copied outside the KumiCraft
// repo. Per project: every static page loads in the Canvas without a runtime error; then on the
// first page a few elements get a class edit that must change exactly one line of one file, and
// Undo must give every file back byte for byte. Files are compared with a snapshot taken at the
// start, so a copy without git or with uncommitted work is fine. Never point it at the original
// projects: it writes to the files and undoes the writes.
import { createHash } from 'node:crypto';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

import { expect, type Frame, type Page, test } from '@playwright/test';

import { type CliSession, startCli } from '../support/cli-session.ts';
import { makeTempDir, type TempDir } from '../support/copy-fixture.ts';
import { getCanvasFrame, trustIfAsked } from '../support/trust.ts';

const PROJECTS = (process.env.KC_REAL_PROJECTS ?? '')
  .split(';')
  .map((p) => p.trim())
  .filter((p) => p !== '');
const MAX_PAGES = Number(process.env.KC_REAL_MAX_PAGES ?? '40');
const EDITS = Number(process.env.KC_REAL_EDITS ?? '5');
const MARKER = 'kc-qa-mark';

test.use({ trace: 'off', viewport: { width: 1600, height: 1000 } });

const SKIP_DIRS = new Set(['node_modules', '.git', 'dist', 'build', '.kumicraft', 'coverage']);
const MAX_FILE = 2_000_000;

/** Path → sha1 of every source-ish file under `dir` (KumiCraft's own `.kumicraft/` left out). */
function snapshot(dir: string): Map<string, string> {
  const out = new Map<string, string>();
  const walk = (current: string) => {
    for (const entry of readdirSync(current, { withFileTypes: true })) {
      if (entry.isDirectory()) {
        if (!SKIP_DIRS.has(entry.name) && !entry.name.startsWith('.vite')) {
          walk(join(current, entry.name));
        }
        continue;
      }
      const full = join(current, entry.name);
      // An atomic write's temp file (`App.jsx.123456`) can vanish between listing and reading.
      let bytes: Buffer;
      try {
        if (statSync(full).size > MAX_FILE) continue;
        bytes = readFileSync(full);
      } catch {
        continue;
      }
      const hash = createHash('sha1').update(bytes).digest('hex');
      out.set(relative(dir, full).replaceAll('\\', '/'), hash);
    }
  };
  walk(dir);
  return out;
}

/** Files that differ from `base`: changed, added or removed. */
function changedSince(dir: string, base: ReadonlyMap<string, string>): string[] {
  const now = snapshot(dir);
  const paths = new Set([...base.keys(), ...now.keys()]);
  return [...paths].filter((path) => base.get(path) !== now.get(path)).sort();
}

function report(name: string, value: unknown): void {
  process.stdout.write(`[real] ${name}: ${JSON.stringify(value)}\n`);
}

async function canvasFrame(tab: Page): Promise<Frame> {
  await getCanvasFrame(tab);
  const handle = await tab.locator('iframe[data-testid="canvas-iframe"]').elementHandle();
  const frame = (await handle.contentFrame()) ?? undefined;
  if (frame === undefined) throw new Error('canvas frame missing');
  return frame;
}

/** Elements of the page tagged with a source location, at most once per location. */
function taggedCount(frame: Frame): Promise<number> {
  return frame.evaluate(() => document.querySelectorAll('[data-rc-loc]').length).catch(() => 0);
}

type PageResult = { path: string; elements: number; route: string; runtimeErrors: number };

async function visitPages(tab: Page): Promise<PageResult[]> {
  const select = tab.getByTestId('canvas-page-select');
  const values = (
    await select
      .locator('option')
      .evaluateAll((options) => options.map((o) => (o instanceof HTMLOptionElement ? o.value : '')))
  ).filter((v) => v.startsWith('/') && !v.includes(':'));
  const results: PageResult[] = [];
  for (const path of values.slice(0, MAX_PAGES)) {
    const listed = await select
      .locator('option')
      .evaluateAll((options) =>
        options.map((o) => (o instanceof HTMLOptionElement ? o.value : '')),
      );
    if (!listed.includes(path)) {
      report('page left the list', { path, listed: listed.length });
      continue;
    }
    await select.selectOption(path);
    const frame = await canvasFrame(tab);
    await expect.poll(() => taggedCount(frame), { timeout: 30_000 }).toBeGreaterThan(0);
    await tab.waitForTimeout(500);
    // Where the app really is: a guarded page may have sent the user to the login page.
    const route = new URL(frame.url()).pathname;
    const errors = await tab.getByTestId('canvas-runtime-error-item').count();
    results.push({ path, elements: await taggedCount(frame), route, runtimeErrors: errors });
  }
  return results;
}

/**
 * KC_REAL_LOGIN = `path|email|password`: signs in once in preview mode (design mode catches the
 * clicks), waits until the app leaves the login page, then goes back to design mode.
 */
async function signIn(tab: Page): Promise<string | undefined> {
  const [path, email, password] = (process.env.KC_REAL_LOGIN ?? '').split('|');
  if (path === undefined || email === undefined || password === undefined) return undefined;
  await tab.getByTestId('canvas-page-select').selectOption(path);
  await tab.getByTestId('canvas-mode-toggle').click();
  const frame = await canvasFrame(tab);
  const emailBox = frame.locator('input[type="email"], input[name="email"]').first();
  await emailBox.waitFor({ timeout: 30_000 });
  await emailBox.fill(email);
  await frame.locator('input[type="password"]').first().fill(password);
  await frame.locator('input[type="password"]').first().press('Enter');
  await expect.poll(() => new URL(frame.url()).pathname, { timeout: 30_000 }).not.toBe(path);
  const landed = new URL(frame.url()).pathname;
  await tab.getByTestId('canvas-mode-toggle').click();
  return landed;
}

type Candidate = { loc: string; x: number; y: number };

/** Visible elements with a static class, one per source file line. */
async function candidates(tab: Page, frame: Frame): Promise<Candidate[]> {
  const outer =
    (await tab.locator('iframe[data-testid="canvas-iframe"]').boundingBox()) ?? undefined;
  if (outer === undefined) return [];
  const inner = await frame.evaluate(() => {
    const seen = new Set<string>();
    const out: { loc: string; x: number; y: number }[] = [];
    for (const el of document.querySelectorAll('[data-rc-loc]')) {
      const loc = el.getAttribute('data-rc-loc') ?? '';
      const rect = el.getBoundingClientRect();
      if (seen.has(loc) || el.classList.length === 0 || rect.width < 30 || rect.height < 12)
        continue;
      if (rect.top < 0 || rect.bottom > window.innerHeight) continue;
      seen.add(loc);
      out.push({ loc, x: rect.left + 6, y: rect.top + rect.height / 2 });
    }
    return { out, width: window.innerWidth };
  });
  const scale = outer.width / inner.width;
  return inner.out.map((c) => ({ loc: c.loc, x: outer.x + c.x * scale, y: outer.y + c.y * scale }));
}

type EditResult = { loc: string; outcome: string };

const STYLE_VALUE = '13px';

/**
 * CSS projects (plain CSS, Modules, Sass…): the Inspector edits through the style layer. One
 * `padding-top` change must touch one stylesheet; Undo gives every file back.
 */
async function editStyleAndUndo(
  tab: Page,
  appDir: string,
  base: ReadonlyMap<string, string>,
  c: Candidate,
): Promise<EditResult> {
  const input = tab.getByTestId('style-input-paddingTop');
  if ((await input.count()) === 0) return { loc: c.loc, outcome: 'no class box, no style layer' };
  if (await input.isDisabled()) return { loc: c.loc, outcome: 'style locked' };
  if ((await input.inputValue()) === STYLE_VALUE) return { loc: c.loc, outcome: 'already 13px' };
  await input.fill(STYLE_VALUE);
  await input.press('Enter');
  const error = tab.getByTestId('style-error');
  // The stylesheet and the element file are two writes: wait for the sheet (or an error).
  const sheetChanged = () =>
    changedSince(appDir, base).filter((f) => /[.](css|scss|sass|less)$/.test(f)).length;
  await expect
    .poll(async () => sheetChanged() + (await error.count()), { timeout: 15_000 })
    .toBeGreaterThan(0);
  if ((await error.count()) > 0) {
    return { loc: c.loc, outcome: `style error: ${(await error.textContent()) ?? ''}` };
  }
  // One stylesheet, plus the JSX file when the element gets its own new class (R-ST-07).
  const changed = changedSince(appDir, base);
  const sheets = changed.filter((f) => /\.(css|scss|sass|less)$/.test(f));
  expect(sheets, 'exactly one stylesheet changed').toHaveLength(1);
  expect(changed.length - sheets.length, 'at most the element file besides').toBeLessThanOrEqual(1);
  const file = changed.join(' + ');
  expect(
    readFileSync(join(appDir, sheets[0] ?? ''), 'utf8'),
    'the sheet holds the value',
  ).toContain(STYLE_VALUE);
  await input.blur();
  await tab.keyboard.press('Control+z');
  await expect.poll(() => changedSince(appDir, base), { timeout: 15_000 }).toEqual([]);
  return { loc: `${file} (${c.loc})`, outcome: 'style edited and undone byte for byte' };
}

async function editAndUndo(
  tab: Page,
  appDir: string,
  base: ReadonlyMap<string, string>,
  c: Candidate,
): Promise<EditResult> {
  await tab.keyboard.press('Escape');
  await tab.mouse.click(c.x, c.y);
  const details = tab.getByTestId('raw-class-details');
  // The Inspector reads the element's source after the click.
  await expect(
    details.or(tab.getByTestId('lock-banner')).or(tab.getByTestId('style-sources')).first(),
  )
    .toBeVisible({ timeout: 10_000 })
    .catch(() => undefined);
  const summary = details.locator('summary');
  if ((await summary.count()) === 0) return editStyleAndUndo(tab, appDir, base, c);
  const input = tab.getByTestId('raw-class-input');
  // The class box sits in a closed <details> until opened.
  if (!(await input.isVisible())) await summary.click();
  if (await input.isDisabled()) return { loc: c.loc, outcome: 'locked' };
  const before = await input.inputValue();
  // The click may land on a child from another file: every file is compared.
  await input.fill(`${before} ${MARKER}`);
  await input.press('Enter');
  await expect
    .poll(() => changedSince(appDir, base).length, { timeout: 15_000 })
    .toBeGreaterThan(0);
  const changed = changedSince(appDir, base);
  expect(changed, 'exactly one file changed').toHaveLength(1);
  const file = changed[0] ?? '';
  const text = readFileSync(join(appDir, file), 'utf8');
  expect(text, `${file} holds the new class`).toContain(`${before} ${MARKER}`);
  await input.blur();
  await tab.keyboard.press('Control+z');
  await expect.poll(() => changedSince(appDir, base), { timeout: 15_000 }).toEqual([]);
  return { loc: `${file} (${c.loc})`, outcome: 'edited and undone byte for byte' };
}

for (const appDir of PROJECTS) {
  test(`real project ${appDir}: pages load, class edits are exact, Undo restores [K9.5]`, async ({
    page,
  }) => {
    test.setTimeout(20 * 60_000);
    expect(existsSync(appDir), `${appDir} exists`).toBe(true);
    const base = snapshot(appDir);
    const config: TempDir = await makeTempDir('real-config');
    let session: CliSession | undefined;
    try {
      session = await startCli(appDir, config.path);
      await page.goto(session.studioUrl);
      await trustIfAsked(page);
      const frame = await canvasFrame(page);
      await expect.poll(() => taggedCount(frame), { timeout: 60_000 }).toBeGreaterThan(0);

      const landed = await signIn(page);
      if (landed !== undefined) report('signed in, landed on', landed);
      const pages = await visitPages(page);
      report('pages', pages);
      const broken = pages.filter((p) => p.runtimeErrors > 0);
      expect(broken, 'pages with runtime errors').toEqual([]);

      // Edits on the page the user landed on after signing in, else the first page.
      const first = pages.find((p) => p.path === landed)?.path ?? pages[0]?.path;
      if (first !== undefined) await page.getByTestId('canvas-page-select').selectOption(first);
      const list = (await candidates(page, await canvasFrame(page))).slice(0, 40);
      const edits: EditResult[] = [];
      for (const c of list) {
        edits.push(await editAndUndo(page, appDir, base, c));
        if (edits.filter((e) => e.outcome.includes('edited')).length >= EDITS) break;
      }
      report('edits', edits);
      expect(edits.some((e) => e.outcome.includes('edited'))).toBe(true);
      expect(changedSince(appDir, base), 'every file as at the start').toEqual([]);
    } finally {
      await session?.stop();
      await config.remove();
    }
  });
}

test('KC_REAL_PROJECTS names at least one project copy [K9.5]', () => {
  expect(
    PROJECTS.length,
    'set KC_REAL_PROJECTS="D:/test project/MarketLink/frontend;…"',
  ).toBeGreaterThan(0);
});
