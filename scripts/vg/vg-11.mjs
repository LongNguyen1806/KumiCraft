// VG-11 (SPEC-01.2 section 13): drag and drop into the Canvas iframe with @dnd-kit, on flex and
// grid nested 6 levels, at zoom 50 / 100 / 200 %, frames 375 and 1280 px, in Chromium, Firefox and
// WebKit. Builds packages/studio/spikes, serves it, drives it, prints the results.
// Run with: node scripts/vg/vg-11.mjs
/* global document, location, URLSearchParams, window */
import { chromium, firefox, webkit } from '@playwright/test';

import { buildSpikes, serveSpikes } from './spike-server.mjs';

const percentile = (values, p) => {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length))] ?? 0;
};

/** Client point at fractions (`fx`, `fy`) of node `id` inside the scaled iframe. */
const pointOf = (page, id, fx, fy) =>
  page.evaluate(
    ({ id, fx, fy }) => {
      const frame = document.querySelector('iframe');
      const zoom = Number(new URLSearchParams(location.search).get('zoom') ?? '1');
      const outer = frame.getBoundingClientRect();
      const box = frame.contentDocument
        .querySelector(`[data-rc-node="${id}"]`)
        .getBoundingClientRect();
      return {
        x: outer.left + (box.left + fx * box.width) * zoom,
        y: outer.top + (box.top + fy * box.height) * zoom,
      };
    },
    { id, fx, fy },
  );

/** Waits until the drop count passes `count`: WebKit ends the drag a frame after `pointerup`. */
const nextDrop = async (page, count) => {
  try {
    await page.waitForFunction((n) => window.__vg11.drops.length > n, count, { timeout: 5000 });
  } catch {
    const events = await page.evaluate(() => window.__vg11.events.slice(-6));
    return { missing: true, events };
  }
  return page.evaluate(() => window.__vg11.drops.at(-1));
};

/**
 * A person's pace: a few milliseconds between the phases of a drag and between drags. Headless
 * WebKit paints far fewer frames than a real browser, and a drag started within the same frame
 * as the previous drop is ignored there; no person can do that.
 */
const pause = (page, ms = 50) => page.waitForTimeout(ms);

async function drag(page, handle, to) {
  await pause(page, 250);
  const count = await page.evaluate(() => window.__vg11.drops.length);
  const from = await page.getByTestId(handle).boundingBox();
  await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
  await page.mouse.down();
  await pause(page);
  await page.mouse.move(from.x + from.width / 2 + 12, from.y + from.height / 2 + 12, { steps: 3 });
  await pause(page);
  await page.mouse.move(to.x, to.y, { steps: 8 });
  await pause(page);
  await page.mouse.up();
  return nextDrop(page, count);
}

/** Scenario: what is dragged, where it is dropped, where it must land. */
const SCENARIOS = [
  {
    name: 'level 6 row, left half of the first item',
    handle: 'lib:Button',
    at: ['item-1', 0.2, 0.5],
    expect: { container: 'leafbox-1', index: 0 },
  },
  {
    name: 'level 6 row, right half of the last item',
    handle: 'lib:Button',
    at: ['item-2', 0.8, 0.5],
    expect: { container: 'leafbox-1', index: 2 },
  },
  {
    name: 'empty container',
    handle: 'lib:Section',
    at: ['empty-box', 0.5, 0.5],
    expect: { container: 'empty-box', index: 0 },
  },
  {
    name: 'locked container is skipped',
    handle: 'lib:Button',
    at: ['locked-child', 0.5, 0.25],
    expect: { container: 'card-2', index: 0 },
  },
  {
    name: 'node into its own descendant is refused',
    handle: 'move-card-1',
    at: ['item-1', 0.5, 0.5],
    expect: { container: 'sec-1', index: 0 },
  },
  {
    name: 'leaf drops into its container',
    handle: 'lib:Button',
    at: ['header', 0.5, 0.2],
    expect: { container: 'root', index: 0 },
  },
];

