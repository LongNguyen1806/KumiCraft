import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';

import { expect, test } from '@playwright/test';
import { documentToFiles } from '@reactcraft/model';

import { generateLargeWorkspace } from '../../scripts/gen-large-workspace.ts';
import { openCanvasStudio } from '../support/canvas-studio.ts';
import { type CliSession, startCli } from '../support/cli-session.ts';
import { makeTempDir, REPO_ROOT } from '../support/copy-fixture.ts';

let workspace: { path: string; remove: () => Promise<void> };
let config: { path: string; remove: () => Promise<void> };
const sessions: CliSession[] = [];

const start = async (): Promise<CliSession> => {
  const session = await startCli(workspace.path, config.path);
  sessions.push(session);
  return session;
};

async function setupLargeWorkspace(): Promise<void> {
  const doc = generateLargeWorkspace(1, 500, 1);
  const files = documentToFiles(doc);
  for (const [relativePath, content] of Object.entries(files)) {
    const fullPath = join(workspace.path, relativePath);
    await mkdir(dirname(fullPath), { recursive: true });
    await writeFile(fullPath, content, 'utf8');
  }
}

const openStudio = openCanvasStudio;

function calculateP95(numbers: readonly number[]): number {
  if (numbers.length === 0) return 0;
  const sorted = [...numbers].sort((a, b) => a - b);
  const index = Math.ceil(0.95 * sorted.length) - 1;
  return sorted[Math.max(0, index)] ?? 0;
}

function calculateMax(numbers: readonly number[]): number {
  if (numbers.length === 0) return 0;
  return Math.max(...numbers);
}

type PerfStore = {
  pb13: Record<string, { p95: number; max: number }>;
  pb16: Record<string, number>;
};

async function savePerfMetric(
  browserName: string,
  pb13: { p95: number; max: number },
  pb16: number,
): Promise<void> {
  const resultPath = join(REPO_ROOT, 'bench-results', 'canvas-perf.json');
  await mkdir(dirname(resultPath), { recursive: true });
  let data: PerfStore = { pb13: {}, pb16: {} };
  try {
    const raw = await readFile(resultPath, 'utf8');
    data = JSON.parse(raw) as PerfStore;
  } catch {
    // Fresh file
  }
  data.pb13[browserName] = pb13;
  data.pb16[browserName] = Math.round(pb16 * 10) / 10;
  await writeFile(resultPath, JSON.stringify(data, undefined, 2), 'utf8');
}

test.describe('@perf Canvas Performance (PB-13, PB-16)', () => {
  test.beforeEach(async ({ browserName }) => {
    // Run time of the measuring script, not a budget: WebKit on Windows replays 300 mouse moves slowly.
    test.setTimeout(240_000);
    workspace = await makeTempDir(`canvas-perf-${browserName}`);
    config = await makeTempDir(`canvas-perf-config-${browserName}`);
    await setupLargeWorkspace();
  });

  test.afterEach(async () => {
    for (const session of sessions.splice(0)) await session.stop();
    await workspace.remove();
    await config.remove();
  });

  test('PB-16 (render 500 nodes <= 1000ms) and PB-13 (overlay update P95 <= 16ms)', async ({
    page,
    browserName,
  }) => {
    const session = await start();
    const tab = await openStudio(page, session);

    // 1. PB-16: Repeat 5 times, record rc:canvas-render, take max
    const pb16Samples: number[] = [];
    for (let i = 0; i < 5; i++) {
      if (i > 0) {
        await tab.reload();
        await expect(tab.getByTestId('frame')).toBeVisible();
      }
      await tab.waitForFunction(
        () => performance.getEntriesByName('rc:canvas-render').length > 0,
        undefined,
        { timeout: 10000 },
      );
      const duration = await tab.evaluate(() => {
        const entries = performance.getEntriesByName('rc:canvas-render');
        return entries.at(-1)?.duration ?? 0;
      });
      pb16Samples.push(duration);
    }
    const pb16Max = calculateMax(pb16Samples);
    expect(pb16Max).toBeLessThanOrEqual(1000);

    // 2. PB-13 at zoom 100%: mouse move across 200 positions
    await tab.evaluate(() => {
      performance.clearMeasures('rc:overlay-update');
    });
    const frame = tab.getByTestId('frame');
    const box = await frame.boundingBox();
    expect(box).not.toBeNull();
    if (!box) return;

    for (let i = 0; i < 200; i++) {
      const stepX = box.x + 20 + ((i * 19) % Math.max(10, box.width - 40));
      const stepY = box.y + 20 + ((i * 29) % Math.max(10, box.height - 40));
      await tab.mouse.move(stepX, stepY);
    }

    // 3. PB-13 at zoom 50%: resize viewport to trigger fit scale around 50%
    await tab.setViewportSize({ width: 850, height: 700 });
    for (let i = 0; i < 50; i++) {
      const stepX = box.x + 10 + ((i * 13) % Math.max(10, box.width / 2 - 20));
      const stepY = box.y + 10 + ((i * 17) % Math.max(10, box.height / 2 - 20));
      await tab.mouse.move(stepX, stepY);
    }

    // 4. Multi-select 20 nodes with Shift+Click and move mouse
    await tab.setViewportSize({ width: 1440, height: 900 });
    const canvas = tab.frameLocator('[data-testid="canvas-iframe"]');
    const nodes = canvas.locator('[data-rc-node]');
    const nodeCount = await nodes.count();
    const selectCount = Math.min(20, nodeCount);

    for (let i = 0; i < selectCount; i++) {
      await nodes.nth(i).click({ modifiers: ['Shift'] });
    }

    for (let i = 0; i < 50; i++) {
      const stepX = box.x + 25 + ((i * 23) % Math.max(10, box.width - 50));
      const stepY = box.y + 25 + ((i * 31) % Math.max(10, box.height - 50));
      await tab.mouse.move(stepX, stepY);
    }

    // Collect all rc:overlay-update measurements
    const overlayUpdates = await tab.evaluate(() =>
      performance.getEntriesByName('rc:overlay-update').map((e) => e.duration),
    );
    expect(overlayUpdates.length).toBeGreaterThanOrEqual(30);

    const p95 = calculateP95(overlayUpdates);
    const max = calculateMax(overlayUpdates);
    test.info().annotations.push({
      type: 'perf',
      description: `${browserName} PB-16 ${String(pb16Max)} ms, PB-13 P95 ${String(p95)} ms, max ${String(max)} ms (${String(overlayUpdates.length)} samples)`,
    });
    expect(p95).toBeLessThanOrEqual(16);

    await savePerfMetric(
      browserName,
      { p95: Math.round(p95 * 100) / 100, max: Math.round(max * 100) / 100 },
      pb16Max,
    );
  });
});
