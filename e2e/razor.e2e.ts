// End-to-end tests for ASP.NET Core (03c section 7): the Razor Pages sample (Tailwind, built by
// its own CLI) and the MVC sample (Bootstrap) run in the Canvas from a stamped copy; an element is
// selected at its file and line, an edit is written to the .cshtml, the Canvas shows it, and Undo
// gives the file back byte for byte. Needs the .NET SDK.
import { execFileSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

import { expect, type Page, test } from '@playwright/test';

import { type CliSession, startCli } from './support/cli-session.ts';
import { copyFixture, makeTempDir, type TempDir } from './support/copy-fixture.ts';
import { getCanvasFrame, trustIfAsked } from './support/trust.ts';

function hasDotnet(): boolean {
  try {
    return execFileSync('dotnet', ['--list-sdks'], { encoding: 'utf8' }).trim() !== '';
  } catch {
    return false;
  }
}

test.skip(!hasDotnet(), 'The .NET SDK is not installed on this machine');

let folder: TempDir;
let config: TempDir;
let session: CliSession | undefined;

test.afterEach(async () => {
  await session?.stop();
  session = undefined;
  await folder.remove();
  await config.remove();
});

async function open(studio: Page, fixture: string, browserName: string) {
  folder = await copyFixture(`projects/${fixture}`);
  config = await makeTempDir(`${fixture}-config-${browserName}`);
  session = await startCli(folder.path, config.path);
  await studio.goto(session.studioUrl);
  await trustIfAsked(studio);
  // The first start builds the Razor helper and the project with dotnet.
  await expect(studio.locator('iframe[data-testid="canvas-iframe"]')).toBeVisible({
    timeout: 240_000,
  });
  return getCanvasFrame(studio);
}

const undoKey = (browserName: string) => (browserName === 'webkit' ? 'Meta+z' : 'Control+z');

test('Razor Pages + Tailwind: selects a page and a layout element, edits a class, Undo [03c 7]', async ({
  page: studio,
  browserName,
}) => {
  test.setTimeout(300_000);
  const canvas = await open(studio, 'razor-pages-net10', browserName);
  const heading = canvas.getByRole('heading', { name: 'Welcome' });
  await expect(heading).toBeVisible({ timeout: 180_000 });
  await expect(heading).toHaveAttribute('data-rc-loc', 'Pages/Index.cshtml:8:5');
  await expect(canvas.getByRole('link', { name: 'RazorPagesApp' })).toHaveAttribute(
    'data-rc-loc',
    'Pages/Shared/_Layout.cshtml:12:13',
  );

  const file = join(folder.path, 'Pages/Index.cshtml');
  const original = await readFile(file, 'utf8');
  await heading.click();
  await studio.getByTestId('raw-class-details').locator('summary').click();
  const input = studio.getByTestId('raw-class-input');
  await expect(input).toHaveValue('text-4xl font-bold');
  await input.fill('text-4xl font-bold text-red-600');
  await input.press('Enter');
  await expect
    .poll(() => readFile(file, 'utf8'), { timeout: 15_000 })
    .toContain('<h1 class="text-4xl font-bold text-red-600">Welcome</h1>');
  // The copy is stamped again, dotnet watch reloads it and Tailwind builds the new class.
  await expect(heading).toHaveCSS('color', /rgb\(2\d\d, \d+, \d+\)|oklch/, { timeout: 30_000 });

  await input.blur();
  await studio.keyboard.press(undoKey(browserName));
  await expect.poll(() => readFile(file, 'utf8'), { timeout: 15_000 }).toBe(original);
});

test('MVC + Bootstrap: edits a heading text on the Canvas, Undo [03c 7]', async ({
  page: studio,
  browserName,
}) => {
  test.setTimeout(300_000);
  const canvas = await open(studio, 'mvc-net10', browserName);
  const heading = canvas.getByRole('heading', { name: 'Welcome' });
  await expect(heading).toBeVisible({ timeout: 180_000 });
  await expect(heading).toHaveAttribute('data-rc-loc', 'Views/Home/Index.cshtml:6:5');

  const file = join(folder.path, 'Views/Home/Index.cshtml');
  const original = await readFile(file, 'utf8');
  await heading.dblclick();
  await expect(heading).toHaveAttribute('contenteditable', /plaintext-only|true/);
  await studio.keyboard.press('End');
  await studio.keyboard.type(' back');
  await studio.keyboard.press('Enter');
  await expect
    .poll(() => readFile(file, 'utf8'), { timeout: 15_000 })
    .toContain('<h1 class="display-4">Welcome back</h1>');
  await expect(canvas.getByRole('heading', { name: 'Welcome back' })).toBeVisible({
    timeout: 30_000,
  });

  await studio.keyboard.press(undoKey(browserName));
  await expect.poll(() => readFile(file, 'utf8'), { timeout: 15_000 }).toBe(original);

  // A structure edit shows only once the copy is stamped again and dotnet serves it: the
  // duplicate carries the stamp of its new line.
  await canvas.getByRole('heading', { name: 'Welcome' }).click();
  await studio.keyboard.press(browserName === 'webkit' ? 'Meta+d' : 'Control+d');
  await expect
    .poll(() => readFile(file, 'utf8'), { timeout: 15_000 })
    .toContain('<h1 class="display-4">Welcome</h1>\r\n    <h1 class="display-4">Welcome</h1>');
  await expect(canvas.locator('[data-rc-loc="Views/Home/Index.cshtml:7:5"]')).toHaveText(
    'Welcome',
    { timeout: 30_000 },
  );
});
