// PB-01 (K9 C6): hover over a page of 2,000 elements for 200 frames; each Bridge hover step
// (hit test, overlay, message to the Studio) takes P95 ≤ 16 ms. Measured with `performance`
// marks inside the Bridge (perf-marks.ts).
import { expect, test } from '@playwright/test';

import { canvasPoint, generatedHome, p95, startPerfRun } from './perf-support.ts';

// Trace snapshots walk the whole DOM after every action and would be measured as app time.
test.use({ trace: 'off' });

test('PB-01: hover over 2,000 elements, 200 frames, P95 ≤ 16 ms [WP-4.00]', async ({ page }) => {
  test.setTimeout(180_000);
  const run = await startPerfRun(page, generatedHome(2000));
  try {
    await expect
      .poll(() => run.canvas.evaluate(() => document.querySelectorAll('[data-rc-loc]').length))
      .toBeGreaterThanOrEqual(2000);
    const from = await canvasPoint(run, 'main > div:nth-child(1)');
    const to = await canvasPoint(run, 'main > div:nth-child(40)');
    await run.tab.mouse.move(from.x, from.y);
    await run.canvas.evaluate(() => {
      performance.clearMeasures('kc:hover');
    });
    // 200 pointer moves, one per frame, down across 40 rows and back.
    for (let i = 0; i < 200; i++) {
      const t = i < 100 ? i / 99 : (199 - i) / 99;
      await run.tab.mouse.move(from.x + 3 * (i % 5), from.y + (to.y - from.y) * t);
    }
    const durations = await run.canvas.evaluate(() =>
      performance.getEntriesByName('kc:hover').map((entry) => entry.duration),
    );
    expect(durations.length).toBeGreaterThanOrEqual(150);
    const result = { samples: durations.length, p95: p95(durations), max: Math.max(...durations) };
    process.stdout.write(`PB-01 hover ms: ${JSON.stringify(result)}\n`);
    expect(result.p95).toBeLessThanOrEqual(16);
  } finally {
    await run.stop();
  }
});
