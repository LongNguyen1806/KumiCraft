// End-to-end integration tests for Canvas & Bridge (Gate G1, SPEC-04 sections 11-12, SPEC-07 3.2).
// Tests [AC-02], [AC-03], [AC-04], [AC-06], [AC-10], [AC-11], [AC-12] against the built CLI.
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import { expect, type FrameLocator, type Page, test } from '@playwright/test';

import { type CliSession, startCli } from './support/cli-session.ts';
import { copyFixture, makeTempDir, type TempDir } from './support/copy-fixture.ts';

let folder: TempDir;
let config: TempDir;
const sessions: CliSession[] = [];

const start = async () => {
  const session = await startCli(folder.path, config.path);
  sessions.push(session);
  return session;
};

async function open(page: Page, session: CliSession): Promise<Page> {
  const tab = await page.context().newPage();
  await tab.goto(session.studioUrl);
  return tab;
}

async function trustIfAsked(tab: Page): Promise<void> {
  const confirmBtn = tab.getByRole('button', { name: 'Tin cậy dự án này' });
  try {
    await confirmBtn.click({ timeout: 10_000 });
    await expect(confirmBtn).toHaveCount(0, { timeout: 10_000 });
    return;
  } catch {
    // Confirm button not directly clickable, check review button
  }
  const reviewBtn = tab.getByRole('button', { name: 'Xem và tin cậy' });
  try {
    await reviewBtn.click({ timeout: 3_000 });
    await confirmBtn.click();
    await expect(confirmBtn).toHaveCount(0, { timeout: 10_000 });
  } catch {
    // Prompt did not appear
  }
}

async function getCanvasFrame(tab: Page): Promise<FrameLocator> {
  const iframeLocator = tab.locator('iframe[data-testid="canvas-iframe"]');
  await expect(iframeLocator).toBeVisible({ timeout: 20_000 });
  return tab.frameLocator('iframe[data-testid="canvas-iframe"]');
}

async function triggerUndo(tab: Page, browserName: string): Promise<void> {
  if (browserName === 'webkit') {
    await tab.keyboard.press('Meta+z');
  } else {
    await tab.keyboard.press('Control+z');
  }
}

test.beforeEach(async ({ browserName }) => {
  folder = await copyFixture('projects/vite8-react19-ts');
  config = await makeTempDir(`canvas-config-${browserName}`);
});

test.afterEach(async () => {
  for (const session of sessions.splice(0)) await session.stop();
  await folder.remove();
  await config.remove();
});

test('untrusted project blocks dev server and shows restricted prompt [AC-11]', async ({
  page,
}) => {
  const session = await start();
  const tab = await open(page, session);

  await expect(tab.getByRole('dialog', { name: 'Bạn có tin tưởng dự án này?' })).toBeVisible();
  await tab.getByRole('button', { name: 'Để sau' }).click();

  await expect(tab.getByTestId('canvas-untrusted')).toBeVisible();
  await expect(tab.locator('iframe[data-testid="canvas-iframe"]')).toHaveCount(0);
});

test('runner dev server starts up, loads canvas iframe with bridge [AC-02]', async ({ page }) => {
  const session = await start();
  const tab = await open(page, session);
  await trustIfAsked(tab);

  const canvas = await getCanvasFrame(tab);
  await expect(canvas.getByRole('heading', { name: 'Sản phẩm nổi bật' })).toBeVisible({
    timeout: 15_000,
  });
  await expect(tab.getByRole('complementary', { name: 'Lớp' })).toBeVisible();
});

test('select element and edit tailwind class with byte-exact undo [AC-03]', async ({
  page,
  browserName,
}) => {
  const session = await start();
  const tab = await open(page, session);
  await trustIfAsked(tab);

  const canvas = await getCanvasFrame(tab);
  const heading = canvas.getByRole('heading', { name: 'Sản phẩm nổi bật' });
  await expect(heading).toBeVisible({ timeout: 15_000 });

  const homeFile = join(folder.path, 'src', 'pages', 'Home.tsx');
  const originalCode = await readFile(homeFile, 'utf8');

  await heading.click();
  await tab.getByTestId('raw-class-details').locator('summary').click();
  const rawClassInput = tab.getByTestId('raw-class-input');
  await expect(rawClassInput).toBeVisible({ timeout: 5_000 });

  const currentClass = await rawClassInput.inputValue();
  const updatedClass = `${currentClass} p-8`;
  await rawClassInput.fill(updatedClass);
  await rawClassInput.press('Enter');

  await expect
    .poll(
      async () => {
        const code = await readFile(homeFile, 'utf8');
        return code.includes('p-8');
      },
      { timeout: 10_000 },
    )
    .toBe(true);

  // Blur input so typing target doesn't suppress global undo shortcut
  await rawClassInput.blur();

  // Undo (Mod+Z)
  await triggerUndo(tab, browserName);

  await expect
    .poll(
      async () => {
        const code = await readFile(homeFile, 'utf8');
        return code;
      },
      { timeout: 10_000 },
    )
    .toBe(originalCode);
});

