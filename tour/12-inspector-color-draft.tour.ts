// Tour 12 (the owner's report, 2026-11-18): in a draft, a palette colour picked in the Inspector
// was written but did not show, the element lost its selection, blinked, and the Inspector
// scrolled to the top. Same steps: a named-export draft, the colour picked from the palette.
import { mkdir, rm, writeFile } from 'node:fs/promises';
import { join, relative } from 'node:path';

import { expect, type Page, test } from '@playwright/test';

import { Tour } from './support/tour.ts';

const DRAFT = 'src/drafts/BanNhap1.tsx';
const CODE = `export function BanNhap1() {
  return <div className="min-h-screen bg-white p-8">
    <section className="w-full max-w-md p-8 border rounded-lg">
      <h1 className="text-2xl font-bold">Đăng nhập</h1>
    </section>
  </div>;
}
`;

test('12 a palette colour picked in a draft', async ({ page }) => {
  test.setTimeout(3 * 60_000);
  const tour = await Tour.open(
    page,
    'projects/vite8-react19-ts',
    '12-inspector-color',
    async (r) => {
      await mkdir(join(r, 'src/drafts'), { recursive: true });
      await writeFile(join(r, DRAFT), CODE);
    },
  );
  const frame = tour.canvas();
  const section = frame.locator('section');
  try {
    await tour.openPanel('drafts');
    await page.getByTestId(`draft-open-${DRAFT}`).click();
    await expect(frame.getByText('Đăng nhập')).toBeVisible({ timeout: 20_000 });
    await tour.selectLayer(/section w-full/);
    const closed = page.locator('[data-testid^="inspector-group-"][aria-expanded="false"]');
    while ((await closed.count()) > 0) await closed.first().click();
    await expect(page.getByTestId('color-field-backgroundColor')).toBeVisible({ timeout: 10_000 });

    await tour.step('Đổi màu nền sang red-600 bằng bảng màu', async ({ note }) => {
      await section.evaluate(() => {
        Reflect.set(window, '__kcMark', 'still-here');
      });
      const before = await tour.files();
      await page.getByTestId('color-field-backgroundColor').click();
      await page.getByTestId('color-option-palette-red-600').click();
      await tour.waitChange(before);
      await page.waitForTimeout(2500);
      const line = (await tour.file(DRAFT)).split('\n').find((l) => l.includes('<section'));
      note(`File: ${line?.trim() ?? ''}`);
      note(`Màu nền thật: ${await section.evaluate((el) => getComputedStyle(el).backgroundColor)}`);
      const mark = await section.evaluate(() => String(Reflect.get(window, '__kcMark')));
      note(`Trang có tải lại toàn bộ: ${mark === 'still-here' ? 'không' : 'có'}`);
      const selected = await page.getByTestId('color-field-backgroundColor').isVisible();
      note(`Còn chọn section: ${selected ? 'còn' : 'mất'}`);
    });
  } finally {
    await tour.close();
  }
});

// The same steps on a copy of the owner's own project (his node_modules are linked, nothing of
// his is written): his draft as it is on disk.
test('12b the same on a copy of Test UI', async ({ page }) => {
  test.setTimeout(3 * 60_000);
  const owner = relative(join(process.cwd(), 'fixtures'), 'D:/Study/Test UI');
  // The copy carries the lock of the KumiCraft the owner has open on his project: not ours.
  const tour = await Tour.open(page, owner, '12b-inspector-color-testui', (root) =>
    rm(join(root, '.kumicraft', 'lock'), { force: true }),
  );
  const frame = tour.canvas();
  const card = frame.locator('section').first();
  try {
    await tour.openPanel('drafts');
    await page.getByTestId(`draft-open-${DRAFT}`).click();
    await expect(frame.getByText('Đăng nhập').first()).toBeVisible({ timeout: 30_000 });
    await tour.selectLayer(/section w-full/);
    const closed = page.locator('[data-testid^="inspector-group-"][aria-expanded="false"]');
    while ((await closed.count()) > 0) await closed.first().click();
    await tour.step('Màu nền có sẵn trong file lúc mở', async ({ note }) => {
      note(`Màu nền thật: ${await card.evaluate((el) => getComputedStyle(el).backgroundColor)}`);
    });
    await tour.step('Đổi màu nền sang teal-700 (dự án chưa dùng)', async ({ note }) => {
      await card.evaluate(() => {
        Reflect.set(window, '__kcMark', 'still-here');
      });
      const before = await tour.files();
      await page.getByTestId('color-field-backgroundColor').click();
      await page.getByTestId('color-option-palette-teal-700').click();
      await tour.waitChange(before);
      await page.waitForTimeout(2500);
      const line = (await tour.file(DRAFT)).split('\n').find((l) => l.includes('max-w-md'));
      note(`File: ${line?.trim() ?? ''}`);
      note(`Màu nền thật: ${await card.evaluate((el) => getComputedStyle(el).backgroundColor)}`);
      const mark = await card.evaluate(() => String(Reflect.get(window, '__kcMark')));
      note(`Trang có tải lại toàn bộ: ${mark === 'still-here' ? 'không' : 'có'}`);
      const selected = await page.getByTestId('color-field-backgroundColor').isVisible();
      note(`Còn chọn khung: ${selected ? 'còn' : 'mất'}`);
    });
  } finally {
    await tour.close();
  }
});

