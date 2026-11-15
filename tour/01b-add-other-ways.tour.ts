// Tour 01b: the other ways to add something to a Tailwind page — Library styles and variants, icons,
// images, the draw tools, dragging from the Library and the Components panel with the mouse,
// "create component", and blocks added into a free draft and a blank one.
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import { expect, type Locator, type Page, test } from '@playwright/test';

import { Bug, diffFiles, Tour } from './support/tour.ts';

const PNG_1PX =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

/** Presses on `from` and lets go over `to` in small moves, as a hand does. */
async function dragMouse(page: Page, from: Locator, to: { x: number; y: number }): Promise<void> {
  const box = await from.boundingBox();
  if (!box) throw new Error('Không thấy thứ cần kéo');
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(to.x, to.y, { steps: 20 });
  await page.mouse.move(to.x + 2, to.y + 2, { steps: 3 });
  await page.mouse.up();
}

/** A page point inside the Canvas, in px from its left/top (or right/bottom when negative). */
async function canvasPoint(page: Page, dx: number, dy: number): Promise<{ x: number; y: number }> {
  const box = await page.locator('iframe[data-testid="canvas-iframe"]').first().boundingBox();
  if (!box) throw new Error('Không thấy Canvas');
  return {
    x: box.x + (dx < 0 ? box.width + dx : dx),
    y: box.y + (dy < 0 ? box.height + dy : dy),
  };
}

/** Closes the image picker a failed step left open, so the next step can click. */
async function closePicker(page: Page): Promise<void> {
  const cancel = page.locator('[data-testid="image-picker-cancel"]:visible').first();
  if (await cancel.isVisible()) await cancel.click();
}

async function addWithStep(tour: Tour, name: string, add: () => Promise<void>): Promise<void> {
  await tour.step(name, async ({ note }) => {
    const before = await tour.files();
    await add();
    const after = await tour.waitChange(before);
    note(diffFiles(before, after, 6).join('\n'));
    await tour.undoTo(before);
  });
}

