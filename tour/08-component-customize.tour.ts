// Tour 08 (thiet-ke-component.md, Đợt 1): picking a component use shows a card naming it and the
// "Customize" group: its knobs in plain words, grouped by what they do. A plain <img> shows none.
import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import { expect, test } from '@playwright/test';

import { Bug, Tour } from './support/tour.ts';

const HOME = 'src/pages/Home.tsx';
const PRODUCT_CARD = 'src/components/ProductCard.tsx';

const COMPONENT = `import type { ImgHTMLAttributes } from 'react';

const styles = { flat: 'bg-white', raised: 'bg-white shadow-lg', outline: 'border-2' };

type Props = ImgHTMLAttributes<HTMLImageElement> & {
  readonly name: string;
  readonly price: string;
  readonly image?: string;
  readonly href?: string;
  readonly showSale?: boolean;
  readonly variant?: keyof typeof styles;
};

export function ProductCard({ name, price, image, href = '#', showSale = false, variant = 'flat', ...rest }: Props) {
  return (
    <a href={href} className={\`block rounded-xl p-4 \${styles[variant]}\`}>
      <img src={image} alt={name} className="h-24 w-full rounded object-cover" {...rest} />
      <h3 className="mt-2 font-semibold">{name}</h3>
      <p className="text-sm text-slate-600">{price}</p>
      {showSale && <span className="text-xs text-red-600">Giảm giá</span>}
    </a>
  );
}
`;

const PAGE = `import { ProductCard } from '../components/ProductCard.tsx';

const photo = '/vite.svg';

export function Home() {
  return (
    <main className="min-h-screen bg-slate-50 p-6">
      <div className="mx-auto grid max-w-3xl grid-cols-2 gap-4">
        <ProductCard name="Áo thun" price="200k" image={photo} />
        <img src="/vite.svg" alt="Logo" className="h-16 w-16" />
      </div>
    </main>
  );
}

export default Home;
`;

test('08 component customize panel', async ({ page }) => {
  test.setTimeout(4 * 60_000);
  const tour = await Tour.open(
    page,
    'projects/vite8-react19-ts',
    '08-component-customize',
    async (root) => {
      await writeFile(join(root, PRODUCT_CARD), COMPONENT);
      await writeFile(join(root, HOME), PAGE);
    },
  );
  const inspector = page.getByTestId('inspector-panel');
  try {
    await expect(tour.canvas().getByText('Áo thun')).toBeVisible({ timeout: 20_000 });

    await tour.step('Chọn ProductCard: thẻ Component và các nhóm Tùy chỉnh', async ({ note }) => {
      await tour.selectLayer(/a block/);
      await expect(page.getByTestId('component-card')).toBeVisible({ timeout: 15_000 });
      await expect(page.getByTestId('prop-group-content')).toBeVisible({ timeout: 15_000 });
      const groups = await inspector
        .locator('[data-testid^="prop-group-"]')
        .evaluateAll((els) => els.map((e) => e.getAttribute('data-testid')));
      note(`Nhóm: ${groups.join(', ')}`);
      const rows = await inspector.locator('[data-testid^="prop-row-"]').count();
      note(`Số ô: ${String(rows)}`);
      if (rows > 8) throw new Bug(`Còn ${String(rows)} ô, quá nhiều`);
      for (const noise of ['crossOrigin', 'fetchPriority', 'referrerPolicy', 'decoding']) {
        if (await inspector.getByText(noise, { exact: true }).isVisible()) {
          throw new Bug(`Còn hiện thuộc tính HTML ${noise}`);
        }
      }
    });

    await tour.step(
      'Bật "Hiện nhãn giảm giá": chỉ dòng dùng trong trang đổi',
      async ({ note }) => {
        const before = await tour.files();
        await page.getByTestId('prop-input-showSale').click();
        await tour.waitChange(before);
        const code = await tour.file(HOME);
        note(code.split('\n').find((l) => l.includes('<ProductCard')) ?? '');
        if (!code.includes('showSale')) throw new Bug('Trang không có showSale');
      },
      { restore: true },
    );

    await tour.step('Chọn thẻ <img> thường: không có mục Tùy chỉnh', async () => {
      await tour.selectLayer(/^img\b/);
      await page.waitForTimeout(800);
      if (await page.getByTestId('component-card').isVisible()) {
        throw new Bug('Thẻ <img> thường vẫn hiện thẻ Component');
      }
    });
  } finally {
    await tour.close();
  }
});