// A draft created from the Drafts panel while the Canvas runs (the file did not exist when the
// project's dev server started), then a palette colour picked in the Inspector.
test('12c a draft created while the Canvas runs', async ({ page }) => {
  test.setTimeout(3 * 60_000);
  const tour = await Tour.open(page, 'projects/vite8-react19-ts', '12c-new-draft-color');
  const frame = tour.canvas();
  try {
    await tour.openPanel('drafts');
    await page.getByTestId('drafts-new-btn').click();
    await page.getByTestId('draft-kind-blank').click();
    await page.getByTestId('draft-create').click();
    await expect(frame.locator('[data-rc-loc]').first()).toBeVisible({ timeout: 20_000 });
    await page.waitForTimeout(1500);
    await tour.openPanel('layers');
    await page.getByRole('treeitem').first().click();
    const closed = page.locator('[data-testid^="inspector-group-"][aria-expanded="false"]');
    while ((await closed.count()) > 0) await closed.first().click();
    await tour.step('Đổi màu nền sang teal-700 bằng bảng màu', async ({ note }) => {
      const root = frame.locator('[data-rc-loc]').first();
      await root.evaluate(() => {
        Reflect.set(window, '__kcMark', 'still-here');
      });
      const before = await tour.files();
      await page.getByTestId('color-field-backgroundColor').click();
      await page.getByTestId('color-option-palette-teal-700').click();
      await tour.waitChange(before);
      await page.waitForTimeout(2500);
      note(`Màu nền thật: ${await root.evaluate((el) => getComputedStyle(el).backgroundColor)}`);
      const mark = await root.evaluate(() => String(Reflect.get(window, '__kcMark')));
      note(`Trang có tải lại toàn bộ: ${mark === 'still-here' ? 'không' : 'có'}`);
      const selected = await page.getByTestId('color-field-backgroundColor').isVisible();
      note(`Còn chọn: ${selected ? 'còn' : 'mất'}`);
    });
  } finally {
    await tour.close();
  }
});

// The owner's steps: a new draft, the login screen from the Library, the card clicked on the
// Canvas, its background picked from the palette; then a second colour without picking again.
for (const pickOn of ['layers', 'canvas'] as const) {
  test(`12d new draft, login block, colour picked twice (${pickOn})`, async ({ page }) => {
    await loginColorFlow(page, pickOn);
  });
}

async function loginColorFlow(page: Page, pickOn: 'layers' | 'canvas') {
  test.setTimeout(3 * 60_000);
  const tour = await Tour.open(page, 'projects/vite8-react19-ts', `12d-login-color-${pickOn}`);
  const frame = tour.canvas();
  const card = frame.locator('section').first();
  const field = page.getByTestId('color-field-backgroundColor');
  try {
    await tour.openPanel('drafts');
    await page.getByTestId('drafts-new-btn').click();
    await page.getByTestId('draft-kind-blank').click();
    await page.getByTestId('draft-create').click();
    await expect(frame.locator('[data-rc-loc]').first()).toBeVisible({ timeout: 20_000 });
    await page.waitForTimeout(1000);
    await page
      .locator('iframe[data-testid="canvas-iframe"]')
      .first()
      .click({ position: { x: 300, y: 300 } });
    await tour.openPanel('library');
    await page.getByTestId('library-add-screen.login').click();
    await expect(frame.getByText('Đăng nhập').first()).toBeVisible({ timeout: 15_000 });
    await page.keyboard.press('Escape');
    if (pickOn === 'layers') {
      await tour.selectLayer(/^section\b|section /);
    } else {
      // As the owner does: click the card on the Canvas, each click one level in, until the
      // Inspector shows the <section>.
      const panel = page.getByTestId('inspector-panel');
      for (let i = 0; i < 6 && !(await panel.innerText()).includes('<section>'); i++) {
        await card.click({ position: { x: 12, y: 12 } });
        await page.waitForTimeout(500);
      }
    }
    const closed = page.locator('[data-testid^="inspector-group-"][aria-expanded="false"]');
    while ((await closed.count()) > 0) await closed.first().click();
    for (const color of ['red-600', 'teal-700']) {
      await tour.step(`Đổi màu nền sang ${color}`, async ({ note }) => {
        await card.evaluate(() => {
          Reflect.set(window, '__kcMark', 'still-here');
        });
        const scroll = await page.getByTestId('inspector-panel').evaluate((el) => {
          const box = el.closest('[class*="overflow"]') ?? el;
          return box.scrollTop;
        });
        const before = await tour.files();
        await field.click();
        await page.getByTestId(`color-option-palette-${color}`).click();
        await tour.waitChange(before);
        await page.waitForTimeout(2500);
        note(`Màu nền thật: ${await card.evaluate((el) => getComputedStyle(el).backgroundColor)}`);
        const mark = await card.evaluate(() => String(Reflect.get(window, '__kcMark')));
        note(`Trang có tải lại toàn bộ: ${mark === 'still-here' ? 'không' : 'có'}`);
        note(`Còn chọn: ${(await field.isVisible()) ? 'còn' : 'mất'}`);
        const after = await page.getByTestId('inspector-panel').evaluate((el) => {
          const box = el.closest('[class*="overflow"]') ?? el;
          return box.scrollTop;
        });
        note(`Cuộn Inspector: ${String(scroll)} → ${String(after)}`);
      });
    }
  } finally {
    await tour.close();
  }
}
