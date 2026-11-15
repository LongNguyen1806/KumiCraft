// The tour's recorder: runs one user action at a time on the real Studio and writes down what went
// wrong instead of stopping at the first failure. After every step it checks the page for error
// codes, console errors and a broken Canvas, saves a screenshot and the changed source lines, and
// rewrites the batch report (tour/out/<batch>/report.md) so a crash keeps what was found.
import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import { join, relative } from 'node:path';

import { expect, type FrameLocator, type Locator, type Page } from '@playwright/test';

import { type CliSession, startCli } from '../../e2e/support/cli-session.ts';
import {
  copyFixture,
  makeTempDir,
  REPO_ROOT,
  type TempDir,
} from '../../e2e/support/copy-fixture.ts';
import { getCanvasFrame, trustIfAsked } from '../../e2e/support/trust.ts';

export type Outcome = 'ok' | 'bug' | 'note';

type StepRecord = {
  readonly n: number;
  readonly name: string;
  readonly outcome: Outcome;
  readonly notes: readonly string[];
  readonly changed: readonly string[];
  readonly shot: string;
  readonly ms: number;
};

/** Every source file of the project copy, by path relative to it. */
export type Files = ReadonlyMap<string, string>;

const SKIP_DIRS = new Set(['node_modules', '.kumicraft', 'dist', '.git']);

async function readTree(root: string, dir = root, out = new Map<string, string>()) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    if (SKIP_DIRS.has(entry.name)) continue;
    const path = join(dir, entry.name);
    if (entry.isDirectory()) await readTree(root, path, out);
    else if (/\.(tsx?|jsx?|css|scss|less|html|json)$/.test(entry.name)) {
      out.set(relative(root, path).replaceAll('\\', '/'), await readFile(path, 'utf8'));
    }
  }
  return out;
}

/** Lines added (+) and removed (-) per changed file, at most `limit` lines each. */
export function diffFiles(before: Files, after: Files, limit = 14): string[] {
  const out: string[] = [];
  for (const path of new Set([...before.keys(), ...after.keys()])) {
    const a = before.get(path);
    const b = after.get(path);
    if (a === b) continue;
    if (a === undefined) out.push(`NEW ${path}`);
    else if (b === undefined) out.push(`GONE ${path}`);
    else out.push(`~ ${path}`);
    const was = new Set((a ?? '').split(/\r?\n/));
    const now = new Set((b ?? '').split(/\r?\n/));
    const lines = [
      ...[...was].filter((l) => !now.has(l)).map((l) => `  - ${l.trim()}`),
      ...[...now].filter((l) => !was.has(l)).map((l) => `  + ${l.trim()}`),
    ].filter((l) => l.length > 4);
    out.push(...lines.slice(0, limit));
    if (lines.length > limit) out.push(`  … ${String(lines.length - limit)} more lines`);
  }
  return out;
}

const slug = (text: string): string =>
  text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 50)
    .toLowerCase();

/** Thrown inside a step for what the user would see as wrong. */
export class Bug extends Error {}

/** One step's handle: adds notes the report keeps even when the step passes. */
export type StepContext = {
  readonly note: (text: string) => void;
  /** Marks the step a bug and goes on, for a fault the tour can get past. */
  readonly bug: (text: string) => void;
};

export class Tour {
  readonly page: Page;
  readonly session: CliSession;
  readonly root: string;
  private readonly outDir: string;
  private readonly batch: string;
  private readonly records: StepRecord[] = [];
  private consoleErrors: string[] = [];
  private readonly temps: TempDir[];

