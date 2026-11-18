// Tour 13 (the owner's report, 2026-11-18): the motion effect is one select; "None" takes it off.
import { expect, test } from '@playwright/test';

import { Bug, Tour } from './support/tour.ts';

test('13 motion effect on, then off', async ({ page }) => {
  test.setTimeout(3 * 60_000);
  const tour = await Tour.open(page, 'projects/vite8-react19-ts', '13-motion-effect');
  const select = page.getByTestId('motion-preset-select');
  try {
    await tour.selectLayer(/^h1\b/);
    const motion = page.getByTestId('inspector-group-motion');
    if ((await motion.getAttribute('aria-expanded')) === 'false') await motion.click();

    await tour.step('Chọn "Nổi lên khi rê"', async ({ note }) => {
      const before = await tour.files();
      await select.selectOption('hover-lift');
      const after = await tour.waitChange(before);
      note(
        [...after]
          .map(([, c]) => c)
          .join('')
          .match(/className="[^"]*hover:[^"]*"/)?.[0] ?? '',
      );
      await expect(select).toHaveValue('hover-lift');
      await select.evaluate((el) => {
        el.scrollIntoView({ block: 'center' });
      });
    });

    await tour.step('Chọn "Không có": gỡ hết, kể cả hover', async ({ note }) => {
      const before = await tour.files();
      await select.selectOption('none');
      const after = await tour.waitChange(before);
      const code = [...after].map(([, c]) => c).join('');
      note(code.match(/<h1[^>]*>/)?.[0] ?? '');
      if (/hover:|transition-|duration-/.test(code.match(/<h1[^>]*>/)?.[0] ?? '')) {
        throw new Bug('Còn class chuyển động');
      }
      await expect(select).toHaveValue('none');
      await select.evaluate((el) => {
        el.scrollIntoView({ block: 'center' });
      });
    });
  } finally {
    await tour.close();
  }
});