async function runLayouts(page, origin) {
  const rows = [];
  for (const width of [375, 1280]) {
    for (const zoom of [0.5, 1, 2]) {
      await page.goto(`${origin}/vg-11/index.html?width=${String(width)}&zoom=${String(zoom)}`);
      await page.waitForFunction(() => window.__vg11?.ready === true);
      for (const scenario of SCENARIOS) {
        const [id, fx, fy] = scenario.at;
        const drop = await drag(page, scenario.handle, await pointOf(page, id, fx, fy));
        const ok =
          drop?.target?.container === scenario.expect.container &&
          drop.target.index === scenario.expect.index;
        rows.push({
          width,
          zoom,
          scenario: scenario.name,
          ok,
          got: drop?.missing ? drop : drop?.target,
        });
      }
    }
  }
  return rows;
}

async function runKeyboard(page, origin) {
  await page.goto(`${origin}/vg-11/index.html?width=1280&zoom=1`);
  await page.waitForFunction(() => window.__vg11?.ready === true);
  const stops = await page.evaluate(() => window.__vg11.stopTargets('lib:Button'));
  // A person presses keys frames apart; dnd-kit starts listening one tick after the drag starts.
  const press = async (key) => {
    await page.keyboard.press(key);
    await pause(page, 80);
  };
  await page.getByTestId('lib:Button').focus();
  await press('Space');
  for (let i = 0; i < 3; i++) await press('ArrowDown');
  await press('Space');
  const dropped = await nextDrop(page, 0);
  await pause(page, 250);
  await page.getByTestId('lib:Button').focus();
  await press('Space');
  await press('ArrowDown');
  await press('Escape');
  await pause(page, 250);
  const afterCancel = await page.evaluate(() => window.__vg11.drops.length);
  const ok = JSON.stringify(dropped?.target) === JSON.stringify(stops[2]) && afterCancel === 1;
  return { ok, stops: stops.length, dropped: dropped?.target };
}

async function runBudget(page, origin) {
  await page.goto(`${origin}/vg-11/index.html?width=1280&zoom=1`);
  await page.waitForFunction(() => window.__vg11?.ready === true);
  const from = await page.getByTestId('lib:Button').boundingBox();
  const frame = await page.locator('iframe').boundingBox();
  await page.mouse.move(from.x + 10, from.y + 10);
  await page.mouse.down();
  for (let i = 0; i < 300; i++) {
    await page.mouse.move(frame.x + 20 + ((i * 37) % 900), frame.y + 20 + ((i * 53) % 500));
  }
  await page.mouse.up();
  const { computeMs, renderMs } = await page.evaluate(() => window.__vg11);
  return {
    pb15: percentile(computeMs, 95),
    pb13: percentile(renderMs, 95),
    samples: computeMs.length,
  };
}

async function main() {
  buildSpikes();
  const { server, origin } = await serveSpikes();
  const summary = [];
  for (const engine of [chromium, firefox, webkit]) {
    const browser = await engine.launch();
    const page = await browser.newPage({ viewport: { width: 2800, height: 1600 } });
    const rows = await runLayouts(page, origin);
    const keyboard = await runKeyboard(page, origin);
    const budget = await runBudget(page, origin);
    await browser.close();
    const failed = rows.filter((row) => !row.ok);
    summary.push({
      browser: engine.name(),
      drops: `${String(rows.length - failed.length)}/${String(rows.length)}`,
      keyboard: keyboard.ok,
      ...budget,
    });
    for (const row of failed)
      console.log(
        `  FAIL ${engine.name()} ${String(row.width)}px zoom ${String(row.zoom)}: ${row.scenario} -> ${JSON.stringify(row.got)}`,
      );
    if (!keyboard.ok) console.log(`  FAIL ${engine.name()} keyboard: ${JSON.stringify(keyboard)}`);
  }
  server.close();
  console.table(
    summary.map((row) => ({
      ...row,
      pb15: `${row.pb15.toFixed(2)} ms`,
      pb13: `${row.pb13.toFixed(2)} ms`,
    })),
  );
  const passed = summary.every(
    (row) =>
      row.drops.split('/')[0] === row.drops.split('/')[1] &&
      row.keyboard &&
      row.pb15 <= 8 &&
      row.pb13 <= 16,
  );
  console.log(`VG-11: ${passed ? 'PASSED' : 'FAILED'}`);
  if (!passed) process.exitCode = 1;
}

await main();
