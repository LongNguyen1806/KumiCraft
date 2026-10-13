// Acceptance tests of WP-1.09 part B, written before the code (SPEC-04.1 sections 11.1, 11.3;
// SPEC-03 section 2.2a). Do not change them to make them pass: report instead.
// Contract of the `data-testid`s: docs/construction/giao-viec/buoc-09b-inspector-core.md.
import { expect, type Page, test } from '@playwright/test';
import type { DesignNode } from '@reactcraft/model';

import { openCanvasStudio } from './support/canvas-studio.ts';
import { type CliSession, startCli } from './support/cli-session.ts';
import { makeTempDir, type TempDir } from './support/copy-fixture.ts';
import {
  CARD,
  expectSaved as expectSavedIn,
  findIn,
  ROOT,
  ROW,
  undoButton,
  writeSmallWorkspace,
} from './support/small-page.ts';

let workspace: TempDir;
let config: TempDir;
const sessions: CliSession[] = [];

const expectSaved = (check: (root: DesignNode) => unknown, expected: unknown) =>
  expectSavedIn(workspace.path, check, expected);
const card = (r: DesignNode) => findIn(r, CARD);
const field = (tab: Page, id: string) => tab.getByTestId(`field-${id}`);

async function open(page: Page): Promise<Page> {
  const session = await startCli(workspace.path, config.path);
  sessions.push(session);
  const tab = await openCanvasStudio(page, session);
  await tab.getByTestId(`layer-row-${CARD}`).click();
  await expect(tab.getByTestId('inspector')).toBeVisible();
  return tab;
}

async function pickFrame(tab: Page, label: 'Desktop' | 'Tablet' | 'Mobile') {
  await tab
    .getByRole('group', { name: /khung|frames/i })
    .getByRole('button', { name: new RegExp(`^${label}`) })
    .click();
}

/** Types a custom px value in a field and commits it with Enter. */
async function typePx(tab: Page, id: string, value: string) {
  const input = tab.getByTestId(`field-${id}-input`);
  if (!(await input.isVisible())) await tab.getByTestId(`field-${id}-mode`).click();
  await input.fill(value);
  await input.press('Enter');
}

test.beforeEach(async ({ browserName }) => {
  workspace = await makeTempDir(`inspector-${browserName}`);
  config = await makeTempDir(`inspector-config-${browserName}`);
  await writeSmallWorkspace(workspace.path);
});

test.afterEach(async () => {
  for (const session of sessions.splice(0)) await session.stop();
  await workspace.remove();
  await config.remove();
});

test('11.1: the scope bar says which frame and which key an edit goes to', async ({ page }) => {
  const tab = await open(page);
  const scope = tab.getByTestId('inspector-scope');

  await expect(scope).toContainText('Desktop 1440');
  await expect(scope).toContainText('Gốc');
  await expect(tab.getByTestId('inspector-state')).toBeEnabled();

  await tab.getByTestId('inspector-state').selectOption('hover');
  await pickFrame(tab, 'Mobile');
  await expect(scope).toContainText('Mobile 375');
  await expect(scope).toContainText('Ghi đè < 640 px');
  // V-28: states exist only at the base key; leaving it goes back to Normal.
  await expect(tab.getByTestId('inspector-state')).toBeDisabled();
  await pickFrame(tab, 'Desktop');
  await expect(tab.getByTestId('inspector-state')).toHaveValue('normal');
  await expect(scope).not.toContainText('Hover');
});

test('R-IN-01: a custom px value is saved at base, and one Undo takes it back', async ({
  page,
}) => {
  const tab = await open(page);

  await typePx(tab, 'padding-top', '40');

  await expectSaved((r) => card(r)?.style?.padding?.top, { px: 40 });
  await expectSaved((r) => card(r)?.style?.padding?.left, { px: 24 });
  await undoButton(tab).click();
  await expectSaved((r) => card(r)?.style?.padding?.top, { px: 24 });
});

test('R-IN-01: a token can be picked instead of a number', async ({ page }) => {
  const tab = await open(page);
  const mode = tab.getByTestId('field-gap-mode');
  if (await tab.getByTestId('field-gap-input').isVisible()) await mode.click();

  await tab.getByTestId('field-gap-token').selectOption('token:spacing.4');

  await expectSaved((r) => card(r)?.style?.gap, 'token:spacing.4');
});

