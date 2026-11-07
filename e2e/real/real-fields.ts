// Inspector property fields for the K9.5 runs (Tailwind projects): each field change must write
// the matching utility into exactly one file, and Undo gives every file back.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { expect, type Page } from '@playwright/test';

import { changedSince } from './real-files.ts';

type FieldCheck = { readonly property: string; readonly utility: (option: string) => string };

/** The field and the class an option writes (Tailwind 4 names). */
const FIELDS: readonly FieldCheck[] = [
  { property: 'paddingTop', utility: (o) => `pt-${o}` },
  { property: 'fontSize', utility: (o) => `text-${o}` },
  { property: 'fontWeight', utility: (o) => `font-${o}` },
  { property: 'borderRadius', utility: (o) => (o === 'DEFAULT' ? 'rounded' : `rounded-${o}`) },
];

export type FieldResult = { readonly field: string; readonly outcome: string };

function hasClass(text: string, cls: string): boolean {
  const escaped = cls.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`(^|[\\s"'\`])${escaped}($|[\\s"'\`])`, 'm').test(text);
}

async function checkField(
  tab: Page,
  appDir: string,
  base: ReadonlyMap<string, string>,
  check: FieldCheck,
): Promise<FieldResult> {
  const select = tab.getByTestId(`input-${check.property}`);
  if ((await select.count()) === 0) return { field: check.property, outcome: 'no field' };
  if (await select.isDisabled()) return { field: check.property, outcome: 'locked' };
  const current = await select.inputValue();
  const options = await select
    .locator('option')
    .evaluateAll((all) => all.map((o) => (o instanceof HTMLOptionElement ? o.value : '')));
  const pick = options.find((o) => o !== '' && o !== current);
  if (pick === undefined) return { field: check.property, outcome: 'no other option' };
  await select.selectOption(pick);
  await expect
    .poll(() => changedSince(appDir, base).length, { timeout: 15_000 })
    .toBeGreaterThan(0);
  const changed = changedSince(appDir, base);
  const file = changed[0] ?? '';
  const text = readFileSync(join(appDir, file), 'utf8');
  await select.blur({ timeout: 3_000 }).catch(() => undefined);
  // Undo in every case, so a wrong write never stays in the copy.
  await tab.keyboard.press('Control+z');
  await expect.poll(() => changedSince(appDir, base), { timeout: 15_000 }).toEqual([]);
  // The Inspector shows the restored value again before the next field is used.
  await expect(select).toHaveValue(current, { timeout: 10_000 });
  if (changed.length !== 1)
    return { field: check.property, outcome: `wrong: ${changed.join(', ')}` };
  if (!hasClass(text, check.utility(pick))) {
    return { field: check.property, outcome: `wrong: ${file} lacks ${check.utility(pick)}` };
  }
  return { field: `${check.property}=${pick} in ${file}`, outcome: 'field edited and undone' };
}

/** Every field check on the element the Inspector shows now. */
export async function checkFields(
  tab: Page,
  appDir: string,
  base: ReadonlyMap<string, string>,
): Promise<FieldResult[]> {
  const results: FieldResult[] = [];
  for (const check of FIELDS) results.push(await checkField(tab, appDir, base, check));
  return results;
}
