// K9.5, PB-01 to PB-05 on a COPY of a real project (`KC_REAL_PROJECTS`, first entry; meant for
// MarketLink): startup, hover over the real home page, class confirm on a real heading. PB-03 runs
// in `pnpm bench` on a generated 2,000-line file, larger than any file of the project (reported
// here for comparison). The copy is always put back as it started.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

import { expect, type Frame, type Page, test } from '@playwright/test';

import { p95 } from '../perf/perf-support.ts';
import { type CliSession, startCli } from '../support/cli-session.ts';
import { makeTempDir } from '../support/copy-fixture.ts';
import { getCanvasFrame, trustIfAsked } from '../support/trust.ts';
import { backup, restore } from './real-files.ts';

const APP = (process.env.KC_REAL_PROJECTS ?? '').split(';')[0]?.trim() ?? '';

test.use({ trace: 'off', viewport: { width: 1600, height: 1000 } });

function report(name: string, value: unknown): void {
  process.stdout.write(`[perf] ${name}: ${JSON.stringify(value)}\n`);
}

/** Line count of the largest .jsx/.tsx file under src. */
function largestSource(dir: string): { file: string; lines: number } {
  let best = { file: '', lines: 0 };
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) {
      const sub = largestSource(path);
      if (sub.lines > best.lines) best = sub;
    } else if (/\.(jsx|tsx)$/.test(name)) {
      const lines = readFileSync(path, 'utf8').split('\n').length;
      if (lines > best.lines) best = { file: path.slice(APP.length + 1), lines };
    }
  }
  return best;
}

async function canvasOf(tab: Page): Promise<Frame> {
  await getCanvasFrame(tab);
  const handle = await tab.locator('iframe[data-testid="canvas-iframe"]').first().elementHandle();
  const frame = (await handle.contentFrame()) ?? undefined;
  if (frame === undefined) throw new Error('canvas frame missing');
  return frame;
}

/** Page coordinates of the n-th tagged element's centre inside the scaled Canvas iframe. */
async function pointOf(tab: Page, frame: Frame, selector: string, index = 0) {
  const outer =
    (await tab.locator('iframe[data-testid="canvas-iframe"]').first().boundingBox()) ?? undefined;
  const inner = await frame.evaluate(
    ({ sel, i }) => {
      const rect = document.querySelectorAll(sel)[i]?.getBoundingClientRect();
      return rect === undefined
        ? undefined
        : { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2, width: window.innerWidth };
    },
    { sel: selector, i: index },
  );
  if (outer === undefined || inner === undefined) throw new Error(`${selector} not on the Canvas`);
  const scale = outer.width / inner.width;
  return { x: outer.x + inner.x * scale, y: outer.y + inner.y * scale };
}

