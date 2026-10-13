// A small page with a known shape for Canvas E2E tests, and helpers that read what was saved.
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';

import { expect, type Locator, type Page } from '@playwright/test';
import { type DesignDocument, type DesignNode, documentToFiles } from '@reactcraft/model';

import allNodesFixture from '../../fixtures/designs/all-nodes.json' with { type: 'json' };
import { canvasFrame } from './canvas-studio.ts';

export const PAGE_ID = 'p_home000001';
export const ROOT = 'n_dndroot001';
export const CARD = 'n_dndcard001';
export const BUTTON = 'n_dndbtn0001';
export const ROW = 'n_dndrow0001';
export const ROW_A = 'n_dndbtnr001';
export const ROW_B = 'n_dndbtnr002';

export const button = (id: string, text: string): DesignNode => ({
  id,
  type: 'Button',
  content: { kind: 'button', text, variant: 'primary' },
  style: { padding: { top: { px: 8 }, right: { px: 16 }, bottom: { px: 8 }, left: { px: 16 } } },
});

/** Root (column) > Card (with a Text), Button, Row (two Buttons). */
export function smallPage(): DesignNode {
  const pad = { top: { px: 24 }, right: { px: 24 }, bottom: { px: 24 }, left: { px: 24 } };
  return {
    id: ROOT,
    type: 'Stack',
    content: { kind: 'none' },
    style: { direction: 'column', gap: { px: 24 }, padding: pad },
    children: [
      {
        id: CARD,
        type: 'Card',
        content: { kind: 'none' },
        style: { direction: 'column', padding: pad, background: '#f1f5f9' },
        children: [
          { id: 'n_dndtext001', type: 'Text', content: { kind: 'text', text: 'Inside the card' } },
        ],
      },
      button(BUTTON, 'Lone button'),
      {
        id: ROW,
        type: 'Stack',
        content: { kind: 'none' },
        style: { direction: 'row', gap: { px: 16 }, padding: pad },
        children: [button(ROW_A, 'Row A'), button(ROW_B, 'Row B')],
      },
    ],
  };
}

export async function writeSmallWorkspace(
  dir: string,
  root: DesignNode = smallPage(),
): Promise<void> {
  const doc = structuredClone(allNodesFixture) as unknown as DesignDocument;
  const home = doc.pages[PAGE_ID];
  if (home === undefined) throw new Error('fixture has no home page');
  home.root = root;
  for (const [relativePath, content] of Object.entries(documentToFiles(doc))) {
    const fullPath = join(dir, relativePath);
    await mkdir(dirname(fullPath), { recursive: true });
    await writeFile(fullPath, content, 'utf8');
  }
}

export async function savedRoot(dir: string): Promise<DesignNode> {
  const file = join(dir, '.reactcraft', 'pages', `${PAGE_ID}.json`);
  return (JSON.parse(await readFile(file, 'utf8')) as { root: DesignNode }).root;
}

export const childIds = (node: DesignNode | undefined) => (node?.children ?? []).map((c) => c.id);
export const childTypes = (node: DesignNode | undefined) =>
  (node?.children ?? []).map((c) => c.type);
export const findIn = (node: DesignNode, id: string): DesignNode | undefined =>
  node.id === id ? node : (node.children ?? []).map((c) => findIn(c, id)).find(Boolean);

/** Waits until the saved page satisfies `check` (writes reach the disk within 2 s). */
export async function expectSaved(
  dir: string,
  check: (root: DesignNode) => unknown,
  expected: unknown,
) {
  await expect.poll(async () => check(await savedRoot(dir)), { timeout: 8000 }).toEqual(expected);
}

export const undoButton = (tab: Page) => tab.getByRole('button', { name: /hoàn tác|undo/i });

/** Centre of an element inside the Canvas, in page coordinates. */
export async function centreOf(target: Locator, dy = 0) {
  const box = (await target.boundingBox()) ?? undefined;
  if (box === undefined) throw new Error('element is not on screen');
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 + dy };
}

/** Drags `source` to `to` with the mouse, in steps, as a person does (dnd-kit needs moves). */
export async function dragTo(
  tab: Page,
  source: Locator,
  to: { x: number; y: number },
  drop = true,
) {
  await source.scrollIntoViewIfNeeded();
  const from = await centreOf(source);
  await tab.mouse.move(from.x, from.y);
  await tab.mouse.down();
  await tab.mouse.move(from.x + 8, from.y + 8, { steps: 2 });
  await tab.mouse.move(to.x, to.y, { steps: 8 });
  await tab.mouse.move(to.x + 1, to.y + 1);
  if (drop) await tab.mouse.up();
}

export async function openLibrary(tab: Page) {
  await tab.getByRole('tab', { name: /thư viện|library/i }).click();
  await expect(tab.getByTestId('library-panel')).toBeVisible();
}

export async function selectOnCanvas(
  tab: Page,
  id: string,
  modifiers: ('Shift' | 'Control')[] = [],
) {
  await canvasFrame(tab)
    .locator(`[data-rc-node="${id}"]`)
    .click({ modifiers: [...modifiers, 'Control'] });
  await expect(tab.locator(`[data-testid="selection-box"][data-node-id="${id}"]`)).toBeVisible();
}