  private constructor(
    page: Page,
    session: CliSession,
    root: string,
    batch: string,
    temps: TempDir[],
  ) {
    this.page = page;
    this.session = session;
    this.root = root;
    this.batch = batch;
    this.outDir = join(REPO_ROOT, 'tour', 'out', batch);
    this.temps = temps;
    page.on('console', (msg) => {
      // A failed request is logged below with its address instead.
      if (msg.type() === 'error' && !msg.text().startsWith('Failed to load resource')) {
        this.consoleErrors.push(`console: ${msg.text().slice(0, 300)}`);
      }
    });
    page.on('response', (res) => {
      if (res.status() < 400) return;
      const url = new URL(res.url());
      const where = `${url.pathname}${url.search}`.replace(/t=[^&]+/, 't=…').slice(0, 160);
      this.consoleErrors.push(`HTTP ${String(res.status())} ${res.request().method()} ${where}`);
    });
    page.on('pageerror', (err) => {
      this.consoleErrors.push(`page error: ${err.message.slice(0, 300)}`);
    });
  }

  /** Copies the fixture, starts the CLI and opens the Studio with the page shown. */
  static async open(page: Page, fixture: string, batch: string): Promise<Tour> {
    const folder = await copyFixture(fixture);
    const config = await makeTempDir(`tour-${batch}`);
    const session = await startCli(folder.path, config.path);
    await page.setViewportSize({ width: 1600, height: 1000 });
    await page.goto(session.studioUrl);
    await trustIfAsked(page);
    const tour = new Tour(page, session, folder.path, batch, [folder, config]);
    await mkdir(tour.outDir, { recursive: true });
    const canvas = await getCanvasFrame(page);
    await expect(canvas.locator('body *').first()).toBeVisible({ timeout: 30_000 });
    return tour;
  }

  async close(): Promise<void> {
    await this.writeReport();
    await this.session.stop();
    for (const dir of this.temps) await dir.remove();
  }

  canvas(): FrameLocator {
    return this.page.locator('iframe[data-testid="canvas-iframe"]').first().contentFrame();
  }

  files(): Promise<Files> {
    return readTree(this.root);
  }

  file(path: string): Promise<string> {
    return readFile(join(this.root, path), 'utf8').catch(() => '');
  }

  /** Waits until a source file changes; the Bug says nothing was written. */
  async waitChange(before: Files, timeout = 8_000): Promise<Files> {
    const end = Date.now() + timeout;
    while (Date.now() < end) {
      const now = await this.files();
      if (diffFiles(before, now).length > 0) return now;
      await this.page.waitForTimeout(150);
    }
    throw new Bug('Không có thay đổi nào được ghi vào file');
  }

