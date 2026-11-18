// Tour 16 (owner, 2026-11-18): numbers in Effects and Motion are a slider and a typed value. A
// drag shows each value on the Canvas and writes once when let go; a wrong value writes nothing.
import { expect, test } from '@playwright/test';

import { Bug, Tour } from './support/tour.ts';

test('16 sliders in Effects and Motion', async ({ page }) => {
  test.setTimeout(4 * 60_000);
  const tour = await Tour.open(page, 'projects/vite8-react19-ts', '16-number-sliders');
  const h1 = tour.canvas().locator('h1').first();
  const code = async () => [...(await tour.files())].map(([, c]) => c).join('\n');
  const h1Tag = async () => /<h1[^>]*>/.exec(await code())?.[0] ?? '';
  try {
    await tour.selectLayer(/^h1\b/);
    for (const id of ['effects', 'motion']) {
      const g = page.getByTestId(`inspector-group-${id}`);
      if ((await g.getAttribute('aria-expanded')) === 'false') await g.click();
    }

    await tour.step('Kéo thanh Xoay bằng chuột', async ({ note }) => {
      const slider = page.getByTestId('effect-field-rotate-slider');
      await slider.scrollIntoViewIfNeeded();
      const box = (await slider.boundingBox()) ?? undefined;
      if (box === undefined) throw new Bug('Không thấy thanh Xoay');
      const before = await tour.files();
      const y = box.y + box.height / 2;
      await page.mouse.move(box.x + box.width / 2, y);
      await page.mouse.down();
      await page.mouse.move(box.x + box.width * 0.56, y, { steps: 5 });
      const midDrag = await h1.evaluate((el) => getComputedStyle(el).transform);
      const unchanged = (await code()) === [...before].map(([, c]) => c).join('\n');
      note(
        `Lúc đang kéo: Canvas transform = ${midDrag}; file ${unchanged ? 'chưa đổi' : 'ĐÃ ĐỔI'}`,
      );
      if (!unchanged) throw new Bug('Đang kéo đã ghi file');
      if (midDrag === 'none') throw new Bug('Đang kéo mà Canvas không đổi');
      await page.mouse.up();
      await tour.waitChange(before);
      await page.waitForTimeout(3500);
      const tag = await h1Tag();
      note(`Thả chuột: ${tag}`);
      note(`Ô số: ${await page.getByTestId('effect-field-rotate-input').inputValue()}°`);
      note(
        `Canvas sau khi ghi: rotate = ${await h1.evaluate((el) => getComputedStyle(el).rotate)}`,
      );
      if ((tag.match(/rotate-/g) ?? []).length !== 1) throw new Bug('Không có đúng 1 class rotate');
    });

    await tour.step('Gõ sai rồi gõ đúng vào ô Thời lượng', async ({ note }) => {
      const input = page.getByTestId('motion-duration-input');
      await input.scrollIntoViewIfNeeded();
      const before = await code();
      await input.fill('12px');
      note(`Gõ "12px": ${await page.getByTestId('motion-duration-error').innerText()}`);
      await input.fill('20000');
      note(`Gõ "20000": ${await page.getByTestId('motion-duration-error').innerText()}`);
      await input.press('Enter');
      await input.blur();
      await page.waitForTimeout(800);
      if ((await code()) !== before) throw new Bug('Giá trị sai vẫn ghi vào file');
      const files = await tour.files();
      await input.fill('450');
      await input.press('Enter');
      await tour.waitChange(files);
      note(`Gõ "450" + Enter: ${await h1Tag()}`);
      if (!(await h1Tag()).includes('duration-450')) throw new Bug('Không ghi duration-450');
    });

    await tour.step('Hiện dần: gõ độ trễ 150, ô đọc lại đúng', async ({ note }) => {
      const before = await tour.files();
      await page.getByTestId('motion-reveal-toggle').click();
      await tour.waitChange(before);
      await page.waitForTimeout(2000);
      const files = await tour.files();
      const delay = page.getByTestId('motion-reveal-delay-input');
      await delay.fill('150');
      await delay.press('Enter');
      await tour.waitChange(files);
      await page.waitForTimeout(2000);
      note(/<Reveal[^>]*>/.exec(await code())?.[0] ?? '');
      note(`Ô trễ đọc lại: ${await delay.inputValue()}ms`);
      await expect(delay).toHaveValue('150');
      await page.getByTestId('motion-reveal-delay').scrollIntoViewIfNeeded();
    });

    await tour.step('Ảnh nhóm Hiệu ứng', async () => {
      await page.getByTestId('effect-field-rotate').scrollIntoViewIfNeeded();
    });
  } finally {
    await tour.close();
  }
});
