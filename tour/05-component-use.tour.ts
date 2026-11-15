// Tour 05 (hand test step 13, 2026-11-15): picking a component on the Canvas acts on its use in the
// page. Delete and Duplicate change the `<Card …>` line, never Card.tsx; a Reveal picked on the
// Canvas is turned off by unwrapping its use, without the E023 "root of the component" refusal.
import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import { expect, test } from '@playwright/test';

import { Bug, diffFiles, Tour } from './support/tour.ts';

const HOME = 'src/pages/Home.tsx';

const PAGE = `import { Card } from '../components/Card.tsx';

export function Home() {
  return (
    <main className="min-h-screen bg-slate-50 p-6">
      <div className="mx-auto max-w-3xl space-y-4">
        <Card title="Thẻ một">Nội dung một</Card>
        <Card title="Thẻ hai">Nội dung hai</Card>
        <button type="button" className="rounded bg-blue-600 px-4 py-2 text-white">
          Nút mẫu
        </button>
      </div>
    </main>
  );
}

export default Home;
`;

const RESTORE = { restore: true } as const;

test('05 component use: delete, duplicate, Reveal off', async ({ page }) => {
  test.setTimeout(4 * 60_000);
  const tour = await Tour.open(page, 'projects/vite8-react19-ts', '05-component-use', (root) =>
    writeFile(join(root, HOME), PAGE),
  );
  const inspector = page.getByTestId('inspector-panel');
  try {
    await expect(tour.canvas().getByText('Thẻ một')).toBeVisible({ timeout: 20_000 });

    for (const [name, button, check] of [
      [
        'Xóa Card "Thẻ một" từ phần gốc của nó',
        'inspector-remove',
        (code: string) => !code.includes('Thẻ một') && code.includes('Thẻ hai'),
      ],
      [
        'Nhân bản Card "Thẻ một" từ phần gốc của nó',
        'inspector-duplicate',
        (code: string) => (code.match(/title="Thẻ một"/g) ?? []).length === 2,
      ],
    ] as const) {
      await tour.step(
        name,
        async ({ note }) => {
          await tour.selectLayer(/div rounded-xl/);
          await page.waitForTimeout(500);
          const before = await tour.files();
          await inspector.getByTestId(button).click();
          const after = await tour.waitChange(before);
          const diff = diffFiles(before, after, 4);
          note(diff.join('\n'));
          if (diff.some((l) => l.includes('Card.tsx'))) throw new Bug('File Card.tsx bị sửa');
          if (!check(await tour.file(HOME))) throw new Bug('Chỗ dùng trong trang không đổi đúng');
        },
        RESTORE,
      );
    }

    await tour.step(
      'Bọc nút bằng Reveal, chọn khung Reveal trên Canvas, tắt Reveal',
      async ({ note }) => {
        await tour.selectLayer(/^button\b/);
        const closed = page.locator('[data-testid^="inspector-group-"][aria-expanded="false"]');
        while ((await closed.count()) > 0) await closed.first().click();
        // The Motion group has its own test id: opened by its title when the toggle is hidden.
        if (!(await page.getByTestId('motion-reveal-toggle').isVisible())) {
          await inspector.getByRole('button', { name: /^Chuyển động/ }).click();
        }
        const start = await tour.files();
        await page.getByTestId('motion-reveal-toggle').click();
        await expect.poll(() => tour.file(HOME)).toContain('<Reveal');
        // A first click on the button picks the outer group: the Reveal (inside Reveal.tsx).
        await page.keyboard.press('Escape');
        await tour.canvas().getByText('Nút mẫu').click();
        await expect(inspector).toContainText('Reveal.tsx');
        await page.waitForTimeout(500);
        while ((await closed.count()) > 0) await closed.first().click();
        // The Motion group has its own test id: opened by its title when the toggle is hidden.
        if (!(await page.getByTestId('motion-reveal-toggle').isVisible())) {
          await inspector.getByRole('button', { name: /^Chuyển động/ }).click();
        }
        const toggle = page.getByTestId('motion-reveal-toggle');
        note(`Nút Reveal hiện: ${await toggle.innerText()}`);
        const wrapped = await tour.files();
        await toggle.click();
        await tour.waitChange(wrapped);
        const code = await tour.file(HOME);
        if (code.includes('<Reveal')) throw new Bug('Tắt Reveal mà thẻ <Reveal> vẫn còn');
        if (!code.includes('Nút mẫu')) throw new Bug('Nút bị mất khi gỡ Reveal');
        note(diffFiles(start, await tour.files(), 4).join('\n'));
      },
    );
  } finally {
    await tour.close();
  }
});
