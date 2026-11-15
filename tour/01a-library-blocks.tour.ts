// Tour 01a: every Library block, added into <main> of a Tailwind page with its + button, as a user
// does. Each one must be written to the file, keep the Canvas free of errors, show up on the
// Canvas, and go away exactly with one Undo. Blocks that ask for a data source are noted.
import { expect, test } from '@playwright/test';

import { Bug, diffFiles, Tour } from './support/tour.ts';

test('01a Library: every block goes in and comes back out', async ({ page }) => {
  test.setTimeout(6 * 60_000);
  const tour = await Tour.open(page, 'projects/vite8-react19-ts', '01a-library-blocks');
  try {
    await tour.selectLayer(/\bmain\b/);
    await tour.openPanel('library');
    const ids = (
      await page
        .locator('[data-testid^="library-add-"]')
        .evaluateAll((els) => els.map((el) => el.getAttribute('data-testid') ?? ''))
    ).map((id) => id.replace('library-add-', ''));

    await tour.step('Đếm số khối trong Library', ({ note }) => {
      note(`${String(ids.length)} khối có nút +`);
      if (ids.length < 60) throw new Bug(`Chỉ thấy ${String(ids.length)} khối, thiếu so với ~70`);
    });

    for (const id of ids) {
      await tour.step(`Thêm khối ${id} vào main rồi Hoàn tác`, async ({ note, bug }) => {
        await tour.selectLayer(/\bmain\b/);
        await tour.openPanel('library');
        const before = await tour.files();
        const add = page.getByTestId(`library-add-${id}`);
        await add.scrollIntoViewIfNeeded();
        if (!(await add.isEnabled())) throw new Bug('Nút + bị khóa khi đang chọn main');
        await add.click();
        const picker = page.getByTestId('data-source-picker');
        if (await tour.appears(picker, 800)) {
          note('Khối này hỏi nguồn dữ liệu');
          await page.keyboard.press('Escape');
          if (await picker.isVisible()) {
            bug('Hộp thoại nguồn dữ liệu không đóng khi bấm Esc (phải bấm Hủy)');
            await picker.getByRole('button', { name: 'Hủy' }).last().click();
          }
          await expect(picker).toBeHidden();
          if (diffFiles(before, await tour.files()).length > 0) {
            throw new Bug('Đóng hộp thoại nguồn dữ liệu mà file vẫn bị sửa');
          }
          return;
        }
        const after = await tour.waitChange(before);
        note(diffFiles(before, after, 4).join('\n'));
        // The new block is selected: the Inspector names a line of the page file.
        const inspector = page.getByTestId('inspector-panel');
        if (!(await tour.appears(inspector.getByText(/\.(tsx|jsx):\d+:/).first(), 3_000))) {
          bug('Thêm xong nhưng khối mới không được chọn (Inspector trống)');
        }
        await tour.undoTo(before);
      });
    }
  } finally {
    await tour.close();
  }
});
