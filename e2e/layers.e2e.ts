// Layer Tree (SPEC-04.1 section 12, R-LT-01 to R-LT-07). Each test checks the saved page file.
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';

import { expect, type Page, test } from '@playwright/test';
import { type DesignNode, documentToFiles } from '@reactcraft/model';

import { generateLargeWorkspace } from '../scripts/gen-large-workspace.ts';
import { canvasFrame, openCanvasStudio } from './support/canvas-studio.ts';
import { type CliSession, startCli } from './support/cli-session.ts';
import { makeTempDir, type TempDir } from './support/copy-fixture.ts';
import {
  BUTTON,
  CARD,
  childIds,
  dragTo,
  expectSaved as expectSavedIn,
  findIn,
  ROOT,
  ROW,
  savedRoot,
  undoButton,
  writeSmallWorkspace,
} from './support/small-page.ts';

let workspace: TempDir;
let config: TempDir;
const sessions: CliSession[] = [];

const expectSaved = (check: (root: DesignNode) => unknown, expected: unknown) =>
  expectSavedIn(workspace.path, check, expected);
const row = (tab: Page, id: string) => tab.getByTestId(`layer-row-${id}`);

async function open(page: Page): Promise<Page> {
  const session = await startCli(workspace.path, config.path);
  sessions.push(session);
  const tab = await openCanvasStudio(page, session);
  await expect(row(tab, ROOT)).toBeVisible();
  return tab;
}

async function menuAction(tab: Page, id: string, action: string) {
  await row(tab, id).click({ button: 'right' });
  await tab.getByTestId(`context-menu-${action}`).click();
}

test.beforeEach(async ({ browserName }) => {
  workspace = await makeTempDir(`layers-${browserName}`);
  config = await makeTempDir(`layers-config-${browserName}`);
});

test.afterEach(async () => {
  for (const session of sessions.splice(0)) await session.stop();
  await workspace.remove();
  await config.remove();
});

test('R-LT-04: renames with a double click or F2; Escape keeps the old name', async ({ page }) => {
  await writeSmallWorkspace(workspace.path);
  const tab = await open(page);

  await row(tab, CARD).dblclick();
  await tab.getByTestId('layer-rename-input').fill('Hero card');
  await tab.getByTestId('layer-rename-input').press('Enter');
  await expectSaved((r) => findIn(r, CARD)?.name, 'Hero card');

  await row(tab, BUTTON).click();
  await tab.keyboard.press('F2');
  await tab.getByTestId('layer-rename-input').fill('Not kept');
  await tab.getByTestId('layer-rename-input').press('Escape');
  await expect(tab.getByTestId('layer-rename-input')).toHaveCount(0);
  await expect(row(tab, BUTTON)).not.toContainText('Not kept');
  await expectSaved((r) => findIn(r, BUTTON)?.name, undefined);
});

test('R-LT-02: hides and locks a node, each one Undo step', async ({ page }) => {
  await writeSmallWorkspace(workspace.path);
  const tab = await open(page);
  const canvas = canvasFrame(tab);

  await row(tab, CARD).hover();
  await tab.getByTestId(`layer-hide-${CARD}`).click();
  await expectSaved((r) => findIn(r, CARD)?.hidden, true);
  await expect(canvas.locator(`[data-rc-node="${CARD}"]`)).toHaveCount(0);
  await undoButton(tab).click();
  await expect(canvas.locator(`[data-rc-node="${CARD}"]`)).toHaveCount(1);

  await row(tab, BUTTON).hover();
  await tab.getByTestId(`layer-lock-${BUTTON}`).click();
  await expectSaved((r) => findIn(r, BUTTON)?.locked, true);
  // A locked node is skipped when picking on the Canvas (SPEC-04.1 section 8.2).
  await canvas.locator(`[data-rc-node="${BUTTON}"]`).click({ modifiers: ['Control'] });
  await expect(tab.getByTestId('selected-id').filter({ hasText: BUTTON })).toHaveCount(0);
});

test('R-LT-06: duplicate, wrap, unwrap and delete from the context menu', async ({ page }) => {
  await writeSmallWorkspace(workspace.path);
  const tab = await open(page);

  await menuAction(tab, BUTTON, 'duplicate');
  await expectSaved((r) => childIds(r).length, 4);

  await menuAction(tab, BUTTON, 'wrap-row');
  const wrapperOf = (r: DesignNode) => r.children?.find((c) => childIds(c).includes(BUTTON));
  await expectSaved((r) => wrapperOf(r)?.type, 'Stack');
  const wrapperId = wrapperOf(await savedRoot(workspace.path))?.id ?? '';
  await menuAction(tab, wrapperId, 'unwrap');
  await expectSaved((r) => childIds(r).includes(BUTTON), true);

  await menuAction(tab, BUTTON, 'delete');
  await expectSaved((r) => JSON.stringify(r).includes(BUTTON), false);

  await row(tab, CARD).click({ button: 'right' });
  await expect(tab.getByTestId('context-menu-copy')).toBeDisabled();
  await expect(tab.getByTestId('context-menu-paste')).toBeDisabled();
});

test('R-LT-05: reorders by dragging a row', async ({ page }) => {
  await writeSmallWorkspace(workspace.path);
  const tab = await open(page);
  const cardRow = await row(tab, CARD).boundingBox();

  await dragTo(tab, row(tab, ROW), {
    x: (cardRow?.x ?? 0) + (cardRow?.width ?? 0) / 2,
    y: (cardRow?.y ?? 0) + 2,
  });

  await expectSaved((r) => childIds(r), [ROW, CARD, BUTTON]);
});

test('R-LT-01, R-LT-03: on a 500-node page, picking a deep node opens and scrolls the tree to it', async ({
  page,
}) => {
  const doc = generateLargeWorkspace(1, 500, 1);
  for (const [relativePath, content] of Object.entries(documentToFiles(doc))) {
    const fullPath = join(workspace.path, relativePath);
    await mkdir(dirname(fullPath), { recursive: true });
    await writeFile(fullPath, content, 'utf8');
  }
  const session = await startCli(workspace.path, config.path);
  sessions.push(session);
  const tab = await openCanvasStudio(page, session);
  const canvas = canvasFrame(tab);

  // Virtualised: far fewer rows in the DOM than nodes on the page.
  await expect(tab.locator('[data-testid^="layer-row-"]').first()).toBeVisible();
  expect(await tab.locator('[data-testid^="layer-row-"]').count()).toBeLessThan(150);

  const deep = canvas.locator('[data-rc-node]').nth(450);
  const deepId = (await deep.getAttribute('data-rc-node')) ?? '';
  await deep.click({ modifiers: ['Control'] });

  await expect(row(tab, deepId)).toBeVisible();
  await expect(row(tab, deepId)).toHaveAttribute('aria-selected', 'true');

  // And the other way: a row picked in the tree is selected on the Canvas.
  const firstRow = tab.locator('[data-testid^="layer-row-"]').nth(3);
  const firstId = ((await firstRow.getAttribute('data-testid')) ?? '').replace('layer-row-', '');
  await firstRow.click();
  await expect(
    tab.locator(`[data-testid="selection-box"][data-node-id="${firstId}"]`),
  ).toBeVisible();
});
