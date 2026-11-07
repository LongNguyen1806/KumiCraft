// Inline text edits for the K9.5 runs: double-click a short text, type, Enter; exactly one file
// gets the text, and Undo gives every file back.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { expect, type Frame, type Page } from '@playwright/test';

import { changedSince } from './real-files.ts';

export type TextCandidate = { loc: string; x: number; y: number; text: string };
type Point = { readonly x: number; readonly y: number };
const TYPED = ' kcqa';

/** Visible elements whose only content is a short text (a heading, a label, a button). */
export async function textCandidates(tab: Page, frame: Frame): Promise<TextCandidate[]> {
  const outer =
    (await tab.locator('iframe[data-testid="canvas-iframe"]').first().boundingBox()) ?? undefined;
  if (outer === undefined) return [];
  const inner = await frame.evaluate(() => {
    const out: { loc: string; x: number; y: number; text: string }[] = [];
    const seen = new Set<string>();
    for (const el of document.querySelectorAll('[data-rc-loc]')) {
      const loc = el.getAttribute('data-rc-loc') ?? '';
      if (seen.has(loc)) continue;
      const only = el.childNodes.length === 1 ? el.firstChild : undefined;
      const text = only?.nodeType === Node.TEXT_NODE ? (only.textContent ?? '').trim() : '';
      const rect = el.getBoundingClientRect();
      if (text.length < 3 || text.length > 60 || rect.width < 20) continue;
      if (rect.top < 0 || rect.bottom > window.innerHeight) continue;
      seen.add(loc);
      out.push({
        loc,
        x: rect.left + Math.min(rect.width / 2, 40),
        y: rect.top + rect.height / 2,
        text,
      });
    }
    return { out, width: window.innerWidth };
  });
  const scale = outer.width / inner.width;
  return inner.out.map((c) => ({ ...c, x: outer.x + c.x * scale, y: outer.y + c.y * scale }));
}

/**
 * Where the element is now, once it shows its own text again: the page may still show the last
 * edit, since the undo's hot update lands a moment later.
 */
async function pointOf(tab: Page, frame: Frame, c: TextCandidate): Promise<Point | undefined> {
  const outer =
    (await tab.locator('iframe[data-testid="canvas-iframe"]').first().boundingBox()) ?? undefined;
  const inner = await frame.evaluate(
    ([loc, text]) => {
      // A loop gives one location many elements: the one with this text.
      for (const el of document.querySelectorAll(`[data-rc-loc="${loc ?? ''}"]`)) {
        if (el.textContent.trim() !== text) continue;
        const r = el.getBoundingClientRect();
        return { x: r.left + Math.min(r.width / 2, 40), y: r.top + r.height / 2, w: innerWidth };
      }
      return undefined;
    },
    [c.loc, c.text],
  );
  if (outer === undefined || inner === undefined) return undefined;
  const scale = outer.width / inner.w;
  return { x: outer.x + inner.x * scale, y: outer.y + inner.y * scale };
}

async function startsEditing(frame: Frame): Promise<boolean> {
  try {
    await expect
      .poll(
        () => frame.evaluate(() => document.activeElement?.getAttribute('contenteditable') ?? ''),
        { timeout: 4_000 },
      )
      .toMatch(/true|plaintext-only/);
    return true;
  } catch {
    return false;
  }
}

export async function editTextAndUndo(
  tab: Page,
  appDir: string,
  base: ReadonlyMap<string, string>,
  c: TextCandidate,
): Promise<{ loc: string; outcome: string }> {
  await tab.keyboard.press('Escape');
  const handle = await tab.locator('iframe[data-testid="canvas-iframe"]').first().elementHandle();
  const frame = (await handle.contentFrame()) ?? undefined;
  if (frame === undefined) return { loc: c.loc, outcome: 'no canvas' };
  try {
    await expect.poll(() => pointOf(tab, frame, c), { timeout: 10_000 }).toBeDefined();
  } catch {
    // Live text (a clock, "2 minutes ago", a counter) changed on its own: try another element.
    return { loc: c.loc, outcome: 'skipped: the app changed this text itself' };
  }
  const point = (await pointOf(tab, frame, c)) ?? c;
  await tab.mouse.dblclick(point.x, point.y);
  if (!(await startsEditing(frame))) {
    return { loc: c.loc, outcome: 'not editable (expression or locked)' };
  }
  // The page moved under the pointer (data loading in): the text being edited is another one.
  const editingLoc = await frame.evaluate(
    () => document.activeElement?.closest('[data-rc-loc]')?.getAttribute('data-rc-loc') ?? '',
  );
  if (editingLoc !== c.loc) {
    await tab.keyboard.press('Escape');
    return { loc: c.loc, outcome: 'skipped: the page moved, another text got the click' };
  }
  await tab.keyboard.press('End');
  await tab.keyboard.type(TYPED);
  await tab.keyboard.press('Enter');
  await expect
    .poll(() => changedSince(appDir, base).length, { timeout: 15_000 })
    .toBeGreaterThan(0);
  const changed = changedSince(appDir, base);
  const file = changed[0] ?? '';
  const written = readFileSync(join(appDir, file), 'utf8');
  const line = written.split('\n').find((l) => l.toLowerCase().includes(TYPED.trim())) ?? '';
  // Undo in every case, so a wrong write never stays in the copy.
  await tab.keyboard.press('Control+z');
  await expect.poll(() => changedSince(appDir, base), { timeout: 15_000 }).toEqual([]);
  if (changed.length !== 1) return { loc: c.loc, outcome: `wrong: ${changed.join(', ')}` };
  if (!written.includes(`${c.text}${TYPED}`)) {
    return { loc: c.loc, outcome: `wrong: ${file} has "${line.trim()}"` };
  }
  return { loc: `${file} (${c.loc})`, outcome: 'text edited and undone byte for byte' };
}