test('AC-03, R-IN-02, R-IN-03: an edit in Mobile overrides Mobile only', async ({ page }) => {
  const tab = await open(page);
  await pickFrame(tab, 'Mobile');

  // Before the edit the value is inherited from Desktop.
  await expect(field(tab, 'padding-top-inherited')).toBeVisible();
  await expect(field(tab, 'padding-top-override')).toHaveCount(0);

  await typePx(tab, 'padding-top', '8');

  await expectSaved((r) => card(r)?.responsive?.sm?.padding?.top, { px: 8 });
  await expectSaved((r) => card(r)?.style?.padding?.top, { px: 24 });
  await expect(field(tab, 'padding-top-override')).toBeVisible();
  await expect(field(tab, 'padding-top-inherited')).toHaveCount(0);

  await pickFrame(tab, 'Desktop');
  await expect(tab.getByTestId('field-padding-top-input')).toHaveValue('24');
  await expect(field(tab, 'padding-top-override')).toHaveCount(0);
});

test('R-IN-02: the override dot shows the base value and clears the override', async ({ page }) => {
  const tab = await open(page);
  await pickFrame(tab, 'Mobile');
  await typePx(tab, 'padding-top', '8');
  await expectSaved((r) => card(r)?.responsive?.sm?.padding?.top, { px: 8 });

  await field(tab, 'padding-top-override').click();
  await expect(field(tab, 'padding-top-base')).toContainText('24');
  await field(tab, 'padding-top-clear').click();

  await expectSaved((r) => card(r)?.responsive?.sm?.padding, undefined);
  await expect(tab.getByTestId('field-padding-top-input')).toHaveValue('24');
});

test('R-IN-05: an invalid value is refused, marked and not saved', async ({ page }) => {
  const tab = await open(page);

  await typePx(tab, 'padding-top', '-5');

  await expect(tab.getByTestId('field-padding-top-input')).toHaveAttribute('aria-invalid', 'true');
  await expect(undoButton(tab)).toBeDisabled();
  await expectSaved((r) => card(r)?.style?.padding?.top, { px: 24 });
});

test('R-IN-04: scrubbing the label changes the value as one Undo step', async ({ page }) => {
  const tab = await open(page);
  const label = field(tab, 'padding-top-label');
  const box = (await label.boundingBox()) ?? undefined;
  if (box === undefined) throw new Error('the label is not on screen');

  await tab.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await tab.mouse.down();
  for (let step = 1; step <= 10; step++) {
    await tab.mouse.move(box.x + box.width / 2 + step * 6, box.y + box.height / 2);
  }
  await tab.mouse.up();

  await expect
    .poll(async () => Number(await tab.getByTestId('field-padding-top-input').inputValue()))
    .toBeGreaterThan(24);
  await undoButton(tab).click();
  await expectSaved((r) => card(r)?.style?.padding?.top, { px: 24 });
  await expect(undoButton(tab)).toBeDisabled();
});

test('the Layout group changes the direction of a Stack; the page root stays a column (V-20)', async ({
  page,
}) => {
  const tab = await open(page);

  // V-20: the page root is always a column Stack, so its direction cannot be changed.
  await tab.getByTestId(`layer-row-${ROOT}`).click();
  await expect(tab.getByTestId('field-direction-input')).toBeDisabled();

  await tab.getByTestId(`layer-row-${ROW}`).click();
  await tab.getByTestId('field-direction-input').selectOption('column');

  await expectSaved((r) => findIn(r, ROW)?.style?.direction, 'column');
});

test('V-28, SPEC-03 4.5: a state shows only the properties a state can change', async ({
  page,
}) => {
  const tab = await open(page);

  await tab.getByTestId('inspector-state').selectOption('hover');
  await expect(tab.getByTestId('inspector-scope')).toContainText('Hover');
  await expect(tab.getByTestId('field-padding-top')).toHaveCount(0);
  await typePx(tab, 'opacity', '50');

  await expectSaved((r) => card(r)?.states?.hover?.opacity, 50);
  await expectSaved((r) => card(r)?.style?.opacity, undefined);
});