  /** Presses Undo until the files are back as `before`; a Bug when they never are. */
  async undoTo(before: Files, maxPresses = 4): Promise<void> {
    const undo = this.page.getByRole('button', { name: /^Hoàn tác\b.*\(/ });
    for (let i = 0; i < maxPresses; i += 1) {
      if (diffFiles(before, await this.files()).length === 0) return;
      if (!(await undo.isEnabled())) break;
      const was = await this.files();
      await undo.click();
      const end = Date.now() + 5_000;
      while (Date.now() < end && diffFiles(was, await this.files()).length === 0) {
        await this.page.waitForTimeout(150);
      }
    }
    const left = diffFiles(before, await this.files());
    if (left.length > 0) throw new Bug(`Hoàn tác không trả file về như cũ:\n${left.join('\n')}`);
  }

  /** True when `locator` shows within `ms`. */
  async appears(locator: Locator, ms: number): Promise<boolean> {
    try {
      await locator.waitFor({ state: 'visible', timeout: ms });
      return true;
    } catch {
      return false;
    }
  }

  async openPanel(id: string): Promise<void> {
    const btn = this.page.getByTestId(`activity-${id}`);
    if ((await btn.getAttribute('aria-pressed')) !== 'true') await btn.click();
  }

  /** Selects an element through the Layers tree, as a user clicking its row. */
  async selectLayer(name: RegExp): Promise<void> {
    await this.openPanel('layers');
    await this.page.getByRole('treeitem', { name }).first().click();
    await expect(this.page.getByTestId('inspector-panel')).toBeVisible();
  }

  /** What the user would see as an error right now. */
  private async visibleProblems(): Promise<string[]> {
    const out: string[] = [];
    const codes = this.page.getByText(/\(E\d{3}\)/);
    for (const text of await codes.allInnerTexts()) out.push(`báo lỗi: ${text.slice(0, 200)}`);
    const alerts = this.page.locator('[data-testid$="-error"]:visible');
    for (const text of await alerts.allInnerTexts()) {
      if (text.trim().length > 0) out.push(`ô lỗi: ${text.trim().slice(0, 200)}`);
    }
    if ((await this.page.getByTestId('canvas-error').count()) > 0) out.push('Canvas báo lỗi');
    const overlay = this.canvas().locator('vite-error-overlay');
    if ((await overlay.count().catch(() => 0)) > 0) out.push('Canvas hiện lỗi build của Vite');
    return [...new Set(out)];
  }

  /**
   * Runs one user step. A thrown error marks it a bug; so does an error the page shows or logs
   * during it. `expectProblem` is for steps meant to show an error (a refused action).
   */
  async step(
    name: string,
    action: (ctx: StepContext) => Promise<void> | void,
    options: { readonly expectProblem?: boolean } = {},
  ): Promise<void> {
    const n = this.records.length + 1;
    const notes: string[] = [];
    let outcome: Outcome = 'ok';
    const before = await this.files();
    this.consoleErrors = [];
    const started = Date.now();
    const flagged: string[] = [];
    try {
      await action({
        note: (text) => notes.push(text),
        bug: (text) => {
          flagged.push(text);
          notes.push(text);
        },
      });
      if (flagged.length > 0) outcome = 'bug';
    } catch (err) {
      outcome = 'bug';
      const message = err instanceof Error ? err.message : String(err);
      notes.push(err instanceof Bug ? message : `thao tác hỏng: ${message.split('\n')[0] ?? ''}`);
    }
    await this.page.waitForTimeout(250);
    const problems = await this.visibleProblems();
    if (problems.length > 0 && options.expectProblem !== true) {
      outcome = 'bug';
      notes.push(...problems);
    }
    const logged = [...new Set(this.consoleErrors)].filter(
      (e) => !/favicon|ERR_ABORTED|logo\.png/.test(e),
    );
    if (logged.length > 0) {
      if (outcome === 'ok') outcome = 'note';
      notes.push(...logged.slice(0, 5));
    }
    if (outcome === 'ok' && notes.length > 0) outcome = 'note';
    const shot = `${String(n).padStart(3, '0')}-${slug(name)}.png`;
    await this.page.screenshot({ path: join(this.outDir, shot) }).catch(() => undefined);
    const changed = diffFiles(before, await this.files());
    this.records.push({ n, name, outcome, notes, changed, shot, ms: Date.now() - started });
    await this.writeReport();
    // A dialog left open would block the next step.
    if (outcome === 'bug') await this.page.keyboard.press('Escape').catch(() => undefined);
  }

  private async writeReport(): Promise<void> {
    const bugs = this.records.filter((r) => r.outcome === 'bug').length;
    const notes = this.records.filter((r) => r.outcome === 'note').length;
    const lines = [
      `# Tour ${this.batch}`,
      '',
      `${String(this.records.length)} bước · ${String(bugs)} lỗi · ${String(notes)} ghi chú`,
      '',
    ];
    for (const r of this.records) {
      const mark = r.outcome === 'bug' ? '❌' : r.outcome === 'note' ? '⚠️' : '✅';
      lines.push(`## ${mark} ${String(r.n)}. ${r.name} (${String(r.ms)} ms)`, '');
      for (const note of r.notes) lines.push(`- ${note.replaceAll('\n', '\n  ')}`);
      if (r.changed.length > 0) lines.push('', '```diff', ...r.changed, '```');
      lines.push('', `Ảnh: ${r.shot}`, '');
    }
    await writeFile(join(this.outDir, 'report.md'), lines.join('\n'));
  }
}