test(`PB-01 to PB-05 on ${APP} [K9.5]`, async ({ page }) => {
  test.setTimeout(10 * 60_000);
  expect(APP, 'set KC_REAL_PROJECTS to the MarketLink frontend copy').not.toBe('');
  const saved = backup(APP);
  const config = await makeTempDir('real-perf');
  let session: CliSession | undefined;
  try {
    report(
      'largest source file (PB-03 runs on 2,000 generated lines)',
      largestSource(join(APP, 'src')),
    );

    // PB-05: CLI to a ready Studio; PB-04: dev server starting → ready.
    const started = Date.now();
    session = await startCli(APP, config.path);
    await page.context().addInitScript(() => {
      Reflect.set(globalThis, '__KC_PERF__', true);
    });
    const sessionCall = page.waitForResponse((res) => res.url().includes('/api/v1/session'));
    await page.goto(session.studioUrl);
    expect((await sessionCall).ok()).toBe(true);
    const cliToStudio = Date.now() - started;
    const trustAt = Date.now();
    await trustIfAsked(page);
    const frame = await canvasOf(page);
    await expect
      .poll(() => frame.evaluate(() => document.querySelectorAll('[data-rc-loc]').length), {
        timeout: 60_000,
      })
      .toBeGreaterThan(0);
    const canvasReady = Date.now() - trustAt;
    const elements = await frame.evaluate(() => document.querySelectorAll('[data-rc-loc]').length);
    report('PB-05 cli→studio ms (≤ 2000)', cliToStudio);
    report('PB-04 trust→canvas with elements ms (≤ 15000)', { canvasReady, elements });

    // PB-01: 200 pointer moves over the home page, one Bridge hover step each.
    const count = Math.min(elements, 40);
    const from = await pointOf(page, frame, '[data-rc-loc]', 0);
    const to = await pointOf(page, frame, '[data-rc-loc]', count - 1);
    await page.mouse.move(from.x, from.y);
    await frame.evaluate(() => {
      performance.clearMeasures('kc:hover');
    });
    for (let i = 0; i < 200; i++) {
      const t = i < 100 ? i / 99 : (199 - i) / 99;
      await page.mouse.move(from.x + (to.x - from.x) * t, from.y + (to.y - from.y) * t);
    }
    const hovers = await frame.evaluate(() =>
      performance.getEntriesByName('kc:hover').map((e) => e.duration),
    );
    const pb01 = { samples: hovers.length, p95: p95(hovers), max: Math.max(...hovers) };
    report('PB-01 hover ms (P95 ≤ 16)', pb01);

    // PB-02: confirm a class on a real element 30 times; Enter → class on the Canvas.
    // The page's main heading, picked in the Layers tree as a user does.
    const sel = 'h1[data-rc-loc]';
    await page.getByRole('treeitem', { name: /^h1 / }).first().click();
    // Plain CSS project: the Style panel's font size, written to the project's CSS on Enter.
    const fontSize = page.getByTestId('style-input-fontSize');
    await expect(fontSize).toBeVisible({ timeout: 15_000 });
    const times: number[] = [];
    for (let i = 0; i < 30; i++) {
      const value = `${String(20 + (i % 2))}px`;
      await fontSize.fill(value);
      const t0 = Date.now();
      await fontSize.press('Enter');
      for (;;) {
        const now = await frame
          .evaluate((q) => {
            const el = document.querySelector(q);
            // The written CSS, not the typing preview (inline style), is on the page.
            return el instanceof HTMLElement && el.style.fontSize === ''
              ? getComputedStyle(el).fontSize
              : '';
          }, sel)
          .catch(() => '');
        if (now === value) break;
        if (Date.now() - t0 > 10_000) {
          const css = readFileSync(join(APP, 'src/styles/guest/HomePage.css'), 'utf8');
          const at = css.indexOf('home-page__title');
          report('PB-02 stuck', {
            round: i,
            field: await fontSize.inputValue(),
            canvas: await frame.evaluate((q) => {
              const el = document.querySelector(q);
              return el instanceof HTMLElement
                ? { inline: el.style.fontSize, computed: getComputedStyle(el).fontSize }
                : undefined;
            }, sel),
            css: css.slice(Math.max(0, at - 20), at + 260),
          });
          throw new Error(`${value} never reached the Canvas`);
        }
        await page.waitForTimeout(10);
      }
      times.push(Date.now() - t0);
    }
    const pb02 = { samples: times.length, p95: p95(times), max: Math.max(...times) };
    report('PB-02 style confirm ms (P95 ≤ 500)', pb02);

    expect(cliToStudio).toBeLessThanOrEqual(2000);
    expect(canvasReady).toBeLessThanOrEqual(15_000);
    expect(pb01.p95).toBeLessThanOrEqual(16);
    expect(pb02.p95).toBeLessThanOrEqual(500);
  } finally {
    await session?.stop();
    await config.remove();
    // The class edits are not undone one by one: the copy goes back from the backup.
    const fixed = restore(APP, saved);
    report('files put back', fixed);
  }
});
