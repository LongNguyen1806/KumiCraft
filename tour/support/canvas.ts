// Canvas helpers shared by the tours: a source line, an element's box on the page, a hand drag.
import type { Locator, Page } from '@playwright/test';

import { diffFiles, type StepContext, type Tour } from './tour.ts';

/** The source line that holds `text` (or the opening tag line above it). */
export async function lineWith(tour: Tour, file: string, text: string): Promise<string> {
  const lines = (await tour.file(file)).split(/\r?\n/);
  const i = lines.findIndex((l) => l.includes(text));
  if (i < 0) return '';
  const line = lines[i] ?? '';
  return line.includes('className') ? line.trim() : (lines[i - 1] ?? '').trim();
}

export async function boxOf(
  locator: Locator,
): Promise<{ x: number; y: number; w: number; h: number }> {
  const box = await locator.boundingBox();
  if (!box) throw new Error('Không thấy phần tử trên Canvas');
  return { x: box.x, y: box.y, w: box.width, h: box.height };
}

export async function drag(
  page: Page,
  from: { x: number; y: number },
  by: { x: number; y: number },
) {
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(from.x + by.x, from.y + by.y, { steps: 15 });
  await page.mouse.up();
}

/** One edit: do it, check the file, then Undo back to the exact text. */
export async function edit(
  tour: Tour,
  name: string,
  act: (ctx: StepContext) => Promise<void>,
  check: (ctx: StepContext & { readonly diff: string }) => Promise<void> | void,
): Promise<void> {
  await tour.step(
    name,
    async (ctx) => {
      const before = await tour.files();
      await act(ctx);
      const after = await tour.waitChange(before);
      const diff = diffFiles(before, after, 8).join('\n');
      ctx.note(diff);
      await check({ ...ctx, diff });
      // Undo is checked by `restore`, which also runs when the step failed half-way.
    },
    { restore: true },
  );
}
