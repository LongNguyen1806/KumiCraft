// End-to-end integration tests for Canvas & Bridge (Gate G1, SPEC-04 sections 11-12, SPEC-07 3.2).
// Tests [AC-02], [AC-03], [AC-04], [AC-06], [AC-10], [AC-11], [AC-12] against the built CLI.
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import { expect, type Page, test } from '@playwright/test';

import { type CliSession, startCli } from './support/cli-session.ts';
import { copyFixture, makeTempDir, type TempDir } from './support/copy-fixture.ts';
import { getCanvasFrame, trustIfAsked } from './support/trust.ts';
import { ui } from './support/ui-text.ts';

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

  await expect(tab.getByRole('dialog', { name: ui('trust.title') })).toBeVisible();
  await tab.getByRole('button', { name: ui('trust.later') }).click();

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
  await expect(tab.getByRole('complementary', { name: ui('editor.layers') })).toBeVisible();
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

test('static first argument of className={cn(...)} is editable, the rest kept byte for byte [AC-12] [WP-4.00]', async ({
  page,
  browserName,
}) => {
  const session = await start();
  const tab = await open(page, session);
  await trustIfAsked(tab);

  const canvas = await getCanvasFrame(tab);
  const dynamicElement = canvas.getByText('Khối sử dụng hàm cn()');
  await expect(dynamicElement).toBeVisible({ timeout: 15_000 });

  const homeFile = join(folder.path, 'src', 'pages', 'Home.tsx');
  const originalCode = await readFile(homeFile, 'utf8');

  await dynamicElement.click();

  const lockBanner = tab.getByTestId('lock-banner');
  await expect(lockBanner).toBeHidden();

  await expect(tab.getByText(/active && 'bg-blue-50 border-blue-300'/)).toBeVisible();

  await tab.getByTestId('raw-class-details').locator('summary').click();
  const rawClassInput = tab.getByTestId('raw-class-input');
  await expect(rawClassInput).toBeVisible({ timeout: 5_000 });
  await expect(rawClassInput).toHaveValue('p-4 border rounded-lg');

  await rawClassInput.fill('p-6 border rounded-lg');
  await rawClassInput.press('Enter');

  await expect
    .poll(
      async () => {
        const code = await readFile(homeFile, 'utf8');
        return code.includes("cn('p-6 border rounded-lg', active && 'bg-blue-50 border-blue-300')");
      },
      { timeout: 10_000 },
    )
    .toBe(true);

  await rawClassInput.blur();
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

test('build error banner shows the file and hides after the fix [R-RN-25]', async ({ page }) => {
  const session = await start();
  const tab = await open(page, session);
  await trustIfAsked(tab);

  const canvas = await getCanvasFrame(tab);
  await expect(canvas.getByRole('heading', { name: 'Sản phẩm nổi bật' })).toBeVisible({
    timeout: 25_000,
  });

  const homeFile = join(folder.path, 'src', 'pages', 'Home.tsx');
  const original = await readFile(homeFile, 'utf8');

  // Introduce broken JSX
  await writeFile(homeFile, `${original}\n<div>broken unclosed tag`, 'utf8');

  const buildErrorBanner = tab.getByTestId('canvas-build-error');
  await expect(buildErrorBanner).toBeVisible({ timeout: 15_000 });

  const openBtn = tab.getByTestId('canvas-build-error-open');
  await expect(openBtn).toContainText('src/pages/Home.tsx');

  // Fix by writing back original content
  await writeFile(homeFile, original, 'utf8');
  await expect(buildErrorBanner).toBeHidden({ timeout: 15_000 });
});

test('selected element removed by an external edit reports found false [R-BR-16]', async ({
  page,
}) => {
  const session = await start();
  const tab = await open(page, session);
  await trustIfAsked(tab);

  const canvas = await getCanvasFrame(tab);
  const heading = canvas.getByRole('heading', { name: 'Sản phẩm nổi bật' });
  await expect(heading).toBeVisible({ timeout: 25_000 });

  const homeFile = join(folder.path, 'src', 'pages', 'Home.tsx');
  const originalCode = await readFile(homeFile, 'utf8');

  await tab.evaluate(() => {
    window.addEventListener('message', (event: MessageEvent<unknown>) => {
      const data = event.data;
      if (
        data &&
        typeof data === 'object' &&
        'type' in data &&
        data.type === 'selection-info' &&
        'payload' in data
      ) {
        document.body.dataset.rcSelectionInfo = JSON.stringify(data.payload);
      }
    });
  });

  await heading.click();

  await expect
    .poll(
      async () => {
        return tab.evaluate(() => document.body.dataset.rcSelectionInfo ?? '');
      },
      { timeout: 10_000 },
    )
    .toContain('"found":true');

  try {
    const modifiedCode = originalCode.replace(
      '<h1 className="text-hero font-bold text-brand">Sản phẩm nổi bật</h1>',
      '',
    );
    await writeFile(homeFile, modifiedCode, 'utf8');

    await expect
      .poll(
        async () => {
          return tab.evaluate(() => document.body.dataset.rcSelectionInfo ?? '');
        },
        { timeout: 15_000 },
      )
      .toContain('"found":false');
  } finally {
    await writeFile(homeFile, originalCode, 'utf8');
  }
});

test('a page that draws itself forever stops with a message and the Studio keeps working [spec-log #116]', async ({
  page,
}) => {
  const homeFile = join(folder.path, 'src', 'pages', 'Home.tsx');
  await writeFile(
    homeFile,
    'export function Home() {\n  return (\n    <div>\n      <h1>Loop</h1>\n      <Home />\n    </div>\n  );\n}\n',
    'utf8',
  );
  const session = await start();
  await session.api('project/trust', 'POST', { trusted: true });
  const tab = await open(page, session);
  await trustIfAsked(tab);

  await expect(tab.getByTestId('canvas-runtime-error-item').first()).toContainText('draws itself', {
    timeout: 30_000,
  });
  // The Studio still answers: a panel opens at once.
  await tab.getByTestId('activity-files').click();
  await expect(tab.getByTestId('file-row-src')).toBeVisible({ timeout: 5_000 });
  // The file on disk is left as the user wrote it.
  expect(await readFile(homeFile, 'utf8')).not.toContain('throw new Error');
});

test('the Inspector writes for the frame being edited: a typed padding on Mobile gets max-sm [AC-04, spec-log #124]', async ({
  page,
}) => {
  const session = await start();
  const tab = await open(page, session);
  await trustIfAsked(tab);

  const canvas = await getCanvasFrame(tab);
  const main = canvas.locator('main.p-6');
  await expect(main).toBeVisible({ timeout: 15_000 });
  await tab.getByTestId('canvas-frame-select').selectOption('mobile');
  await main.click({ position: { x: 5, y: 5 } });

  // The scope shown is the frame's, not Base.
  await expect(tab.getByTestId('write-prefix-badge')).toHaveText('max-sm:');
  const side = tab.getByTestId('input-paddingRight');
  await side.click();
  // Every suggestion shows on click, whatever the field holds.
  await expect(tab.getByTestId('suggest-paddingRight').locator('li')).not.toHaveCount(0);
  await side.fill('50');
  await side.press('Enter');

  const homeFile = join(folder.path, 'src', 'pages', 'Home.tsx');
  await expect
    .poll(async () => (await readFile(homeFile, 'utf8')).includes('max-sm:pr-50'), {
      timeout: 10_000,
    })
    .toBe(true);
  // Nothing unprefixed: the desktop layout keeps its padding.
  expect(await readFile(homeFile, 'utf8')).not.toMatch(/\spr-50/);
});
