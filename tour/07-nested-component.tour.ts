// Tour 07 (the owner's report, 2026-11-16): a `<ProductCard>` placed in the page, whose file returns
// a `<Card>`. Picking it acts on the `<ProductCard …>` line of the page: Delete takes it off the page
// (no E023 "root of the component"), Duplicate copies it, Undo brings it back. ProductCard.tsx and
// Card.tsx are never touched; the component stays in the project.
import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import { expect, test } from '@playwright/test';

import { Bug, diffFiles, Tour } from './support/tour.ts';

const HOME = 'src/pages/Home.tsx';
const PRODUCT_CARD = 'src/components/ProductCard.tsx';

const COMPONENT = `import { Card } from './Card.tsx';

export function ProductCard({ name, price }: { readonly name: string; readonly price: string }) {
  return <Card title={name}>Giá: {price}</Card>;
}
`;

const PAGE = `import { ProductCard } from '../components/ProductCard.tsx';

export function Home() {
  return (
    <main className="min-h-screen bg-slate-50 p-6">
      <div className="mx-auto max-w-3xl space-y-4">
        <ProductCard name="Áo thun" price="200k" />
        <ProductCard name="Quần jean" price="450k" />
      </div>
    </main>
  );
}

export default Home;
`;

const RESTORE = { restore: true } as const;
const untouched = (diff: readonly string[]) =>
  diff.some((l) => l.includes('ProductCard.tsx') || l.includes('Card.tsx '));

test('07 nested component: delete and duplicate act on the page', async ({ page }) => {
  test.setTimeout(4 * 60_000);
  const tour = await Tour.open(
    page,
    'projects/vite8-react19-ts',
    '07-nested-component',
    async (root) => {
      await writeFile(join(root, PRODUCT_CARD), COMPONENT);
      await writeFile(join(root, HOME), PAGE);
    },
  );
  const inspector = page.getByTestId('inspector-panel');
  try {
    await expect(tour.canvas().getByText('Áo thun')).toBeVisible({ timeout: 20_000 });
    const component = await tour.file(PRODUCT_CARD);

    await tour.step('Chọn thẻ: Inspector nói về ProductCard', async ({ note }) => {
      await tour.selectLayer(/div rounded-xl/);
      await page.waitForTimeout(500);
      note(
        `Inspector có chữ ProductCard: ${String((await inspector.innerText()).includes('ProductCard'))}`,
      );
    });

    await tour.step(
      'Phím Delete gỡ thẻ "Áo thun" khỏi trang',
      async ({ note }) => {
        await tour.selectLayer(/div rounded-xl/);
        await page.waitForTimeout(500);
        const before = await tour.files();
        await page.keyboard.press('Delete');
        const after = await tour.waitChange(before);
        const diff = diffFiles(before, after, 4);
        note(diff.join('\n'));
        if (untouched(diff)) throw new Bug('File của component bị sửa');
        const code = await tour.file(HOME);
        if (code.includes('Áo thun') || !code.includes('Quần jean')) {
          throw new Bug('Dòng <ProductCard> trong trang không bị gỡ đúng');
        }
        if ((await tour.file(PRODUCT_CARD)) !== component) throw new Bug('ProductCard.tsx đổi');
      },
      RESTORE,
    );

    await tour.step(
      'Nhân bản thẻ "Áo thun"',
      async ({ note }) => {
        await tour.selectLayer(/div rounded-xl/);
        await page.waitForTimeout(500);
        const before = await tour.files();
        await inspector.getByTestId('inspector-duplicate').click();
        const after = await tour.waitChange(before);
        const diff = diffFiles(before, after, 4);
        note(diff.join('\n'));
        if (untouched(diff)) throw new Bug('File của component bị sửa');
        const copies = ((await tour.file(HOME)).match(/name="Áo thun"/g) ?? []).length;
        if (copies !== 2) throw new Bug(`Có ${String(copies)} thẻ "Áo thun" thay vì 2`);
      },
      RESTORE,
    );
  } finally {
    await tour.close();
  }
});
