// PB-01 (SPEC-01.1 section 11.2): validate + apply one operation on a 500-node page, P95 ≤ 5 ms.
import { expect, test } from 'vitest';

import allNodes from '../../../../fixtures/designs/all-nodes.json' with { type: 'json' };
import type { DesignDocument, Page } from '../schema/document.schema.ts';
import type { DesignNode } from '../schema/node.schema.ts';
import { applyOperation } from './engine.ts';
import type { DesignOperation } from './operation.schema.ts';
import { validateOperation } from './validate-operation.ts';

const PAGE = 'p_bench00001';
let counter = 0;
const id = () => `n_bench${String(++counter).padStart(5, '0')}`;

const n = (
  type: DesignNode['type'],
  content: DesignNode['content'],
  extra: Partial<DesignNode> = {},
): DesignNode => ({ id: id(), type, content, ...extra });

/** Section > Container > Grid > 30 cards of 4 nodes: 123 nodes per section. */
function section(): DesignNode {
  const cards = Array.from({ length: 30 }, () =>
    n(
      'Card',
      { kind: 'none' },
      {
        style: { gap: 'token:spacing.2', padding: { top: 'token:spacing.4' } },
        children: [
          n('Heading', { kind: 'heading', text: 'Title', level: 3 }),
          n('Text', { kind: 'text', text: 'Body' }),
          n('Button', { kind: 'button', text: 'Buy', variant: 'primary' }),
        ],
      },
    ),
  );
  const grid = n('Grid', { kind: 'none' }, { style: { columns: 3 }, children: cards });
  const container = n('Container', { kind: 'container', maxWidth: 'xl' }, { children: [grid] });
  return n('Section', { kind: 'section' }, { children: [container] });
}

const root: DesignNode = { id: id(), type: 'Stack', content: { kind: 'none' }, children: [] };
while (counter + 123 <= 500) root.children?.push(section());
while (counter < 500)
  root.children?.push({ id: id(), type: 'Text', content: { kind: 'text', text: 'Filler' } });

const base = allNodes as unknown as DesignDocument;
const page: Page = { schemaVersion: 1, id: PAGE, name: 'Bench', route: '/', root };
const document: DesignDocument = {
  ...base,
  pages: { [PAGE]: page },
  components: {},
  workspace: { ...base.workspace, pageOrder: [PAGE] },
};
const cardId = root.children?.[0]?.children?.[0]?.children?.[0]?.children?.[10]?.id ?? '';
const op: DesignOperation = {
  op: 'setStyle',
  target: { kind: 'page', pageId: PAGE },
  nodeId: cardId,
  scope: { breakpoint: 'md' },
  set: { gap: { px: 12 } },
};

test('PB-01: validate and apply setStyle on a 500-node page', async ({ bench }) => {
  expect(counter).toBe(500);
  expect(validateOperation(document, op).ok).toBe(true);

  const result = await bench('validate + apply one operation', () => {
    validateOperation(document, op);
    applyOperation(document, op);
  }).run();

  expect(result.name).toBe('validate + apply one operation');
});