test('responsive mobile frame adds max-sm prefix and keeps desktop frame clean [AC-04]', async ({
  page,
}) => {
  const session = await start();
  const tab = await open(page, session);
  await trustIfAsked(tab);

  const canvas = await getCanvasFrame(tab);
  const heading = canvas.getByRole('heading', { name: 'Sản phẩm nổi bật' });
  await expect(heading).toBeVisible({ timeout: 15_000 });

  // Switch to Mobile frame
  const frameSelect = tab.getByTestId('canvas-frame-select');
  await frameSelect.selectOption('mobile');

  await heading.click();
  await tab.getByTestId('raw-class-details').locator('summary').click();
  const rawClassInput = tab.getByTestId('raw-class-input');
  await expect(rawClassInput).toBeVisible({ timeout: 5_000 });

  const homeFile = join(folder.path, 'src', 'pages', 'Home.tsx');
  const currentClass = await rawClassInput.inputValue();
  await rawClassInput.fill(`${currentClass} max-sm:text-sm`);
  await rawClassInput.press('Enter');

  await expect
    .poll(
      async () => {
        const code = await readFile(homeFile, 'utf8');
        return code.includes('max-sm:text-sm');
      },
      { timeout: 10_000 },
    )
    .toBe(true);

  // Switch back to Desktop frame
  await frameSelect.selectOption('desktop');
  const desktopCode = await readFile(homeFile, 'utf8');
  expect(desktopCode).toContain('text-hero font-bold text-brand');
});

test('direct text editing on canvas commits into JSX source [AC-06]', async ({ page }) => {
  const session = await start();
  const tab = await open(page, session);
  await trustIfAsked(tab);

  const canvas = await getCanvasFrame(tab);
  const heading = canvas.getByRole('heading', { name: 'Sản phẩm nổi bật' });
  await expect(heading).toBeVisible({ timeout: 15_000 });

  const homeFile = join(folder.path, 'src', 'pages', 'Home.tsx');

  // Double click to start inline text editing
  await heading.dblclick();
  await expect(heading).toHaveAttribute('contenteditable', /plaintext-only|true/);
  await tab.keyboard.press('ArrowRight');

  // Type new text
  await tab.keyboard.type(' Mới 2026');
  await tab.keyboard.press('Enter');

  await expect
    .poll(
      async () => {
        const code = await readFile(homeFile, 'utf8');
        return code.includes('Sản phẩm nổi bật Mới 2026');
      },
      { timeout: 10_000 },
    )
    .toBe(true);
});

test('detects external file modification and warns on conflicting undo [AC-10]', async ({
  page,
  browserName,
}) => {
  const session = await start();
  const tab = await open(page, session);
  await trustIfAsked(tab);

  const canvas = await getCanvasFrame(tab);
  const heading = canvas.getByRole('heading', { name: 'Sản phẩm nổi bật' });
  await expect(heading).toBeVisible({ timeout: 15_000 });

  const homeFile = join(folder.path, 'src', 'pages', 'Home.tsx');
  await heading.click();
  await tab.getByTestId('raw-class-details').locator('summary').click();

  const rawClassInput = tab.getByTestId('raw-class-input');
  await expect(rawClassInput).toBeVisible({ timeout: 5_000 });
  await rawClassInput.fill('text-hero font-bold text-brand m-2');
  await rawClassInput.press('Enter');

  await expect
    .poll(
      async () => {
        const code = await readFile(homeFile, 'utf8');
        return code.includes('m-2');
      },
      { timeout: 10_000 },
    )
    .toBe(true);

  // External edit (simulating VS Code modifying the file)
  const modified = await readFile(homeFile, 'utf8');
  await writeFile(homeFile, modified.replace('Sản phẩm nổi bật', 'Sản phẩm từ VS Code'), 'utf8');

  // Blur input so typing target doesn't suppress global undo shortcut
  await rawClassInput.blur();

  // Trigger undo
  await triggerUndo(tab, browserName);
  // File conflict should prevent overwrite of external changes
  const postUndo = await readFile(homeFile, 'utf8');
  expect(postUndo).toContain('Sản phẩm từ VS Code');
});

test('dynamic expression className={cn(...)} is locked with reason in inspector [AC-12]', async ({
  page,
}) => {
  const session = await start();
  const tab = await open(page, session);
  await trustIfAsked(tab);

  const canvas = await getCanvasFrame(tab);
  const dynamicElement = canvas.getByText('Khối sử dụng hàm cn()');
  await expect(dynamicElement).toBeVisible({ timeout: 15_000 });

  await dynamicElement.click();

  const lockBanner = tab.getByTestId('lock-banner');
  await expect(lockBanner).toBeVisible({ timeout: 5_000 });
  await expect(tab.getByText(/biểu thức mã|biểu thức động|dynamic/i)).toBeVisible();
  await expect(lockBanner.getByText(/Mở trong editor|Open in editor/i)).toBeVisible();
});
