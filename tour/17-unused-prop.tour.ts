// Tour 17 (owner, 2026-11-18): on his Test UI, an image picked for ProductCard changed nothing:
// the component names `image` but never shows it. The Inspector now says so, with no picker.
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
      const unused = page.getByTestId('prop-unused-image');
      await expect(unused).toBeVisible({ timeout: 10_000 });
      note(await unused.innerText());
      if (await page.getByTestId('prop-pick-image-image').isVisible()) {
        throw new Bug('Vẫn còn nút Chọn ảnh cho prop không dùng');
      }
      const name = page.getByTestId('prop-input-name');
      note(`Ô Tên vẫn sửa được: ${(await name.isEditable()) ? 'có' : 'không'}`);
      await unused.scrollIntoViewIfNeeded();
    });
  } finally {
    await tour.close();
  }
});
