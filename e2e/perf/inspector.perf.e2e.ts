// PB-02 (K9 C6): confirm a class in the Inspector 30 times on the TS fixture; from Enter to the
// Canvas element carrying the new class (the file written, HMR, `selection-info` after it) takes
// P95 ≤ 500 ms.
import { expect, test } from '@playwright/test';

import { canvasPoint, p95, startPerfRun } from './perf-support.ts';

// Trace snapshots walk the whole DOM after every action and would be measured as app time.
test.use({ trace: 'off' });

test('PB-02: Inspector class confirm → new class on the Canvas, 30 times, P95 ≤ 500 ms [WP-4.00]', async ({
  page,
}) => {
  test.setTimeout(240_000);
  const run = await startPerfRun(page);
  try {
    const heading = await canvasPoint(run, 'h1');
    await run.tab.mouse.click(heading.x, heading.y);
    await run.tab.getByTestId('raw-class-details').locator('summary').click();
    const input = run.tab.getByTestId('raw-class-input');
    await expect(input).toBeVisible();
    const base = await input.inputValue();
    expect(base).toContain('text-hero');

    const times: number[] = [];
    for (let i = 0; i < 30; i++) {
      const marker = `kc-pb02-${String(i)}`;
      await input.fill(`${base} ${marker}`);
      const started = Date.now();
      await input.press('Enter');
      // Polled from here every 10 ms: an in-page waitForFunction is lost when the hot update
      // replaces the page's script context.
      for (;;) {
        const has = await run.canvas
          .evaluate((cls) => document.querySelector('h1')?.classList.contains(cls) === true, marker)
          .catch(() => false);
        if (has) break;
        if (Date.now() - started > 10_000) throw new Error(`${marker} never reached the Canvas`);
        await run.tab.waitForTimeout(10);
      }
      times.push(Date.now() - started);
      // The Inspector shows the written class string before the next round.
      await expect(input).toHaveValue(`${base} ${marker}`);
    }
    const result = { samples: times.length, p95: p95(times), max: Math.max(...times) };
    process.stdout.write(`PB-02 confirm ms: ${JSON.stringify(result)}\n`);
    expect(result.p95).toBeLessThanOrEqual(500);
  } finally {
    await run.stop();
  }
});
