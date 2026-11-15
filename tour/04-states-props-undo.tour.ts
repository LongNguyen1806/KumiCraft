// Tour 04 (hand-test steps 14, 16, 17 of 2026-11-15): a hover color leaves the normal color alone
// and the state goes back to "default"; a component prop edits only that use; a chain of edits
// undoes and redoes one step at a time.
import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import { expect, test } from '@playwright/test';

import { Bug, diffFiles, Tour } from './support/tour.ts';

const HOME = 'src/pages/Home.tsx';

const PAGE = `import { Card } from '../components/Card.tsx';

export function Home() {
  return (
    <main className="min-h-screen bg-slate-50 p-6">
      <div className="mx-auto max-w-3xl space-y-4">
        <button type="button" className="rounded bg-blue-600 px-4 py-2 text-white">
          Nút mẫu
        </button>
        <Card title="Thẻ một">Nội dung một</Card>
        <Card title="Thẻ hai">Nội dung hai</Card>
      </div>
    </main>
  );
}

export default Home;
`;

const lineOf = async (tour: Tour, text: string) =>
  (await tour.file(HOME))
    .split(/\r?\n/)
    .find((l) => l.includes(text))
    ?.trim() ?? '';

test('04 hover state, component prop, undo chain', async ({ page }) => {
  test.setTimeout(4 * 60_000);
  const tour = await Tour.open(page, 'projects/vite8-react19-ts', '04-states-props-undo', (root) =>
    writeFile(join(root, HOME), PAGE),
  );
  const inspector = page.getByTestId('inspector-panel');
  const state = page.getByTestId('interaction-state-select');
  try {
    await expect(tour.canvas().getByText('Nút mẫu')).toBeVisible({ timeout: 20_000 });

    await tour.step('14. Hover: nền đỏ khi rê, nền thường giữ nguyên', async ({ note }) => {
      await tour.selectLayer(/^button\b/);
      await state.selectOption('hover');
      await inspector.getByTestId('color-field-backgroundColor').click();
      await page.locator('[data-testid="color-option-palette-red-500"]:visible').first().click();
      await expect.poll(() => lineOf(tour, 'rounded bg-blue-600')).toContain('hover:bg-red-500');
      const line = await lineOf(tour, 'hover:bg-red-500');
      note(line);
      if (!/\sbg-blue-600\s/.test(` ${line} `)) throw new Bug('Nền thường bị đổi theo');
      await state.selectOption('none');
      await expect(inspector.getByTestId('color-field-backgroundColor')).toContainText('blue-600');
    });

    await tour.step('14b. Chọn phần tử khác rồi quay lại: Trạng thái về Mặc định', async () => {
      await tour.selectLayer(/^button\b/);
      await state.selectOption('hover');
      await tour.selectLayer(/\bmain\b/);
      await tour.selectLayer(/^button\b/);
      const value = await state.inputValue();
      if (value !== 'none') throw new Bug(`Trạng thái vẫn là "${value}" sau khi chọn lại`);
    });

    await tour.step('16. Sửa prop title của Thẻ một: chỉ chỗ dùng đó đổi', async ({ note }) => {
      await state.selectOption('none').catch(() => undefined);
      const before = await tour.files();
      // The first Card's root, as its Layers row (the Canvas picks the same element).
      await tour.selectLayer(/div rounded-xl/);
      const prop = inspector.getByTestId('prop-input-title');
      if (!(await tour.appears(prop, 5_000))) throw new Bug('Không thấy ô prop title');
      await prop.fill('Thẻ đã sửa');
      await prop.press('Enter');
      const after = await tour.waitChange(before);
      note(diffFiles(before, after, 4).join('\n'));
      const changed = diffFiles(before, after);
      if (changed.some((l) => l.includes('Card.tsx'))) throw new Bug('File Card.tsx bị sửa');
      const code = await tour.file(HOME);
      if (!code.includes('title="Thẻ đã sửa"')) throw new Bug('Chỗ dùng không đổi title');
      if (!code.includes('title="Thẻ hai"')) throw new Bug('Thẻ hai bị đổi theo');
    });

    await tour.step('17. Ba lần sửa → Hoàn tác 3 lần → Làm lại 3 lần, từng bước một', async () => {
      const snaps = [await tour.files()];
      await tour.selectLayer(/^button\b/);
      const closed = page.locator('[data-testid^="inspector-group-"][aria-expanded="false"]');
      while ((await closed.count()) > 0) await closed.first().click();
      // Three different fields: edits in one field in a row are one Undo step on purpose.
      for (const [field, value] of [
        ['input-paddingTop', '8'],
        ['input-marginTop', '4'],
        ['input-zIndex', '10'],
      ] as const) {
        const input = inspector.getByTestId(field);
        await input.fill(value);
        await input.press('Enter');
        snaps.push(await tour.waitChange(snaps[snaps.length - 1] ?? new Map()));
      }
      const undo = page.getByRole('button', { name: /^Hoàn tác\b.*\(/ });
      for (let i = 3; i > 0; i -= 1) {
        await undo.click();
        await expect
          .poll(async () => diffFiles(snaps[i - 1] ?? new Map(), await tour.files()).length)
          .toBe(0);
      }
      for (let i = 1; i <= 3; i += 1) {
        await tour.redo();
        const left = diffFiles(snaps[i] ?? new Map(), await tour.files());
        if (left.length > 0) throw new Bug(`Làm lại lần ${String(i)} sai:\n${left.join('\n')}`);
      }
    });
  } finally {
    await tour.close();
  }
});
