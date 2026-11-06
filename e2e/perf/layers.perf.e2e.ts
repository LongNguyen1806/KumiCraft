// R-SL-12 (K9 C6): the Layers tree of a page with 5,000 nodes scrolls continuously, rows passing
// under the pointer (hover), with no frame over 50 ms of main-thread work. Chromium's Long
// Animation Frames API reports every frame longer than 50 ms with its scripts and render time;
// the work in it (scripts + style, layout, paint) is what the Studio spends. The frame's own length
// and requestAnimationFrame gaps are not used: headless Chromium rasterizes in software and
// delays frames for reasons outside the page.
import { expect, test } from '@playwright/test';

import { generatedHome, startPerfRun } from './perf-support.ts';

// Trace snapshots walk the whole DOM after every action and would be measured as app time.
test.use({ trace: 'off' });

test('R-SL-12: Layers tree of 5,000 nodes scrolls with no frame over 50 ms [WP-4.00]', async ({
  page,
}) => {
  test.setTimeout(240_000);
  const run = await startPerfRun(page, generatedHome(5000, 'p'));
  try {
    const tree = run.tab.getByRole('tree');
    await expect(tree).toBeVisible({ timeout: 30_000 });
    await expect
      .poll(() => tree.getByRole('treeitem').count(), { timeout: 60_000 })
      .toBeGreaterThanOrEqual(5000);
    const box = (await tree.boundingBox()) ?? undefined;
    if (box === undefined) throw new Error('layers tree not laid out');
    await run.tab.mouse.move(box.x + box.width / 2, box.y + Math.min(200, box.height / 2));
    // Let the page settle after the tree first rendered.
    await run.tab.waitForTimeout(1000);

    await run.tab.evaluate(() => {
      const work: number[] = [];
      Reflect.set(globalThis, '__kcLongFrames', work);
      const numberOf = (from: object, key: string): number => {
        const value: unknown = Reflect.get(from, key);
        return typeof value === 'number' ? value : 0;
      };
      new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          const end = entry.startTime + entry.duration;
          const renderStart = numberOf(entry, 'renderStart');
          const scripts: unknown = Reflect.get(entry, 'scripts');
          const scriptTime = Array.isArray(scripts)
            ? scripts.reduce(
                (sum: number, sc: unknown) =>
                  sum + (sc instanceof Object ? numberOf(sc, 'duration') : 0),
                0,
              )
            : 0;
          work.push(scriptTime + (renderStart > 0 ? end - renderStart : 0));
        }
      }).observe({ type: 'long-animation-frame' });
    });
    const scrollTopOf = () =>
      tree.evaluate((el) => {
        let node: Element | undefined = el;
        while (node !== undefined && node.scrollHeight <= node.clientHeight) {
          node = node.parentElement ?? undefined;
        }
        return node?.scrollTop ?? 0;
      });
    // About 3 s of wheel scrolling down, then back up.
    for (let i = 0; i < 180; i++) {
      await run.tab.mouse.wheel(0, i < 120 ? 400 : -600);
      await run.tab.waitForTimeout(16);
      if (i === 119) expect(await scrollTopOf()).toBeGreaterThan(10_000);
    }
    await run.tab.waitForTimeout(200);
    const long = await run.tab.evaluate(() => {
      const value: unknown = Reflect.get(globalThis, '__kcLongFrames');
      return Array.isArray(value) ? value.filter((v): v is number => typeof v === 'number') : [];
    });
    const result = { longFrames: long.length, maxWork: long.length === 0 ? 0 : Math.max(...long) };
    process.stdout.write(`R-SL-12 long frames, main-thread work ms: ${JSON.stringify(result)}\n`);
    expect(result.maxWork).toBeLessThanOrEqual(50);
  } finally {
    await run.stop();
  }
});
