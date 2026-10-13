// Drag and drop on the Canvas (AC-02, SPEC-04.1 section 9). Each test reads the saved page file to
// check what really changed, not only what the screen shows.
import { expect, type Page, test } from '@playwright/test';
import type { DesignNode } from '@reactcraft/model';

import { canvasFrame, openCanvasStudio } from './support/canvas-studio.ts';
import { type CliSession, startCli } from './support/cli-session.ts';
import { makeTempDir, type TempDir } from './support/copy-fixture.ts';
import {
  BUTTON,
  button,
  CARD,
  centreOf,
  childIds,
  childTypes,
  dragTo,
  expectSaved as expectSavedIn,
  findIn,
  openLibrary,
  ROOT,
  ROW,
  ROW_A,
  ROW_B,
  savedRoot,
  selectOnCanvas,
  smallPage,
  undoButton,
  writeSmallWorkspace,
} from './support/small-page.ts';

let workspace: TempDir;
let config: TempDir;
const sessions: CliSession[] = [];

const expectSaved = (check: (root: DesignNode) => unknown, expected: unknown) =>
  expectSavedIn(workspace.path, check, expected);

test.beforeEach(async ({ browserName }) => {
  workspace = await makeTempDir(`dnd-${browserName}`);
  config = await makeTempDir(`dnd-config-${browserName}`);
  await writeSmallWorkspace(workspace.path);
});

test.afterEach(async () => {
  for (const session of sessions.splice(0)) await session.stop();
  await workspace.remove();
  await config.remove();
});

async function open(page: Page): Promise<Page> {
  const session = await startCli(workspace.path, config.path);
  sessions.push(session);
  return openCanvasStudio(page, session);
}

test('AC-02: Section, Card and Button dragged from the Library land in the page, one Undo each', async ({
  page,
}) => {
  const tab = await open(page);
  await openLibrary(tab);
  const root = canvasFrame(tab).locator(`[data-rc-node="${ROOT}"]`);

  for (const [n, item] of ['section', 'card', 'button'].entries()) {
    // Inside the root's bottom padding, below its last child: the end of the page. Measured only
    // after the previous drop is saved and drawn, so its new styles have moved things already.
    await expectSaved((r) => childIds(r).length, 3 + n);
    await tab.evaluate(
      () => new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done))),
    );
    const box = await root.boundingBox();
    await dragTo(tab, tab.getByTestId(`library-item-${item}`), {
      x: (box?.x ?? 0) + (box?.width ?? 0) / 2,
      y: (box?.y ?? 0) + (box?.height ?? 0) - 8,
    });
    await expect(undoButton(tab)).toBeEnabled();
  }

  await expectSaved((r) => childTypes(r).slice(3), ['Section', 'Card', 'Button']);
  await expect(tab.getByTestId('selected-id')).not.toHaveText('');
  await undoButton(tab).click();
  await expectSaved((r) => childTypes(r).slice(3), ['Section', 'Card']);
});

test('AC-02: a Modal dropped on a Card never goes inside the Card', async ({ page }) => {
  const tab = await open(page);
  await openLibrary(tab);
  const card = canvasFrame(tab).locator(`[data-rc-node="${CARD}"]`);

  await dragTo(tab, tab.getByTestId('library-item-modal'), await centreOf(card), false);
  await expect(tab.getByTestId('drop-indicator-label')).not.toContainText('Card');
  await tab.mouse.up();

  await expectSaved((r) => childIds(findIn(r, CARD)), ['n_dndtext001']);
});

test('reorders by dragging the label of the selection box', async ({ page }) => {
  const tab = await open(page);
  await selectOnCanvas(tab, BUTTON);
  const card = canvasFrame(tab).locator(`[data-rc-node="${CARD}"]`);
  const cardBox = await card.boundingBox();

  await dragTo(tab, tab.getByTestId('selection-label'), {
    x: (cardBox?.x ?? 0) + (cardBox?.width ?? 0) / 2,
    y: (cardBox?.y ?? 0) + 3,
  });

  await expectSaved((r) => childIds(r), [BUTTON, CARD, ROW]);
  await undoButton(tab).click();
  await expectSaved((r) => childIds(r), [CARD, BUTTON, ROW]);
});

