// Tour 14 (the owner's report, 2026-11-18): in a free draft with the login screen from the Library,
// turning "Hiện dần khi cuộn tới" on lost the selection; removing the login screen afterwards left
// an empty `<Reveal effect="fade">` (a type error in the code).
import { expect, test } from '@playwright/test';

import { Bug, Tour } from './support/tour.ts';

test('14 reveal on a login screen in a free draft, then the screen removed', async ({ page }) => {
  test.setTimeout(4 * 60_000);
  const tour = await Tour.open(page, 'projects/vite8-react19-ts', '14-reveal-login');
  const draftCode = async () => {
    for (const [file, code] of await tour.files()) {
      if (file.startsWith('src/drafts/')) return code;
    }
    return '';
  };
  const frame = tour.canvas();
  const toggle = page.getByTestId('motion-reveal-toggle');
  try {
    await tour.step('Bản nháp tự do + màn hình đăng nhập', async ({ note }) => {
      await tour.openPanel('drafts');
      await page.getByTestId('drafts-new-btn').click();
      await page.getByTestId('draft-kind-free').click();
      await page.getByTestId('draft-create').click();
      await expect.poll(draftCode, { timeout: 15_000 }).toContain('data-rc-free');
      await page
        .locator('iframe[data-testid="canvas-iframe"]')
        .first()
        .click({ position: { x: 200, y: 200 } });
      await page.waitForTimeout(400);
      await tour.openPanel('library');
      await page.getByTestId('library-add-screen.login').click();
      await expect(frame.getByText('Đăng nhập').first()).toBeVisible({ timeout: 15_000 });
      note(await draftCode());
    });

    await tour.step('Bật "Hiện dần khi cuộn tới"', async ({ note }) => {
      await tour.openPanel('layers');
      await page.getByRole('treeitem').nth(1).click();
      const motion = page.getByTestId('inspector-group-motion');
      if ((await motion.getAttribute('aria-expanded')) === 'false') await motion.click();
      const header = await page.getByTestId('inspector-panel').innerText();
      note(`Đang chọn: ${header.split('\n').slice(0, 2).join(' ')}`);
      const before = await tour.files();
      await toggle.click();
      await tour.waitChange(before);
      await page.waitForTimeout(2500);
      note(await draftCode());
      const kept = await toggle.isVisible();
      note(`Còn chọn: ${kept ? 'còn' : 'mất'}`);
      if (!kept) throw new Bug('Bật Hiện dần làm mất chọn');
      await expect(toggle).toHaveText(/Bật|On/);
    });

    await tour.step('Tắt rồi bật lại: vẫn giữ chọn', async ({ note }) => {
      for (const label of ['tắt', 'bật']) {
        const before = await tour.files();
        await toggle.click();
        await tour.waitChange(before);
        await page.waitForTimeout(1500);
        const kept = await toggle.isVisible();
        note(`Sau khi ${label}: ${kept ? 'còn chọn' : 'mất chọn'}`);
        if (!kept) throw new Bug(`${label} Hiện dần làm mất chọn`);
      }
    });

    await tour.step('Gỡ màn hình đăng nhập khỏi trang', async ({ note }) => {
      const before = await tour.files();
      await page.keyboard.press('Delete');
      await tour.waitChange(before);
      const code = await draftCode();
      note(code);
      if (code.includes('<Reveal')) throw new Bug('Còn sót <Reveal>');
      if (code.includes('import { Reveal }')) throw new Bug('Còn import Reveal');
    });
  } finally {
    await tour.close();
  }
});
