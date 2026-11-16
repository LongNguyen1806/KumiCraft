// Tour 10 (the owner's report, 2026-11-16): in a free draft, add ProductCard from the Components
// panel, then take it off. The component takes no className: it sits in a placing <div> (no type
// error), and taking it off removes that <div> and its import too.
import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import { expect, test } from '@playwright/test';

import { Bug, Tour } from './support/tour.ts';

const PRODUCT_CARD = `export function ProductCard({ name, price }: { readonly name: string; readonly price: string }) {
  return (
    <div className="w-60 rounded-xl border bg-white p-4">
      <h3 className="font-semibold">{name}</h3>
      <p className="text-sm">{price}</p>
    </div>
  );
}
`;

test('10 a component in a free draft, added then taken off', async ({ page }) => {
  test.setTimeout(4 * 60_000);
  const tour = await Tour.open(
    page,
    'projects/vite8-react19-ts',
    '10-free-draft-component',
    async (root) => {
      await writeFile(join(root, 'src/components/ProductCard.tsx'), PRODUCT_CARD);
    },
  );
  const draftCode = async () => {
    for (const [file, code] of await tour.files()) {
      if (file.startsWith('src/drafts/')) return code;
    }
    return '';
  };
  try {
    await tour.step('Tạo bản nháp tự do', async () => {
      await tour.openPanel('drafts');
      await page.getByTestId('drafts-new-btn').click();
      await page.getByTestId('draft-kind-free').click();
      await page.getByTestId('draft-create').click();
      await expect.poll(draftCode, { timeout: 15_000 }).toContain('data-rc-free');
    });

    await tour.step('Thêm ProductCard từ panel Components', async ({ note }) => {
      // The + button adds at the selection: pick the free frame first.
      await page
        .locator('iframe[data-testid="canvas-iframe"]')
        .first()
        .click({ position: { x: 200, y: 200 } });
      await page.waitForTimeout(400);
      await tour.openPanel('components');
      await page.getByTestId('component-add-ProductCard').click();
      await expect.poll(draftCode, { timeout: 15_000 }).toContain('<ProductCard');
      const code = await draftCode();
      note(code);
      if (/<ProductCard[^>]*className=/.test(code)) {
        throw new Bug('ProductCard nhận className mà nó không khai báo');
      }
    });

    await tour.step('Gỡ ProductCard: hết thẻ, hết import', async ({ note }) => {
      await tour.canvas().getByText('Name').first().click();
      await page.keyboard.press('Delete');
      await expect.poll(draftCode, { timeout: 15_000 }).not.toContain('<ProductCard');
      const code = await draftCode();
      note(code);
      if (code.includes('import { ProductCard }')) throw new Bug('Còn import ProductCard');
      if (code.includes('absolute')) throw new Bug('Còn khung bọc vị trí');
    });
  } finally {
    await tour.close();
  }
});
