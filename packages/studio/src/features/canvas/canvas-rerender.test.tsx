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
});
