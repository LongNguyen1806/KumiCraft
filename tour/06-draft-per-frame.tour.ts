// Tour 06 (owner's report, 2026-11-15): frame 1 shows a draft, frame 2 a page, at the same time.
// The toolbar never prints the draft's internal address, and each frame keeps what it shows.
import { expect, test } from '@playwright/test';

import { Bug, Tour } from './support/tour.ts';

test('06 a draft in frame 1, a page in frame 2', async ({ page }) => {
  test.setTimeout(3 * 60_000);
  const tour = await Tour.open(page, 'projects/vite8-react19-ts', '06-draft-per-frame');
  const frames = page.locator('iframe[data-testid="canvas-iframe"]');
  const toolbarRoute = page.getByTestId('canvas-route');
  try {
    await tour.step('Thêm khung thứ 2', async () => {
      await page.getByTestId('add-frame-btn').click();
      await page.getByTestId('add-frame-item-desktop').click();
      await expect(frames).toHaveCount(2);
    });

    await tour.step('Khung 1: tạo và mở bản nháp', async () => {
      await frames.nth(0).click({ position: { x: 20, y: 20 } });
      await tour.openPanel('drafts');
      await page.getByTestId('drafts-new-btn').click();
      await page.getByTestId('draft-kind-blank').click();
      await page.getByTestId('draft-create').click();
      await expect
        .poll(() => frames.nth(0).getAttribute('src'), { timeout: 15_000 })
        .toContain('__kumicraft/draft');
    });

    await tour.step('Khung 2 vẫn là trang, không thành bản nháp', async () => {
      const src = (await frames.nth(1).getAttribute('src')) ?? '';
      if (src.includes('__kumicraft/draft')) throw new Bug(`Khung 2 cũng mở bản nháp: ${src}`);
    });

    await tour.step('Bấm sang khung 2: thanh công cụ không in địa chỉ nội bộ', async ({ note }) => {
      await frames.nth(1).click({ position: { x: 20, y: 20 } });
      await page.waitForTimeout(800);
      const texts = await toolbarRoute.allInnerTexts();
      note(`Dòng route: ${texts.join(' | ') || '(không có)'}`);
      if (texts.some((t) => t.includes('__kumicraft'))) {
        throw new Bug('Thanh công cụ in địa chỉ /__kumicraft/… của bản nháp');
      }
      const src0 = (await frames.nth(0).getAttribute('src')) ?? '';
      if (!src0.includes('__kumicraft/draft'))
        throw new Bug('Khung 1 mất bản nháp khi chọn khung 2');
    });
  } finally {
    await tour.close();
  }
});
