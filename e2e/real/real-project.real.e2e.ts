// K9.5 "Chạy ổn định": KumiCraft against COPIES of real projects (`pnpm test:real`). Each folder in
// KC_REAL_PROJECTS (separated by `;`) is an app folder inside a git repository the owner copied
// outside the KumiCraft repo. Per project: every static page loads in the Canvas without a
// runtime error; then on the first page a few elements get a class edit that must change exactly
// their line, and Undo must give the file back byte for byte (checked with git). Never point it at
// the original projects: it writes to the files and undoes the writes.
import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';

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

function git(cwd: string, args: readonly string[]): string {
  return execFileSync('git', ['-C', cwd, ...args], { encoding: 'utf8' });
}

/** Changed paths outside `.kumicraft/` (KumiCraft's own project folder). */
function dirtyFiles(repo: string): string[] {
  return git(repo, ['status', '--porcelain', '--untracked-files=all'])
    .split('\n')
    .map((line) => line.slice(3).trim())
    .filter((path) => path !== '' && !path.includes('.kumicraft/'));
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
    await select.selectOption(path);
    const frame = await canvasFrame(tab);
    await expect.poll(() => taggedCount(frame), { timeout: 30_000 }).toBeGreaterThan(0);
    await tab.waitForTimeout(500);
    const route =
      (await tab
        .getByTestId('canvas-route')
        .textContent()
        .catch(() => '')) ?? '';
    const errors = await tab.getByTestId('canvas-runtime-error-item').count();
    results.push({ path, elements: await taggedCount(frame), route, runtimeErrors: errors });
  }
  return results;
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
      const file = loc.split(':')[0] ?? '';
      if (seen.has(file) || el.classList.length === 0 || rect.width < 30 || rect.height < 12)
        continue;
      if (rect.top < 0 || rect.bottom > window.innerHeight) continue;
      seen.add(file);
      out.push({ loc, x: rect.left + 6, y: rect.top + rect.height / 2 });
    }
    return { out, width: window.innerWidth };
  });
  const scale = outer.width / inner.width;
  return inner.out.map((c) => ({ loc: c.loc, x: outer.x + c.x * scale, y: outer.y + c.y * scale }));
}

type EditResult = { loc: string; outcome: string };

async function editAndUndo(tab: Page, repo: string, c: Candidate): Promise<EditResult> {
  await tab.keyboard.press('Escape');
  await tab.mouse.click(c.x, c.y);
  const details = tab.getByTestId('raw-class-details');
  // The Inspector reads the element's source after the click.
  await expect(details.or(tab.getByTestId('lock-banner')).first())
    .toBeVisible({ timeout: 10_000 })
    .catch(() => undefined);
  const summary = details.locator('summary');
  if ((await summary.count()) === 0) return { loc: c.loc, outcome: 'no class box (locked)' };
  const input = tab.getByTestId('raw-class-input');
  // The class box sits in a closed <details> until opened.
  if (!(await input.isVisible())) await summary.click();
  if (await input.isDisabled()) return { loc: c.loc, outcome: 'locked' };
  const before = await input.inputValue();
  // The click may land on a child from another file: the whole repository is checked.
  await input.fill(`${before} ${MARKER}`);
  await input.press('Enter');
  await expect
    .poll(() => git(repo, ['diff', '--unified=0']), { timeout: 15_000 })
    .toContain(MARKER);
  const changedFiles = dirtyFiles(repo);
  expect(changedFiles, 'exactly one file changed').toHaveLength(1);
  const added = git(repo, ['diff', '--unified=0'])
    .split('\n')
    .filter((l) => l.startsWith('+') && !l.startsWith('+++'));
  expect(added, `one added line in ${changedFiles[0] ?? ''}`).toHaveLength(1);
  expect(added[0]).toContain(`${before} ${MARKER}`);
  await input.blur();
  await tab.keyboard.press('Control+z');
  await expect.poll(() => git(repo, ['diff']), { timeout: 15_000 }).toBe('');
  return { loc: `${changedFiles[0] ?? ''} (${c.loc})`, outcome: 'edited and undone byte for byte' };
}

for (const appDir of PROJECTS) {
  test(`real project ${appDir}: pages load, class edits are exact, Undo restores [K9.5]`, async ({
    page,
  }) => {
    test.setTimeout(20 * 60_000);
    expect(existsSync(appDir), `${appDir} exists`).toBe(true);
    const repo = git(appDir, ['rev-parse', '--show-toplevel']).trim();
    expect(dirtyFiles(repo), 'the copy starts clean (commit or reset it first)').toEqual([]);
    const config: TempDir = await makeTempDir('real-config');
    let session: CliSession | undefined;
    try {
      session = await startCli(appDir, config.path);
      await page.goto(session.studioUrl);
      await trustIfAsked(page);
      const frame = await canvasFrame(page);
      await expect.poll(() => taggedCount(frame), { timeout: 60_000 }).toBeGreaterThan(0);

      const pages = await visitPages(page);
      report('pages', pages);
      const broken = pages.filter((p) => p.runtimeErrors > 0);
      expect(broken, 'pages with runtime errors').toEqual([]);

      const first = pages[0]?.path;
      if (first !== undefined) await page.getByTestId('canvas-page-select').selectOption(first);
      const list = (await candidates(page, await canvasFrame(page))).slice(0, EDITS);
      const edits: EditResult[] = [];
      for (const c of list) edits.push(await editAndUndo(page, repo, c));
      report('edits', edits);
      expect(edits.some((e) => e.outcome.startsWith('edited'))).toBe(true);
      expect(dirtyFiles(repo), 'the copy is clean again').toEqual([]);
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
