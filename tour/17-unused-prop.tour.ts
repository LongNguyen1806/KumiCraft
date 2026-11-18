// Tour 17 (owner, 2026-11-18): on his Test UI, an image picked for ProductCard changed nothing:
// the component names `image` but never shows it. The Inspector shows no knob for it.
import { rm } from 'node:fs/promises';
import { join, relative } from 'node:path';

import { expect, test } from '@playwright/test';

import { Bug, Tour } from './support/tour.ts';

test('17 a prop the component never shows', async ({ page }) => {
  test.setTimeout(3 * 60_000);
  const owner = relative(join(process.cwd(), 'fixtures'), 'D:/Study/Test UI');
  const tour = await Tour.open(page, owner, '17-unused-prop', (root) =>
    rm(join(root, '.kumicraft', 'lock'), { force: true }),
  );
  try {
    await tour.step('Chọn thẻ Atelier Table Lamp, xem Tùy chỉnh', async ({ note }) => {
      await expect(tour.canvas().getByText('Atelier Table Lamp')).toBeVisible({ timeout: 30_000 });
      // The third card's own frame, the row the Layers panel tags ProductCard.
      await page
        .getByRole('treeitem', { name: /div rounded.*ProductCard/ })
        .nth(2)
        .click();
      const nameRow = page.getByTestId('prop-row-name');
      await expect(nameRow).toBeVisible({ timeout: 10_000 });
      const rows = await page
        .locator('[data-testid^="prop-row-"]')
        .evaluateAll((els) => els.map((el) => el.getAttribute('data-testid')));
      note(`Các ô trong Tùy chỉnh: ${rows.join(', ')}`);
      if (rows.includes('prop-row-image')) throw new Bug('Vẫn hiện ô Ảnh mà component không dùng');
      note(
        `Ô Tên vẫn sửa được: ${(await page.getByTestId('prop-input-name').isEditable()) ? 'có' : 'không'}`,
      );
      await nameRow.scrollIntoViewIfNeeded();
    });
  } finally {
    await tour.close();
  }
});
