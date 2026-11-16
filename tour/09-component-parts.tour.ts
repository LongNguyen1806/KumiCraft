// Tour 09 (thiet-ke-component.md, Đợt 2): the Layers name of a nested component, an image knob
// picked from the project's images over a value written as code, a part of a component's own file
// shown but locked, and a part the page passes into a component naming that component.
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import { expect, test } from '@playwright/test';

import { Bug, Tour } from './support/tour.ts';

// A draft: the file being designed is known (this fixture has no router to name a page's file).
const DRAFT = 'src/drafts/Nhap.tsx';

const PRODUCT_CARD = `import { Card } from './Card.tsx';

export function ProductCard({ name, price, image }: { readonly name: string; readonly price: string; readonly image?: string }) {
  return (
    <Card title={name}>
      <img src={image} alt={name} className="h-16 w-16" />
      Giá: {price}
    </Card>
  );
}
`;

const PAGE = `import { Card } from '../components/Card.tsx';
import { ProductCard } from '../components/ProductCard.tsx';

const photo = '/old.svg';

export default function Nhap() {
  return (
    <main className="min-h-screen bg-slate-50 p-6">
      <div className="mx-auto max-w-3xl space-y-4">
        <ProductCard name="Áo thun" price="200k" image={photo} />
        <Card title="Thẻ thường">
          <p className="text-sm">Ruột do trang viết</p>
        </Card>
      </div>
    </main>
  );
}
`;

const SVG =
  '<svg xmlns="http://www.w3.org/2000/svg" width="8" height="8"><rect width="8" height="8" fill="red"/></svg>';

test('09 component parts', async ({ page }) => {
  test.setTimeout(4 * 60_000);
  const tour = await Tour.open(
    page,
    'projects/vite8-react19-ts',
    '09-component-parts',
    async (root) => {
      await writeFile(join(root, 'src/components/ProductCard.tsx'), PRODUCT_CARD);
      await mkdir(join(root, 'src/drafts'), { recursive: true });
      await writeFile(join(root, DRAFT), PAGE);
      await mkdir(join(root, 'public'), { recursive: true });
      await writeFile(join(root, 'public/new.svg'), SVG);
      await writeFile(join(root, 'public/old.svg'), SVG);
    },
  );
  try {
    await tour.openPanel('drafts');
    await page.getByTestId(`draft-open-${DRAFT}`).click();
    await expect(tour.canvas().getByText('Áo thun')).toBeVisible({ timeout: 20_000 });
    await tour.openPanel('layers');

    await tour.step('Panel Lớp ghi ProductCard, không ghi Card', async ({ note }) => {
      const named = page.getByTestId('component-badge').filter({ hasText: /^ProductCard$/ });
      await expect(named.first()).toBeVisible({ timeout: 10_000 });
      const badges = await page.getByTestId('component-badge').allInnerTexts();
      note(`Nhãn: ${badges.join(', ')}`);
      if (!badges.includes('ProductCard')) throw new Bug('Không có nhãn ProductCard');
    });

    await tour.step(
      'Chọn ảnh mới cho ProductCard thay {photo}',
      async ({ note }) => {
        await tour.canvas().getByText('Áo thun').click();
        await expect(page.getByTestId('component-card')).toContainText('ProductCard');
        const before = await tour.files();
        await page.getByTestId('prop-pick-image-image').click();
        await page
          .getByRole('dialog')
          .locator('[data-testid="image-picker-item"][data-src="/new.svg"]')
          .click();
        await page.getByRole('dialog').getByTestId('image-picker-insert').click();
        await tour.waitChange(before);
        const line = (await tour.file(DRAFT)).split('\n').find((l) => l.includes('<ProductCard'));
        note(line ?? '');
        if (line?.includes('image="/new.svg"') !== true) throw new Bug('Ảnh không được ghi');
      },
      { restore: true },
    );

    await tour.step('Chọn chữ bên trong Card.tsx: khung báo, các ô bị khóa', async () => {
      await page.keyboard.press('Escape');
      await tour.selectLayer(/^h3\b/);
      await expect(page.getByTestId('component-part-notice')).toBeVisible({ timeout: 10_000 });
      await expect(page.getByTestId('component-part-locked')).toBeVisible();
    });

    await tour.step('Chọn ruột do trang viết: dòng "nằm trong Card"', async ({ note }) => {
      await page.keyboard.press('Escape');
      // The Layers list keeps the inside of a repeated tag's first copy only (V-113): click it on
      // the Canvas, each click going one level in.
      const line = page.getByTestId('component-children-line');
      for (let i = 0; i < 4 && !(await line.isVisible()); i++) {
        await tour.canvas().getByText('Ruột do trang viết').click();
        await page.waitForTimeout(500);
      }
      await expect(line).toBeVisible({ timeout: 10_000 });
      note(await line.innerText());
      if (await page.getByTestId('component-part-locked').isVisible()) {
        throw new Bug('Ruột của trang bị khóa');
      }
    });
  } finally {
    await tour.close();
  }
});
