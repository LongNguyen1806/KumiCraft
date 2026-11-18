// Tour 11 (the owner's report, 2026-11-18): a colour used only in a draft did not show on the
// Canvas. Checks a class present when the Canvas starts, then one written while it runs.
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import { expect, test } from '@playwright/test';

import { Bug, Tour } from './support/tour.ts';

const DRAFT = 'src/drafts/Mau.tsx';
const draft = (cls: string) =>
  `export default function Mau() {\n  return <section className="p-8 ${cls}">Ô màu</section>;\n}\n`;

test('11 a class only a draft uses gets its CSS', async ({ page }) => {
  test.setTimeout(3 * 60_000);
  let root = '';
  const tour = await Tour.open(page, 'projects/vite8-react19-ts', '11-draft-classes', async (r) => {
    root = r;
    await mkdir(join(r, 'src/drafts'), { recursive: true });
    await writeFile(join(r, DRAFT), draft('bg-lime-700'));
  });
  const box = () => tour.canvas().getByText('Ô màu');
  const bg = () => box().evaluate((el) => getComputedStyle(el).backgroundColor);
  try {
    await tour.openPanel('drafts');
    await page.getByTestId(`draft-open-${DRAFT}`).click();
    await expect(box()).toBeVisible({ timeout: 20_000 });

    await tour.step('Màu có sẵn lúc mở Canvas', async ({ note }) => {
      const color = await bg();
      note(color);
      if (color === 'rgba(0, 0, 0, 0)') throw new Bug('bg-lime-700 không có CSS');
    });

    await tour.step('Màu ghi vào file khi Canvas đang chạy', async ({ note }) => {
      await writeFile(join(root, DRAFT), draft('bg-fuchsia-600'));
      await page.waitForTimeout(3000);
      const color = await bg();
      note(color);
      if (color === 'rgba(0, 0, 0, 0)') throw new Bug('bg-fuchsia-600 không có CSS');
    });
  } finally {
    await tour.close();
  }
});
