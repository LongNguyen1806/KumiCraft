// Shared setup of the performance runs (`pnpm bench:ui`, K9 C6): a copy of the Vite fixture whose
// Home page is generated at run time, the CLI, and the Bridge timing marks switched on.
import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import { expect, type Frame, type Page } from '@playwright/test';

import { type CliSession, startCli } from '../support/cli-session.ts';
import { copyFixture, makeTempDir, type TempDir } from '../support/copy-fixture.ts';
import { getCanvasFrame, trustIfAsked } from '../support/trust.ts';

export type PerfRun = {
  readonly tab: Page;
  readonly canvas: Frame;
  readonly folder: TempDir;
  readonly stop: () => Promise<void>;
};

/** A Home page of `count` static elements, each on its own line (own `data-rc-loc`). */
export function generatedHome(count: number, tag = 'div'): string {
  const rows = Array.from(
    { length: count },
    (_, i) => `      <${tag} className="p-1 text-xs">Item ${String(i)}</${tag}>`,
  );
  return `export function Home() {\n  return (\n    <main className="p-4">\n${rows.join('\n')}\n    </main>\n  );\n}\n`;
}

/** P95 of the samples (nearest rank). */
export function p95(samples: readonly number[]): number {
  const sorted = [...samples].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.ceil(sorted.length * 0.95) - 1)] ?? 0;
}

export async function startPerfRun(page: Page, home?: string): Promise<PerfRun> {
  const folder = await copyFixture('projects/vite8-react19-ts');
  const config = await makeTempDir('perf-config');
  if (home !== undefined) await writeFile(join(folder.path, 'src/pages/Home.tsx'), home);
  const session: CliSession = await startCli(folder.path, config.path);
  const context = page.context();
  // Read by the Bridge (perf-marks.ts) in every frame before its scripts run.
  await context.addInitScript(() => {
    Reflect.set(globalThis, '__KC_PERF__', true);
  });
  const tab = await context.newPage();
  await tab.setViewportSize({ width: 1600, height: 1000 });
  await tab.goto(session.studioUrl);
  await trustIfAsked(tab);
  await getCanvasFrame(tab);
  const handle = await tab.locator('iframe[data-testid="canvas-iframe"]').elementHandle();
  const canvas = (await handle.contentFrame()) ?? undefined;
  if (canvas === undefined) throw new Error('canvas frame missing');
  await expect
    .poll(() => canvas.evaluate(() => document.querySelectorAll('[data-rc-loc]').length), {
      timeout: 30_000,
    })
    .toBeGreaterThan(0);
  return {
    tab,
    canvas,
    folder,
    stop: async () => {
      await session.stop();
      await folder.remove();
      await config.remove();
    },
  };
}

/** Page coordinates of `selector`'s centre inside the scaled Canvas iframe. */
export async function canvasPoint(
  run: PerfRun,
  selector: string,
): Promise<{ readonly x: number; readonly y: number }> {
  const outer =
    (await run.tab.locator('iframe[data-testid="canvas-iframe"]').boundingBox()) ?? undefined;
  const inner = await run.canvas.evaluate((sel) => {
    const rect = document.querySelector(sel)?.getBoundingClientRect();
    return rect === undefined
      ? undefined
      : { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2, width: window.innerWidth };
  }, selector);
  if (outer === undefined || inner === undefined)
    throw new Error(`${selector} missing in the Canvas`);
  const scale = outer.width / inner.width;
  return { x: outer.x + inner.x * scale, y: outer.y + inner.y * scale };
}
