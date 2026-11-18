// Tour 15 (the owner's report, 2026-11-18): "Xem thử" in Motion must play what the Inspector set
// on the element (the hover effect, the animation, the reveal), not offer choices of its own.
import { test } from '@playwright/test';

import { Bug, Tour } from './support/tour.ts';

test('15 preview plays the motion the element has', async ({ page }) => {
  test.setTimeout(3 * 60_000);
  const tour = await Tour.open(page, 'projects/vite8-react19-ts', '15-motion-preview');
  const h1 = tour.canvas().locator('h1').first();
  const sample = () =>
    h1.evaluate(async (el) => {
      const seen = new Set<string>();
      for (let i = 0; i < 12; i++) {
        const s = getComputedStyle(el);
        seen.add(`${s.translate}|${s.boxShadow}|${s.opacity}`);
        await new Promise((r) => setTimeout(r, 60));
      }
      return [...seen];
    });
  try {
    await tour.selectLayer(/^h1\b/);
    const motion = page.getByTestId('inspector-group-motion');
    if ((await motion.getAttribute('aria-expanded')) === 'false') await motion.click();

    await tour.step('CSS hover trong Canvas', async ({ note }) => {
      const before = await tour.files();
      await page.getByTestId('motion-preset-select').selectOption('hover-lift');
      await tour.waitChange(before);
      await page.waitForTimeout(1500);
      const rules = await h1.evaluate((el) => {
        const out: string[] = [];
        const visit = (list: CSSRuleList) => {
          for (const r of Array.from(list)) {
            if (r.cssText.includes('hover') && r.cssText.includes('shadow-lg')) out.push(r.cssText);
            if ('cssRules' in r && r.cssRules instanceof CSSRuleList) visit(r.cssRules);
          }
        };
        for (const sheet of Array.from(el.ownerDocument.styleSheets)) visit(sheet.cssRules);
        return out.slice(0, 3);
      });
      note(rules.join('\n---\n'));
    });

    await tour.step('Bấm Xem thử với "Nổi lên khi rê"', async ({ note }) => {
      const sampling = sample();
      await page.getByTestId('motion-preview').click();
      const seen = await sampling;
      note(seen.join('\n'));
      if (seen.length < 2) throw new Bug('Xem thử không chạy hiệu ứng rê chuột');
    });

    await tour.step('Bỏ chuyển động: nút Xem thử mờ đi', async ({ note }) => {
      const before = await tour.files();
      await page.getByTestId('motion-preset-select').selectOption('none');
      await tour.waitChange(before);
      await page.waitForTimeout(1000);
      const off = await page.getByTestId('motion-preview').isDisabled();
      note(`Nút Xem thử: ${off ? 'mờ' : 'bấm được'}`);
      if (!off) throw new Bug('Không có chuyển động mà nút vẫn bấm được');
    });

    await tour.step('Bật Hiện dần rồi bấm Xem thử', async ({ note }) => {
      const before = await tour.files();
      await page.getByTestId('motion-reveal-toggle').click();
      await tour.waitChange(before);
      await page.waitForTimeout(2000);
      const wrapper = tour.canvas().locator('[data-reveal]').first();
      const sampling = wrapper.evaluate(async (el) => {
        const seen = new Set<string>();
        for (let i = 0; i < 12; i++) {
          seen.add(getComputedStyle(el).opacity);
          await new Promise((r) => setTimeout(r, 50));
        }
        return [...seen];
      });
      await page.getByTestId('motion-preview').click();
      const seen = await sampling;
      note(`Độ mờ khung Reveal: ${seen.join(' → ')}`);
      if (seen.length < 2) throw new Bug('Xem thử không chạy Hiện dần');
    });
  } finally {
    await tour.close();
  }
});