test('R-DD-03, R-DD-04: Escape and dropping in place change nothing', async ({ page }) => {
  const tab = await open(page);
  await openLibrary(tab);
  const card = canvasFrame(tab).locator(`[data-rc-node="${CARD}"]`);

  await dragTo(tab, tab.getByTestId('library-item-button'), await centreOf(card), false);
  await tab.keyboard.press('Escape');
  await tab.mouse.up();

  await selectOnCanvas(tab, BUTTON);
  const label = tab.getByTestId('selection-label');
  const here = await centreOf(canvasFrame(tab).locator(`[data-rc-node="${BUTTON}"]`));
  await dragTo(tab, label, here);

  await expect(undoButton(tab)).toBeDisabled();
  await expectSaved((r) => childIds(r), [CARD, BUTTON, ROW]);
});

test('R-DD-05: two selected siblings move together and keep their order', async ({ page }) => {
  const tab = await open(page);
  await selectOnCanvas(tab, ROW_A);
  await selectOnCanvas(tab, ROW_B, ['Shift']);
  const card = canvasFrame(tab).locator(`[data-rc-node="${CARD}"]`);

  await dragTo(tab, tab.getByTestId('selection-label').first(), await centreOf(card));

  await expectSaved((r) => childIds(findIn(r, CARD)).slice(-2), [ROW_A, ROW_B]);
  await expectSaved((r) => childIds(findIn(r, ROW)), []);
});

test('R-DD-06: a node can be moved with the keyboard only', async ({ page }) => {
  const tab = await open(page);
  await selectOnCanvas(tab, BUTTON);

  await tab.getByTestId('selection-label').focus();
  // Stops in tree order: before Card, before Row (where the Button already is), end of the page.
  await tab.keyboard.press('Space');
  // dnd-kit listens for the arrow keys one tick after the drag starts (VG-11): wait for the drag,
  // and type at a person's pace.
  await expect(tab.getByTestId('canvas-iframe')).toHaveCSS('pointer-events', 'none');
  for (let i = 0; i < 3; i++) {
    await tab.waitForTimeout(80);
    await tab.keyboard.press('ArrowDown');
  }
  await tab.waitForTimeout(80);
  await tab.keyboard.press('Space');

  await expectSaved((r) => childIds(r), [CARD, ROW, BUTTON]);
  await undoButton(tab).click();
  await expectSaved((r) => childIds(r), [CARD, BUTTON, ROW]);
});

test('drops in the right place when the frame is shown at a small zoom', async ({ page }) => {
  await page.setViewportSize({ width: 1100, height: 800 });
  const tab = await open(page);
  await openLibrary(tab);
  const row = canvasFrame(tab).locator(`[data-rc-node="${ROW}"]`);

  await dragTo(tab, tab.getByTestId('library-item-button'), await centreOf(row));

  await expectSaved((r) => childTypes(findIn(r, ROW)), ['Button', 'Button', 'Button']);
});

test('R-DD-02: holding a drag near the bottom edge scrolls the Canvas', async ({
  page,
  browserName,
}) => {
  // Harness time, not a budget: a long held drag is slow in WebKit on Windows under load.
  test.slow(browserName === 'webkit');
  // A page taller than the Canvas area, so the area can scroll.
  const tall = smallPage();
  const extra = Array.from({ length: 40 }, (_, i) =>
    button(`n_dndtall${String(i).padStart(3, '0')}`, `Extra ${String(i)}`),
  );
  await writeSmallWorkspace(workspace.path, {
    ...tall,
    children: [...(tall.children ?? []), ...extra],
  });
  const tab = await open(page);
  await openLibrary(tab);
  const area = tab.getByTestId('editor');
  const box = await area.boundingBox();
  expect(await area.evaluate((el) => el.scrollHeight > el.clientHeight)).toBe(true);

  await dragTo(
    tab,
    tab.getByTestId('library-item-button'),
    { x: (box?.x ?? 0) + (box?.width ?? 0) / 2, y: (box?.y ?? 0) + (box?.height ?? 0) - 10 },
    false,
  );
  await expect.poll(() => area.evaluate((el) => el.scrollTop)).toBeGreaterThan(40);
  await tab.keyboard.press('Escape');
  await tab.mouse.up();
});

test('a double click on a Library item adds it at the end of the page and selects it', async ({
  page,
}) => {
  const tab = await open(page);
  await openLibrary(tab);

  await tab.getByTestId('library-item-button').dblclick();

  await expectSaved((r) => childTypes(r).at(-1), 'Button');
  const id = (await savedRoot(workspace.path)).children?.at(-1)?.id ?? '';
  await expect(tab.getByTestId('selected-id')).toHaveText(id);
});
