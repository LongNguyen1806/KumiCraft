// Tour 03: every field the Inspector shows, on each kind of element of a Tailwind page. For each
// element every group is opened, then each number field gets a suggested value (or a typed one),
// each segment row another option, each color field a palette color. Every change must be written
// to the file as valid classes, and one Undo must give the file back exactly. One test per element
// keeps each run short (`-g section`, `-g h1`…).
import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import { expect, type Page, test } from '@playwright/test';

import { Bug, diffFiles, type StepContext, Tour } from './support/tour.ts';

const HOME = 'src/pages/Home.tsx';

const PAGE = `export function Home() {
  return (
    <main className="min-h-screen bg-slate-50 p-6">
      <section className="mx-auto flex max-w-3xl flex-col gap-4 rounded-lg bg-white p-6">
        <h1 className="text-3xl font-bold text-slate-900">Tiêu đề mẫu</h1>
        <p className="text-slate-600">Đoạn văn mẫu.</p>
        <a href="/gia" className="text-blue-600 underline">
          Liên kết mẫu
        </a>
        <button type="button" className="rounded bg-blue-600 px-4 py-2 text-white">
          Nút mẫu
        </button>
        <img src="/logo.png" alt="" className="h-12 w-12" />
      </section>
    </main>
  );
}

export default Home;
`;

const RESTORE = { restore: true } as const;

/** Classes that no hand would write: an unfilled value, or the same class twice. */
function badClasses(diff: string): string[] {
  const out: string[] = [];
  for (const line of diff.split('\n').filter((l) => l.trim().startsWith('+'))) {
    const cls = /className="([^"]*)"/.exec(line)?.[1];
    if (cls === undefined) continue;
    const tokens = cls.split(/\s+/).filter((t) => t !== '');
    for (const t of tokens) {
      if (/undefined|NaN|null|\[\]|^-|--$/.test(t)) out.push(`class lạ: ${t}`);
    }
    const seen = new Set<string>();
    for (const t of tokens) {
      if (seen.has(t)) out.push(`class lặp: ${t}`);
      seen.add(t);
    }
  }
  return out;
}

async function openAllGroups(page: Page): Promise<void> {
  for (let round = 0; round < 3; round += 1) {
    const closed = page.locator('[data-testid^="inspector-group-"][aria-expanded="false"]');
    const n = await closed.count();
    if (n === 0) return;
    for (let i = 0; i < n; i += 1) await closed.first().click();
  }
}

async function testIds(page: Page, prefix: string): Promise<string[]> {
  return page
    .getByTestId('inspector-panel')
    .locator(`[data-testid^="${prefix}"]:visible`)
    .evaluateAll((els) => els.map((el) => el.getAttribute('data-testid') ?? ''));
}

/** One field change: the file must change into valid classes. */
async function fieldStep(
  tour: Tour,
  name: string,
  act: (ctx: StepContext) => Promise<void>,
): Promise<void> {
  await tour.step(
    name,
    async (ctx) => {
      const before = await tour.files();
      await act(ctx);
      const after = await tour.waitChange(before, 6_000);
      const diff = diffFiles(before, after, 6).join('\n');
      ctx.note(diff);
      for (const bad of badClasses(diff)) ctx.bug(bad);
    },
    RESTORE,
  );
}

async function sweep(page: Page, tour: Tour, label: string, select: () => Promise<void>) {
  const inspector = page.getByTestId('inspector-panel');
  const reselect = async () => {
    await select();
    await expect(page.getByTestId('inspector-loading')).toHaveCount(0);
    await openAllGroups(page);
  };
  await reselect();

  for (const id of await testIds(page, 'input-')) {
    const property = id.replace('input-', '');
    await fieldStep(tour, `${label} · ô ${property}`, async ({ note }) => {
      await reselect();
      const input = inspector.getByTestId(id);
      if (!(await input.isEditable())) throw new Bug('Ô bị khóa');
      const tag = await input.evaluate((node) => node.tagName);
      if (tag === 'SELECT') {
        // A list: the first real value that is not the current one.
        const values = await input
          .locator('option')
          .evaluateAll((els) => els.map((el) => el.getAttribute('value') ?? ''));
        const current = await input.inputValue();
        const next = values.find((v) => v !== '' && v !== current);
        if (next === undefined) throw new Bug('Danh sách không có giá trị khác để chọn');
        note(`chọn ${next}`);
        await input.selectOption(next);
        return;
      }
      await input.click();
      const suggest = inspector.getByTestId(`suggest-${property}`).locator('li');
      if (await tour.appears(suggest.first(), 800)) {
        const count = await suggest.count();
        const pickAt = Math.min(count - 1, 2);
        note(`chọn gợi ý ${String(pickAt + 1)}/${String(count)}`);
        await suggest.nth(pickAt).click();
      } else {
        await input.fill('12');
        await input.press('Enter');
      }
    });
  }

  const rows = [
    ...new Set(
      (await testIds(page, 'segment-')).map((id) =>
        id.replace(/^segment-/, '').replace(/-[^-]+$/, ''),
      ),
    ),
  ];
  for (const row of rows) {
    await fieldStep(tour, `${label} · nút chọn ${row}`, async ({ note }) => {
      await reselect();
      const options = inspector.locator(`[data-testid^="segment-${row}-"]:visible`);
      const n = await options.count();
      for (let i = 0; i < n; i += 1) {
        const option = options.nth(i);
        const pressed = await option.getAttribute('aria-pressed');
        if (pressed !== 'true' && (await option.isEnabled())) {
          note(`chọn ${(await option.getAttribute('data-testid')) ?? ''}`);
          await option.click();
          return;
        }
      }
      throw new Bug('Không có lựa chọn nào bấm được');
    });
  }

  for (const id of await testIds(page, 'color-field-')) {
    const property = id.replace('color-field-', '');
    await fieldStep(tour, `${label} · màu ${property}`, async ({ note }) => {
      await reselect();
      await inspector.getByTestId(id).click();
      const swatch = page.locator('[data-testid^="color-option-palette-"]:visible');
      if (!(await tour.appears(swatch.first(), 2_000))) throw new Bug('Bảng màu không mở');
      const pick = swatch.nth(Math.min(5, (await swatch.count()) - 1));
      note(`chọn ${(await pick.getAttribute('data-testid')) ?? ''}`);
      await pick.click();
    });
  }
}

/** The elements swept, picked by their Layers row. */
const ELEMENTS: readonly { readonly label: string; readonly layer: RegExp }[] = [
  { label: 'section', layer: /\bsection mx-auto\b/ },
  { label: 'h1', layer: /^h1\b/ },
  { label: 'button', layer: /^button\b/ },
  { label: 'a', layer: /^a\b/ },
  { label: 'img', layer: /^img\b/ },
];

for (const el of ELEMENTS) {
  test(`03 Inspector sweep: ${el.label}`, async ({ page }) => {
    test.setTimeout(6 * 60_000);
    const tour = await Tour.open(
      page,
      'projects/vite8-react19-ts',
      `03-inspector-${el.label}`,
      (root) => writeFile(join(root, HOME), PAGE),
    );
    try {
      await expect(tour.canvas().getByText('Nút mẫu')).toBeVisible({ timeout: 20_000 });
      await sweep(page, tour, el.label, () => tour.selectLayer(el.layer));
    } finally {
      await tour.close();
    }
  });
}
