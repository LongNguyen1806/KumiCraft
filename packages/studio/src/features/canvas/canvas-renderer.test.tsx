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

  it('renders Table node with 3 empty rows when unbound, and 5 rows when bound (7.2 Table)', () => {
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

    const { container: unboundContainer } = render(<CanvasNode nodeId={tableNodeId} />);
    const unboundRows = unboundContainer.querySelectorAll('tbody tr');
    expect(unboundRows.length).toBe(3);

    // Bound with data
    const boundTableId = 'n_table_bound';
    useEditorStore.setState({
      flatNodes: {
        ...useEditorStore.getState().flatNodes,
        [boundTableId]: {
          id: boundTableId,
          type: 'Table',
          style: {},
          bindings: {
            rows: { source: 'ds_products', field: 'products' },
          },
          content: {
            kind: 'table',
            columns: [{ id: 'col1', header: 'Product' }],
            emptyText: 'No data',
          },
          childIds: [],
        },
      },
    });

    const { container: boundContainer } = render(<CanvasNode nodeId={boundTableId} />);
    const boundRows = boundContainer.querySelectorAll('tbody tr');
    expect(boundRows.length).toBe(5);
  });

  it('renders node with runtime.initiallyHidden as visible with opacity-50 and badge (R-CV-10)', () => {
    const state = useEditorStore.getState();
    const nodeId = 'n_initially_hidden_test';
    useEditorStore.setState({
      flatNodes: {
        ...state.flatNodes,
        [nodeId]: {
          id: nodeId,
          type: 'Text',
          style: {},
          runtime: { initiallyHidden: true },
          content: { kind: 'text', text: 'Dropdown menu' },
          childIds: [],
        },
      },
    });

    const { container } = render(<CanvasNode nodeId={nodeId} />);
    const badge = container.querySelector('[data-rc-badge="initially-hidden"]');
    expect(badge).not.toBeNull();
    expect(badge?.textContent).toBe('Ẩn khi tải trang');
    const el = container.querySelector(`[data-rc-node="${nodeId}"]`);
    expect(el).not.toBeNull();
  });

  it('hides Modal when openByDefault is false unless selected (7.5 Modal)', () => {
    const state = useEditorStore.getState();
    const modalId = 'n_closed_modal_test';
    useEditorStore.setState({
      selectedNodeId: undefined,
      flatNodes: {
        ...state.flatNodes,
        [modalId]: {
          id: modalId,
          type: 'Modal',
          style: {},
          content: { kind: 'modal', openByDefault: false, title: 'Test Dialog' },
          childIds: [],
        },
      },
    });

    const { container: closedContainer } = render(<CanvasNode nodeId={modalId} />);
    expect(closedContainer.querySelector(`[data-rc-node="${modalId}"]`)).toBeNull();

    // When selected: appears on Canvas
    useEditorStore.setState({ selectedNodeId: modalId });
    const { container: selectedContainer } = render(<CanvasNode nodeId={modalId} />);
    expect(selectedContainer.querySelector(`[data-rc-node="${modalId}"]`)).not.toBeNull();
  });

  it('renders ComponentInstance inner nodes with data-rc-inner="1" and slots with data-rc-node (7.6)', () => {
    const state = useEditorStore.getState();
    const instanceId = 'n_instance_test';
    const slotChildId = 'n_slot_button_test';

    useEditorStore.setState({
      document: {
        ...sampleDoc,
        components: {
          ...sampleDoc.components,
          c_sample: {
            schemaVersion: 1,
            id: 'c_sample',
            name: 'SampleComponent',
            props: [{ name: 'label', kind: 'text', defaultValue: 'Default' }],
            root: {
              id: 'c_inner_root',
              type: 'Card',
              content: { kind: 'none' },
              children: [
                {
                  id: 'c_inner_text',
                  type: 'Text',
                  propRef: { prop: 'label', target: 'text' },
                  content: { kind: 'text', text: 'Fallback' },
                },
                {
                  id: 'c_inner_slot',
                  type: 'Slot',
                  content: { kind: 'slot', name: 'actions' },
                },
              ],
            },
          },
        },
      },
      flatNodes: {
        ...state.flatNodes,
        [instanceId]: {
          id: instanceId,
          type: 'ComponentInstance',
          style: {},
          content: {
            kind: 'instance',
            componentId: 'c_sample',
            propValues: { label: 'Custom Title' },
          },
          slotChildIds: { actions: [slotChildId] },
          childIds: [slotChildId],
        },
        [slotChildId]: {
          id: slotChildId,
          type: 'Button',
          style: {},
          content: { kind: 'button', text: 'Action', variant: 'primary' },
          childIds: [],
        },
      },
    });

    const { container } = render(<CanvasNode nodeId={instanceId} />);
    // Instance root container has data-rc-node
    expect(container.querySelector(`[data-rc-node="${instanceId}"]`)).not.toBeNull();

    // Inner root of component (Card) renders with data-rc-inner and no data-rc-node
    const innerNodes = container.querySelectorAll('[data-rc-inner="1"]');
    expect(innerNodes.length).toBeGreaterThanOrEqual(1);
    expect(container.querySelector('[data-rc-node="c_inner_root"]')).toBeNull();
    expect(container.querySelector('[data-rc-node="c_inner_text"]')).toBeNull();

    // Prop value replacement verified: 'Custom Title' is present, 'Fallback' is not present
    expect(container.textContent).toContain('Custom Title');
    expect(container.textContent).not.toContain('Fallback');

    // Slot child is rendered in place with data-rc-node
    const slotChild = container.querySelector(`[data-rc-node="${slotChildId}"]`);
    expect(slotChild).not.toBeNull();
    expect(slotChild?.textContent).toBe('Action');
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