test('01b Add: styles, variants, icons, images, draw tools, drag, components, drafts', async ({
  page,
}) => {
  test.setTimeout(6 * 60_000);
  const tour = await Tour.open(page, 'projects/vite8-react19-ts', '01b-add-other-ways');
  // The fixture has no picture in public/: give the image picker one to offer.
  await mkdir(join(tour.root, 'public'), { recursive: true });
  await writeFile(join(tour.root, 'public', 'tour-anh.png'), Buffer.from(PNG_1PX, 'base64'));
  try {
    // Library styles: the same card in each style; glass must stay see-through.
    for (const style of ['default', 'minimal', 'soft', 'glass', 'bold']) {
      await tour.step(`Phong cách "${style}": thêm thẻ (composite.card)`, async ({ note }) => {
        await tour.selectLayer(/\bmain\b/);
        await tour.openPanel('library');
        await page.getByTestId('library-style-select').selectOption(style);
        const before = await tour.files();
        await page.getByTestId('library-add-composite.card').click();
        const after = await tour.waitChange(before);
        const diff = diffFiles(before, after, 6);
        note(diff.join('\n'));
        if (style === 'glass' && !diff.join(' ').includes('backdrop-blur')) {
          throw new Bug('Phong cách kính mờ mà khối không có backdrop-blur');
        }
        await tour.undoTo(before);
      });
    }
    await page.getByTestId('library-style-select').selectOption('default');

    // Variants of the button: each one in turn.
    await tour.selectLayer(/\bmain\b/);
    await tour.openPanel('library');
    await page.getByTestId('library-variant-form.button').click();
    const variants = await page
      .locator('[data-testid^="library-variant-form.button-"]')
      .evaluateAll((els) => els.map((el) => el.getAttribute('data-testid') ?? ''));
    await page.keyboard.press('Escape');
    for (const variant of variants) {
      await addWithStep(
        tour,
        `Biến thể nút: ${variant.replace('library-variant-', '')}`,
        async () => {
          await tour.selectLayer(/\bmain\b/);
          await tour.openPanel('library');
          await page.getByTestId('library-variant-form.button').click();
          await page.getByTestId(variant).click();
          await page.getByTestId('library-add-form.button').click();
        },
      );
    }

    await addWithStep(tour, 'Icon: tìm "tim" rồi chèn trái tim', async () => {
      await tour.selectLayer(/\bmain\b/);
      await tour.openPanel('library');
      await page.getByTestId('library-open-icons').click();
      await page.getByTestId('icon-search').fill('tim');
      await page.getByTestId('icon-item-heart').click();
    });

    await addWithStep(tour, 'Ảnh: nút Chèn ảnh trong Library, chọn ảnh đầu tiên', async () => {
      await tour.selectLayer(/\bmain\b/);
      await tour.openPanel('library');
      await page.getByTestId('library-insert-image').click();
      await page.locator('[data-testid="image-picker-item"]:visible').first().click();
      await page.locator('[data-testid="image-picker-alt"]:visible').fill('Ảnh thử tour');
      await page.locator('[data-testid="image-picker-insert"]:visible').click();
    });

    // Draw tools, on the empty right side of the page.
    await addWithStep(tour, 'Công cụ Khung (F): vẽ một khung trên Canvas', async () => {
      await page.getByTestId('draw-tool-frame').click();
      // A hand takes a moment before drawing; the tool reaches the Canvas by message.
      await page.waitForTimeout(300);
      const from = await canvasPoint(page, -300, -200);
      await page.mouse.move(from.x, from.y);
      await page.mouse.down();
      await page.mouse.move(from.x + 180, from.y + 120, { steps: 15 });
      await page.mouse.up();
    });
    await tour.step(
      'Công cụ Chữ (T): bấm lên Canvas, chờ ô chữ mở, gõ chữ',
      async ({ note }) => {
        const before = await tour.files();
        await page.getByTestId('draw-tool-text').click();
        // A hand takes a moment before drawing; the tool reaches the Canvas by message.
        await page.waitForTimeout(300);
        const at = await canvasPoint(page, -200, -60);
        await page.mouse.click(at.x, at.y);
        // A user types once the new text shows as editable, as the double-click edit does.
        const editing = tour
          .canvas()
          .locator('[contenteditable="true"], [contenteditable="plaintext-only"]');
        if (!(await tour.appears(editing.first(), 5_000))) {
          throw new Bug('Đoạn chữ mới không mở sẵn để gõ');
        }
        await page.keyboard.type('Chữ thử tour');
        await page.keyboard.press('Enter');
        const after = await tour.waitChange(before);
        note(diffFiles(before, after, 4).join('\n'));
        const end = Date.now() + 5_000;
        while (
          Date.now() < end &&
          !(await tour.file('src/pages/Home.tsx')).includes('Chữ thử tour')
        ) {
          await page.waitForTimeout(200);
        }
        if (!(await tour.file('src/pages/Home.tsx')).includes('Chữ thử tour')) {
          throw new Bug('Chữ gõ vào đoạn mới không được lưu');
        }
      },
      { restore: true },
    );
    await addWithStep(tour, 'Công cụ Ảnh (I): vẽ khung ảnh rồi chọn ảnh', async () => {
      await page.getByTestId('draw-tool-image').click();
      // A hand takes a moment before drawing; the tool reaches the Canvas by message.
      await page.waitForTimeout(300);
      const from = await canvasPoint(page, -300, -200);
      await page.mouse.move(from.x, from.y);
      await page.mouse.down();
      await page.mouse.move(from.x + 160, from.y + 100, { steps: 15 });
      await page.mouse.up();
      await page.locator('[data-testid="image-picker-item"]:visible').first().click();
      await page.locator('[data-testid="image-picker-alt"]:visible').fill('Ảnh thử tour');
      await page.locator('[data-testid="image-picker-insert"]:visible').click();
    });
    await closePicker(page);
    await page.getByTestId('draw-tool-select').click();

    // Drag with the mouse from the panels onto the Canvas, above the button.
    await addWithStep(tour, 'Kéo khối "Tiêu đề" từ Library thả lên Canvas', async () => {
      await tour.openPanel('library');
      const target = tour.canvas().getByText('Mua ngay');
      const box = await target.boundingBox();
      if (!box) throw new Error('Không thấy nút Mua ngay');
      await dragMouse(page, page.getByTestId('library-block-content.heading'), {
        x: box.x + 10,
        y: box.y - 4,
      });
    });
    await addWithStep(tour, 'Components: nút + chèn Card vào main', async () => {
      await tour.selectLayer(/\bmain\b/);
      await tour.openPanel('components');
      await page.getByTestId('component-add-Card').click();
    });
    await addWithStep(tour, 'Components: kéo Card thả lên Canvas', async () => {
      await tour.openPanel('components');
      const target = tour.canvas().getByText('Mua ngay');
      const box = await target.boundingBox();
      if (!box) throw new Error('Không thấy nút Mua ngay');
      await dragMouse(page, page.getByTestId('component-item-Card'), {
        x: box.x + 10,
        y: box.y - 4,
      });
    });

    await tour.step('Tạo component từ danh sách ul, rồi Hoàn tác', async ({ note }) => {
      await tour.selectLayer(/\bul space-y-2\b/);
      const before = await tour.files();
      await page.getByTestId('structure-extract').click();
      await page.getByTestId('extract-name').fill('DanhSachTour');
      await page.getByTestId('extract-submit').click();
      const after = await tour.waitChange(before);
      const diff = diffFiles(before, after, 6);
      note(diff.join('\n'));
      if (!diff.some((l) => l.startsWith('NEW') && l.includes('DanhSachTour'))) {
        throw new Bug('Không thấy file component mới DanhSachTour');
      }
      await tour.undoTo(before);
    });

    // A free draft: every block lands at a free position and can be picked on the Canvas.
    await tour.step('Bản nháp tự do: tạo mới', async () => {
      await tour.openPanel('drafts');
      await page.getByTestId('drafts-new-btn').click();
      await page.getByTestId('draft-kind-free').click();
      await page.getByTestId('draft-create').click();
      await expect
        .poll(() => tour.file('src/drafts/BanNhap1.tsx'), { timeout: 10_000 })
        .toContain('data-rc-free');
    });
    for (const id of ['content.heading', 'layout.grid', 'form.button', 'landing.pricing']) {
      await tour.step(`Bản nháp tự do: thêm ${id}, khối có vị trí tự do`, async ({ note }) => {
        const root = tour.canvas().locator('[data-rc-loc*="drafts/BanNhap1"]').first();
        const box = await root.boundingBox();
        if (!box) throw new Error('Không thấy khung bản nháp');
        await page.mouse.click(box.x + 8, box.y + box.height - 8);
        await tour.openPanel('library');
        const before = await tour.files();
        await page.getByTestId(`library-add-${id}`).click();
        const after = await tour.waitChange(before);
        const added = diffFiles(before, after, 3);
        note(added.join('\n'));
        if (!/absolute left-\S+ top-\S+/.test(added.join(' '))) {
          throw new Bug('Khối thêm vào khung tự do không có vị trí (absolute left/top)');
        }
      });
    }
    await addWithStep(tour, 'Bản nháp tự do: vẽ khung bằng công cụ Khung', async () => {
      await page.getByTestId('draw-tool-frame').click();
      // A hand takes a moment before drawing; the tool reaches the Canvas by message.
      await page.waitForTimeout(300);
      const from = await canvasPoint(page, -300, 380);
      await page.mouse.move(from.x, from.y);
      await page.mouse.down();
      await page.mouse.move(from.x + 140, from.y + 90, { steps: 15 });
      await page.mouse.up();
    });
    await closePicker(page);
    await page.getByTestId('draw-tool-select').click();

    await tour.step('Bản nháp trống: tạo mới rồi thêm thẻ', async ({ note }) => {
      await tour.openPanel('drafts');
      await page.getByTestId('drafts-new-btn').click();
      await page.getByTestId('draft-kind-blank').click();
      await page.getByTestId('draft-create').click();
      await expect
        .poll(() => tour.file('src/drafts/BanNhap2.tsx'), { timeout: 10_000 })
        .not.toBe('');
      const root = tour.canvas().locator('[data-rc-loc*="drafts/BanNhap2"]').first();
      await root.click({ position: { x: 8, y: 8 } });
      await tour.openPanel('library');
      const before = await tour.files();
      await page.getByTestId('library-add-composite.card').click();
      const after = await tour.waitChange(before);
      note(diffFiles(before, after, 4).join('\n'));
    });
  } finally {
    await tour.close();
  }
});
