import type { DesignDocument } from '@reactcraft/model';
import { act, cleanup, render } from '@testing-library/react';
import i18next from 'i18next';
import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import allNodesFixture from '../../../../../fixtures/designs/all-nodes.json' with { type: 'json' };
import { initI18n } from '../../i18n/i18n.ts';
import { useEditorStore } from '../../store/editor-store.ts';
import { CanvasNode } from './canvas-node.tsx';
import { NODE_RENDERERS } from './node-registry/index.ts';

const document = allNodesFixture as unknown as DesignDocument;
const original = { ...NODE_RENDERERS };
const renders = new Map<string, number>();

/** Counts how many times each node's renderer runs. */
function countRenders() {
  for (const [type, Renderer] of Object.entries(original)) {
    (NODE_RENDERERS as Record<string, typeof Renderer>)[type] = (props) => {
      renders.set(props.node.id, (renders.get(props.node.id) ?? 0) + 1);
      return Renderer(props);
    };
  }
}

/** The page that holds the most Text nodes, so there are siblings to compare. */
function pageWithTexts() {
  const [pageId, page] =
    Object.entries(document.pages).find(([, p]) => JSON.stringify(p).includes('"Text"')) ?? [];
  if (pageId === undefined || page === undefined) throw new Error('fixture has no Text node');
  return { pageId, rootId: page.root.id };
}

/** A Text node that was drawn and has no formatted runs, so a plain `text` change is valid. */
function drawnPlainTextId(): string {
  const { flatNodes } = useEditorStore.getState();
  const found = [...renders.keys()].find((id) => {
    const node = flatNodes[id];
    return (
      node?.type === 'Text' && node.content?.kind === 'text' && node.content.runs === undefined
    );
  });
  if (found === undefined) throw new Error('no drawn plain Text node in the fixture');
  return found;
}

describe('Canvas re-render (R-CV-05)', () => {
  beforeAll(async () => {
    await initI18n();
  });

  beforeEach(async () => {
    await i18next.changeLanguage('en');
    renders.clear();
    countRenders();
    useEditorStore.getState().loadDocument(document, 1);
  });

  afterEach(() => {
    cleanup();
    Object.assign(NODE_RENDERERS, original);
  });

  it('re-renders only the node whose content changed [R-CV-05]', () => {
    const { pageId, rootId } = pageWithTexts();
    useEditorStore.getState().setActivePageId(pageId);
    render(<CanvasNode nodeId={rootId} />);
    const textId = drawnPlainTextId();
    const before = new Map(renders);
    expect(before.size).toBeGreaterThan(3);

    act(() => {
      const result = useEditorStore.getState().dispatch(
        [
          {
            op: 'setContent',
            target: { kind: 'page', pageId },
            nodeId: textId,
            set: { text: 'Changed' },
          },
        ],
        { source: 'user', label: 'Edit text' },
      );
      expect(result.ok).toBe(true);
    });

    const rerendered = [...renders]
      .filter(([id, count]) => count !== before.get(id))
      .map(([id]) => id);
    expect(rerendered).toEqual([textId]);
  });

  it('re-renders only the changed node inside ComponentInstance slot [R-CV-05]', () => {
    const pageId = 'p_inst_page1';
    const rootId = 'n_root_inst1';
    const instanceId = 'n_inst_node1';
    const slotButtonId = 'n_slot_btn01';
    const listId = 'n_list_node1';
    const componentId = 'c_cardsampl1';

    const testDoc: DesignDocument = {
      ...document,
      workspace: {
        ...document.workspace,
        pageOrder: [...document.workspace.pageOrder, pageId],
      },
      components: {
        ...document.components,
        [componentId]: {
          schemaVersion: 1,
          id: componentId,
          name: 'Card',
          props: [],
          root: {
            id: 'n_card_root1',
            type: 'Card',
            content: { kind: 'none' },
            children: [
              {
                id: 'n_card_slot1',
                type: 'Slot',
                content: { kind: 'slot', name: 'content' },
              },
            ],
          },
        },
      },
      pages: {
        ...document.pages,
        [pageId]: {
          schemaVersion: 1,
          id: pageId,
          name: 'Instance Page',
          route: '/instance',
          root: {
            id: rootId,
            type: 'Stack',
            content: { kind: 'none' },
            children: [
              {
                id: listId,
                type: 'List',
                content: {
                  kind: 'list',
                  emptyText: 'Empty',
                  loadingText: 'Loading',
                  errorText: 'Error',
                  dataOptions: { pageSize: 5 },
                },
                children: [
                  {
                    id: 'n_list_item1',
                    type: 'Text',
                    content: { kind: 'text', as: 'p', text: 'Item' },
                    children: [],
                  },
                ],
              },
              {
                id: instanceId,
                type: 'ComponentInstance',
                content: { kind: 'instance', componentId, propValues: {} },
                slots: {
                  content: [
                    {
                      id: slotButtonId,
                      type: 'Button',
                      content: {
                        kind: 'button',
                        text: 'Slot Button',
                        buttonType: 'button',
                        variant: 'primary',
                      },
                      children: [],
                    },
                  ],
                },
                children: [],
              },
            ],
          },
        },
      },
    };

    useEditorStore.getState().loadDocument(testDoc, 1);
    useEditorStore.getState().setActivePageId(pageId);
    render(<CanvasNode nodeId={rootId} />);

    const before = new Map(renders);
    expect(before.has(slotButtonId)).toBe(true);

    act(() => {
      const result = useEditorStore.getState().dispatch(
        [
          {
            op: 'setContent',
            target: { kind: 'page', pageId },
            nodeId: slotButtonId,
            set: { text: 'Updated Slot Button' },
          },
        ],
        { source: 'user', label: 'Edit slot button' },
      );
      expect(result.ok).toBe(true);
    });

    const rerendered = [...renders]
      .filter(([id, count]) => count !== before.get(id))
      .map(([id]) => id);
    expect(rerendered).toEqual([slotButtonId]);
  });

  // A token change may re-render nodes (rare, and their classes stay the same); what must not
  // happen is the store rebuilding every node record, which would hide real changes.
  it('keeps every node record when only a token changes [R-CV-07]', () => {
    const { pageId } = pageWithTexts();
    useEditorStore.getState().setActivePageId(pageId);
    const before = useEditorStore.getState().flatNodes;

    act(() => {
      const result = useEditorStore.getState().dispatch(
        [
          {
            op: 'token.set',
            group: 'color',
            name: 'primary',
            entry: { value: '#dc2626', label: 'Primary Red', dark: '#ef4444' },
          },
        ],
        { source: 'user', label: 'Update primary token' },
      );
      expect(result.ok).toBe(true);
    });

    const after = useEditorStore.getState().flatNodes;
    const changed = Object.keys(after).filter((id) => after[id] !== before[id]);
    expect(changed).toEqual([]);
    expect(useEditorStore.getState().document?.tokens.color['primary']?.value).toBe('#dc2626');
  });
});
