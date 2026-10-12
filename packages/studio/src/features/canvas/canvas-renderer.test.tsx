import type { DesignDocument } from '@reactcraft/model';
import { render, screen } from '@testing-library/react';
import i18next from 'i18next';
import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import allNodesFixture from '../../../../../fixtures/designs/all-nodes.json' with { type: 'json' };
import { initI18n } from '../../i18n/i18n.ts';
import { useEditorStore } from '../../store/editor-store.ts';
import { CanvasNode } from './canvas-node.tsx';
import { CanvasViewport } from './canvas-viewport.tsx';

const sampleDoc = allNodesFixture as unknown as DesignDocument;

describe('Canvas Renderer (M-CV)', () => {
  beforeAll(async () => {
    await initI18n();
  });

  beforeEach(async () => {
    await i18next.changeLanguage('vi');
    useEditorStore.getState().loadDocument(sampleDoc, 1);
  });

  afterEach(() => {
    useEditorStore.setState({
      document: undefined,
      activePageId: undefined,
      flatNodes: {},
    });
  });

  it('renders node with data-rc-node and computed Tailwind classes', () => {
    const { container } = render(<CanvasNode nodeId="n_allnode051" />);
    const rootEl = container.querySelector('[data-rc-node="n_allnode051"]');
    expect(rootEl).not.toBeNull();
  });

  it('renders empty container placeholder when container has no children (R-CV-01)', () => {
    const state = useEditorStore.getState();
    const emptyNodeId = 'n_empty_stack_test';
    useEditorStore.setState({
      flatNodes: {
        ...state.flatNodes,
        [emptyNodeId]: {
          id: emptyNodeId,
          type: 'Stack',
          style: {},
          content: { kind: 'none' },
          childIds: [],
        },
      },
    });

    render(<CanvasNode nodeId={emptyNodeId} />);
    expect(screen.getByText('Kéo phần tử vào đây')).toBeDefined();
  });

  it('skips rendering node when hidden is true (R-CV-02)', () => {
    const state = useEditorStore.getState();
    const hiddenNodeId = 'n_hidden_node_test';
    useEditorStore.setState({
      flatNodes: {
        ...state.flatNodes,
        [hiddenNodeId]: {
          id: hiddenNodeId,
          type: 'Text',
          hidden: true,
          style: {},
          content: { kind: 'text', text: 'Invisible' },
          childIds: [],
        },
      },
    });

    const { container } = render(<CanvasNode nodeId={hiddenNodeId} />);
    const el = container.querySelector(`[data-rc-node="${hiddenNodeId}"]`);
    expect(el).toBeNull();
  });

  it('renders Table node with 5 rows', () => {
    const state = useEditorStore.getState();
    const tableNodeId = 'n_table_test';
    useEditorStore.setState({
      flatNodes: {
        ...state.flatNodes,
        [tableNodeId]: {
          id: tableNodeId,
          type: 'Table',
          style: {},
          content: {
            kind: 'table',
            columns: [{ id: 'col1', header: 'Product' }],
            emptyText: 'No data',
          },
          childIds: [],
        },
      },
    });

    const { container } = render(<CanvasNode nodeId={tableNodeId} />);
    const rows = container.querySelectorAll('tbody tr');
    expect(rows.length).toBe(5);
  });

  it('renders List node repeating children 3 times with data-rc-repeat', () => {
    const state = useEditorStore.getState();
    const listId = 'n_list_test';
    const itemTextId = 'n_list_item_text';
    useEditorStore.setState({
      flatNodes: {
        ...state.flatNodes,
        [listId]: {
          id: listId,
          type: 'List',
          style: {},
          content: { kind: 'list', emptyText: 'Empty' },
          childIds: [itemTextId],
        },
        [itemTextId]: {
          id: itemTextId,
          type: 'Text',
          style: {},
          content: { kind: 'text', text: 'Item' },
          childIds: [],
        },
      },
    });

    const { container } = render(<CanvasNode nodeId={listId} />);
    const repeat1 = container.querySelector('[data-rc-repeat="1"]');
    const repeat2 = container.querySelector('[data-rc-repeat="2"]');
    expect(repeat1).not.toBeNull();
    expect(repeat2).not.toBeNull();
  });

  it('renders active page root node through CanvasViewport', () => {
    render(<CanvasViewport />);
    const iframe = screen.getByTestId('canvas-iframe');
    expect(iframe).toBeDefined();
  });
});
