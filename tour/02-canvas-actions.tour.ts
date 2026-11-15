// Tour 02: what a user does with the mouse and keys on the Canvas of a Tailwind page — select, go to
// the parent, drag to reorder, resize with the handles, edit text, bold part of it, duplicate,
// delete, move up and down, wrap and unwrap, copy and paste, a chain of Undo and Redo; then inside
// a free frame: drag, snap, resize from two corners, arrow keys, X/Y fields, align, the snap
// switch. Every edit is checked in the file and undone back to the exact text it started from.
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import { expect, test } from '@playwright/test';

import { boxOf, drag, edit, lineWith } from './support/canvas.ts';
import { CANVAS_PAGE as PAGE } from './support/pages.ts';
import { Bug, diffFiles, Tour } from './support/tour.ts';

const HOME = 'src/pages/Home.tsx';
/** Every edit step ends back at its start, even when it failed half-way. */
const RESTORE = { restore: true } as const;

test('02 Canvas: select, drag, resize, text, structure, clipboard, undo chain, free frame', async ({
  page,
}) => {
  test.setTimeout(6 * 60_000);
  const tour = await Tour.open(page, 'projects/vite8-react19-ts', '02-canvas-actions', (root) =>
    writeFile(join(root, HOME), PAGE),
  );
  const canvas = tour.canvas();
  const inspector = page.getByTestId('inspector-panel');
  /** Clicks the element and waits until the Inspector shows it, as a user looks before acting. */
  const pick = async (text: string) => {
    // The element's opening tag is on the line with its text, or the line above.
    const lines = (await tour.file(HOME)).split(/\r?\n/);
    const i = lines.findIndex((l) => l.includes(text));
    const at = `Home.tsx:${String((lines[i] ?? '').includes('<') ? i + 1 : i)}:`;
    // A first click picks the outer group; each slow click goes one level in, as in Figma.
    for (let n = 0; n < 4; n += 1) {
      await canvas.getByText(text, { exact: true }).click();
      if (await tour.appears(inspector.getByText(at), 1_200)) break;
      await page.waitForTimeout(300);
    }
    await expect(inspector).toContainText(at);
    await page.waitForTimeout(300);
  };
  /** The ⠿ handle drawn at the top right of the selected element: a flow drag starts there. */
  const dragHandle = async (text: string) => {
    const b = await boxOf(canvas.getByText(text, { exact: true }));
    const frame = await page.locator('iframe[data-testid="canvas-iframe"]').first().boundingBox();
    const inner = await canvas.locator('html').evaluate((html) => html.clientWidth);
    const scale = frame ? frame.width / inner : 1;
    return { x: b.x + b.w - 6 * scale, y: b.y + 6 * scale };
  };
  try {
    await expect(canvas.getByText('Hộp A')).toBeVisible({ timeout: 20_000 });

    // --- Selecting ---
    await tour.step('Bấm tiêu đề trên Canvas: Inspector chọn h1', async () => {
      await pick('Tiêu đề chính');
      await expect(inspector).toContainText('<h1>');
    });
    await tour.step('Esc: chọn lên phần tử cha (div)', async () => {
      await page.keyboard.press('Escape');
      await expect(inspector).toContainText('<div>');
    });
    await tour.step('Bấm dòng trong Layers rồi đường dẫn phần tử: chọn đúng', async () => {
      await tour.selectLayer(/^button\b/);
      await expect(inspector).toContainText('<button>');
      await inspector.getByTestId('element-path-item').first().click();
      await expect(inspector).toContainText('<main>');
    });

    // --- Flow page ---
    await edit(
      tour,
      'Kéo tiêu đề xuống dưới nút bấm (đổi thứ tự)',
      async () => {
        await pick('Tiêu đề chính');
        const h1 = await boxOf(canvas.getByText('Tiêu đề chính'));
        const btn = await boxOf(canvas.getByText('Nút bấm'));
        const handle = await dragHandle('Tiêu đề chính');
        await drag(page, handle, { x: h1.x + 30 - handle.x, y: btn.y + btn.h - 2 - handle.y });
      },
      async () => {
        const code = await tour.file(HOME);
        if (code.indexOf('Tiêu đề chính') < code.indexOf('Nút bấm')) {
          throw new Bug('Kéo xong mà tiêu đề vẫn nằm trên nút bấm');
        }
      },
    );
    await edit(
      tour,
      'Kéo tay nắm góc dưới phải của Ô vàng (+60, +30)',
      async () => {
        await pick('Ô vàng');
        const b = await boxOf(canvas.getByText('Ô vàng'));
        await drag(page, { x: b.x + b.w - 1, y: b.y + b.h - 1 }, { x: 60, y: 30 });
      },
      async ({ note }) => {
        const line = await lineWith(tour, HOME, 'Ô vàng');
        note(`Dòng mới: ${line}`);
        if (/\bw-40\b/.test(line) && /\bh-20\b/.test(line)) {
          throw new Bug('Kéo tay nắm mà kích thước không đổi');
        }
      },
    );
    await edit(
      tour,
      'Kéo tay nắm cạnh phải của Ô xanh: chỉ đổi chiều rộng',
      async () => {
        await pick('Ô xanh');
        const b = await boxOf(canvas.getByText('Ô xanh'));
        await drag(page, { x: b.x + b.w - 1, y: b.y + b.h / 2 }, { x: 50, y: 0 });
      },
      async () => {
        const line = await lineWith(tour, HOME, 'Ô xanh');
        if (!/\bh-20\b/.test(line)) throw new Bug(`Kéo cạnh phải mà chiều cao đổi: ${line}`);
        if (/\bw-40\b/.test(line)) throw new Bug('Kéo cạnh phải mà chiều rộng không đổi');
      },
    );
    await edit(
      tour,
      'Nhấp đúp đoạn văn, gõ chữ mới, Enter',
      async () => {
        await pick('Đoạn mô tả ngắn gọn.');
        const p = canvas.getByText('Đoạn mô tả ngắn gọn.');
        await p.dblclick();
        await expect(p).toHaveAttribute('contenteditable', /plaintext-only|true/);
        await page.keyboard.press('End');
        await page.keyboard.type(' đã sửa');
        await page.keyboard.press('Enter');
      },
      async () => {
        if (!(await tour.file(HOME)).includes('ngắn gọn. đã sửa')) {
          throw new Bug('Chữ gõ vào không được lưu');
        }
      },
    );
    await edit(
      tour,
      'In đậm 4 chữ đầu bằng thanh chữ',
      async () => {
        await pick('Đoạn mô tả ngắn gọn.');
        const p = canvas.getByText('Đoạn mô tả ngắn gọn.');
        await p.dblclick();
        await expect(p).toHaveAttribute('contenteditable', /plaintext-only|true/);
        await p.evaluate((el) => {
          const text = el.firstChild;
          const win = el.ownerDocument.defaultView;
          if (!text || !win) return;
          const range = el.ownerDocument.createRange();
          range.setStart(text, 0);
          range.setEnd(text, 4);
          win.getSelection()?.removeAllRanges();
          win.getSelection()?.addRange(range);
          el.ownerDocument.dispatchEvent(new Event('selectionchange'));
        });
        await page.getByTestId('inline-text-bold').click();
      },
      async () => {
        if (!/<strong[^>]*>Đoạn<\/strong> mô tả/.test(await tour.file(HOME))) {
          throw new Bug('Chỉ 4 chữ đầu phải được in đậm');
        }
      },
    );
    await page.keyboard.press('Escape');

    await edit(
      tour,
      'Nhân bản nút bấm bằng nút trong Inspector',
      async () => {
        await pick('Nút bấm');
        await page.getByTestId('inspector-duplicate').click();
      },
      async () => {
        const count = ((await tour.file(HOME)).match(/Nút bấm/g) ?? []).length;
        if (count !== 2) throw new Bug(`Có ${String(count)} nút bấm, cần 2`);
      },
    );
    await edit(
      tour,
      'Nhân bản Ô vàng bằng phím Ctrl+D',
      async () => {
        await pick('Ô vàng');
        await page.keyboard.press('Control+d');
      },
      async () => {
        const count = ((await tour.file(HOME)).match(/Ô vàng/g) ?? []).length;
        if (count !== 2) throw new Bug(`Có ${String(count)} Ô vàng, cần 2`);
      },
    );
    await edit(
      tour,
      'Xóa Ô xanh bằng phím Delete',
      async () => {
        await pick('Ô xanh');
        await page.keyboard.press('Delete');
      },
      async () => {
        if ((await tour.file(HOME)).includes('Ô xanh')) throw new Bug('Ô xanh vẫn còn');
      },
    );
    await edit(
      tour,
      'Đưa Ô xanh lên trước Ô vàng (nút lên)',
      async () => {
        await pick('Ô xanh');
        await page.getByTestId('inspector-move-up').click();
      },
      async () => {
        const code = await tour.file(HOME);
        if (code.indexOf('Ô xanh') > code.indexOf('Ô vàng')) throw new Bug('Thứ tự không đổi');
      },
    );
    await tour.step(
      'Bọc nút bấm vào khối hàng, rồi gỡ khối bọc: file về như cũ',
      async () => {
        const start = await tour.files();
        await pick('Nút bấm');
        await page.getByTestId('inspector-wrap').click();
        await page.getByTestId('inspector-wrap-row').click();
        await tour.waitChange(start);
        await expect(inspector).toContainText('<div>');
        const wrapped = await tour.files();
        await page.getByTestId('inspector-unwrap').click();
        await tour.waitChange(wrapped);
        const left = diffFiles(start, await tour.files());
        if (left.length > 0) throw new Bug(`Gỡ khối bọc không trả về như cũ:\n${left.join('\n')}`);
      },
      RESTORE,
    );
    await edit(
      tour,
      'Ctrl+C Ô vàng, chọn Ô xanh, Ctrl+V',
      async () => {
        await pick('Ô vàng');
        await page.keyboard.press('Control+c');
        await pick('Ô xanh');
        await page.keyboard.press('Control+v');
      },
      async () => {
        const count = ((await tour.file(HOME)).match(/Ô vàng/g) ?? []).length;
        if (count !== 2) throw new Bug(`Có ${String(count)} Ô vàng sau khi dán, cần 2`);
      },
    );
    await edit(
      tour,
      'Dán Ô vàng vào khung tự do: có vị trí tự do',
      async () => {
        await pick('Ô vàng');
        await page.keyboard.press('Control+c');
        await tour.selectLayer(/\bsection relative\b/);
        await expect(inspector).toContainText('<section>');
        await page.keyboard.press('Control+v');
      },
      ({ diff }) => {
        if (!/absolute[^"]*left-|left-[^"]*absolute/.test(diff)) {
          throw new Bug('Khối dán vào khung tự do không có vị trí absolute/left/top');
        }
      },
    );

    await tour.step(
      'Chuỗi 3 sửa → Hoàn tác 3 lần → Làm lại 3 lần',
      async () => {
        const start = await tour.files();
        await pick('Nút bấm');
        await page.getByTestId('inspector-duplicate').click();
        const one = await tour.waitChange(start);
        await pick('Ô xanh');
        await page.keyboard.press('Delete');
        const two = await tour.waitChange(one);
        await pick('Ô vàng');
        await page.keyboard.press('Control+d');
        const three = await tour.waitChange(two);
        await tour.undoTo(start, 3);
        for (let i = 0; i < 3; i += 1) await tour.redo();
        const left = diffFiles(three, await tour.files());
        if (left.length > 0) throw new Bug(`Làm lại không ra đúng như trước:\n${left.join('\n')}`);
        await tour.undoTo(start, 3);
      },
      RESTORE,
    );

    // --- Free frame ---
    const boxA = () => boxOf(canvas.getByText('Hộp A'));
    await edit(
      tour,
      'Khung tự do: kéo Hộp A sang phải và xuống',
      async () => {
        await pick('Hộp A');
        const a = await boxA();
        await drag(page, { x: a.x + 10, y: a.y + 5 }, { x: 90, y: 40 });
      },
      async ({ note }) => {
        const line = await lineWith(tour, HOME, 'Hộp A');
        note(`Dòng mới: ${line}`);
        if (line.includes('left-[40px]') || line.includes('top-[40px]')) {
          throw new Bug('Kéo xong mà left/top không đổi');
        }
      },
    );
    await edit(
      tour,
      'Khung tự do: kéo tay nắm góc trên trái của Hộp A',
      async () => {
        await pick('Hộp A');
        const a = await boxA();
        await drag(page, { x: a.x + 1, y: a.y + 1 }, { x: -20, y: -20 });
      },
      async ({ note }) => {
        const line = await lineWith(tour, HOME, 'Hộp A');
        note(`Dòng mới: ${line}`);
        if (line.includes('left-[40px]') || line.includes('w-[200px]')) {
          throw new Bug('Kéo góc trên trái mà vị trí hoặc chiều rộng không đổi');
        }
      },
    );
    await edit(
      tour,
      'Phím → dời 1 ô lưới (8px), Shift+↓ dời 1px',
      async () => {
        await pick('Hộp A');
        await page.keyboard.press('ArrowRight');
        await page.waitForTimeout(400);
        await page.keyboard.press('Shift+ArrowDown');
        await page.waitForTimeout(600);
      },
      async ({ note }) => {
        const line = await lineWith(tour, HOME, 'Hộp A');
        note(`Dòng mới: ${line}`);
        if (!/left-(12|\[48px\])\b/.test(line)) throw new Bug(`Mong left 48px: ${line}`);
        if (!/top-\[41px\]/.test(line)) throw new Bug(`Mong top-[41px]: ${line}`);
      },
    );
    await edit(
      tour,
      'Ô X = 120 trong Inspector',
      async () => {
        await pick('Hộp A');
        const x = page.getByTestId('free-pos-x');
        await x.fill('120');
        await x.press('Enter');
      },
      async () => {
        const line = await lineWith(tour, HOME, 'Hộp A');
        if (!/left-(30|\[120px\])\b/.test(line)) throw new Bug(`Mong left 120px: ${line}`);
      },
    );
    for (const align of ['align-center-x', 'align-bottom']) {
      await edit(
        tour,
        `Căn lề ${align} cho Hộp A`,
        async () => {
          await pick('Hộp A');
          await page.getByTestId(align).first().click();
        },
        async ({ note }) => {
          note(`Dòng mới: ${await lineWith(tour, HOME, 'Hộp A')}`);
        },
      );
    }
    await edit(
      tour,
      'Hút lưới TẮT rồi kéo Hộp A sát cạnh Hộp B: không hút',
      async () => {
        await page.getByTestId('canvas-snap-toggle').click();
        await pick('Hộp A');
        const a = await boxA();
        const b = await boxOf(canvas.getByText('Hộp B'));
        await drag(page, { x: a.x + 10, y: a.y + 5 }, { x: b.x + 3 - a.x, y: 0 });
      },
      async ({ note }) => {
        note(`Dòng mới: ${await lineWith(tour, HOME, 'Hộp A')}`);
        await page.getByTestId('canvas-snap-toggle').click();
      },
    );
    await edit(
      tour,
      'Khung tự do: xóa Hộp B bằng Delete',
      async () => {
        await pick('Hộp B');
        await page.keyboard.press('Delete');
      },
      async () => {
        if ((await tour.file(HOME)).includes('Hộp B')) throw new Bug('Hộp B vẫn còn');
      },
    );

    // Re-check from tour 01: "create component" from a row picked in Layers.
    await tour.step(
      'Tạo component từ khối flex (chọn trong Layers)',
      async ({ note }) => {
        // Give the Layers tree time to catch up with the last Undo, as a user would.
        await page.waitForTimeout(2_000);
        await tour.selectLayer(/\bdiv flex\b/);
        await expect(inspector).toContainText('<div>');
        const before = await tour.files();
        await page.getByTestId('structure-extract').click();
        await page.getByTestId('extract-name').fill('HaiO');
        await page.getByTestId('extract-submit').click();
        const after = await tour.waitChange(before);
        const diff = diffFiles(before, after, 4);
        note(diff.join('\n'));
        if (!diff.some((l) => l.startsWith('NEW'))) throw new Bug('Không có file component mới');
        await tour.undoTo(before);
        const back = await readFile(join(tour.root, HOME), 'utf8');
        if (back !== PAGE) throw new Bug('Hoàn tác không trả trang về như ban đầu');
      },
      RESTORE,
    );
  } finally {
    await tour.close();
  }
});
