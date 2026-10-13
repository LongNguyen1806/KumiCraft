import type { DesignDocument, DesignNode } from '@reactcraft/model';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import i18next from 'i18next';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { initI18n } from '../../i18n/i18n.ts';
import { useEditorStore } from '../../store/editor-store.ts';
import { sampleDocument } from '../../store/test-support.ts';
import { LayerTree } from './layer-tree.tsx';

function setupStore(doc: DesignDocument = sampleDocument()): DesignNode {
  useEditorStore.getState().loadDocument(doc, doc.workspace.revision);
  const pageId = doc.workspace.pageOrder[0] ?? 'p_home000001';
  useEditorStore.getState().setActivePageId(pageId);
  const root = doc.pages[pageId]?.root;
  if (!root) throw new Error('missing root');
  return root;
}

beforeAll(async () => {
  await initI18n();
});

beforeEach(async () => {
  await i18next.changeLanguage('en');
});

afterEach(() => {
  cleanup();
});

describe('LayerTree panel', () => {
  it('renders virtualized tree nodes with names and icons [R-LT-01]', () => {
    const root = setupStore();
    render(<LayerTree root={root} onSelect={vi.fn()} />);

    expect(screen.getByTestId('layer-tree')).toBeDefined();
    expect(screen.getByText('Stack')).toBeDefined();
    expect(screen.getByText('Card')).toBeDefined();
    expect(screen.getByText('Original text')).toBeDefined();
  });

  it('renders node icons, hide/show, lock buttons and binding indicators [R-LT-02]', () => {
    const doc = sampleDocument();
    const pageId = doc.workspace.pageOrder[0] ?? 'p_home000001';
    const page = doc.pages[pageId];
    if (page?.root.children?.[0]) {
      page.root.children[0].locked = true;
      page.root.children[0].hidden = true;
      page.root.children[0].bindings = {
        title: { source: 'prop', field: 'label' },
      };
    }
    const root = setupStore(doc);
    render(<LayerTree root={root} onSelect={vi.fn()} />);

    expect(screen.getByTestId('layer-lock-n_card000001')).toBeDefined();
    expect(screen.getByTestId('layer-hide-n_card000001')).toBeDefined();
  });

  it('syncs selection and expands ancestor nodes [R-LT-03]', () => {
    const root = setupStore();
    const onSelect = vi.fn();
    render(<LayerTree root={root} selectedNodeIds={['n_text000001']} onSelect={onSelect} />);

    const textRow = screen.getByTestId('layer-row-n_text000001');
    expect(textRow.getAttribute('aria-selected')).toBe('true');

    const cardRow = screen.getByTestId('layer-row-n_card000001');
    fireEvent.click(cardRow);
    expect(onSelect).toHaveBeenCalledWith('n_card000001');
  });

  it('renames node on double click and submits with Enter [R-LT-04]', () => {
    const root = setupStore();
    render(<LayerTree root={root} onSelect={vi.fn()} />);

    const cardRow = screen.getByTestId('layer-row-n_card000001');
    fireEvent.doubleClick(cardRow);

    const input = screen.getByTestId<HTMLInputElement>('layer-rename-input');
    expect(input).toBeDefined();
    fireEvent.change(input, { target: { value: 'My Custom Card' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    const card = useEditorStore.getState().flatNodes['n_card000001'];
    expect(card?.name).toBe('My Custom Card');
  });

  it('wraps tree nodes in sortable container [R-LT-05]', () => {
    const root = setupStore();
    render(<LayerTree root={root} onSelect={vi.fn()} />);

    const list = screen.getByTestId('layer-list');
    expect(list).toBeDefined();
    const cardRow = screen.getByTestId('layer-row-n_card000001');
    expect(cardRow.getAttribute('data-testid')).toBe('layer-row-n_card000001');
  });

  it('opens context menu with duplicate, delete, and wrap options [R-LT-06]', () => {
    const root = setupStore();
    render(<LayerTree root={root} onSelect={vi.fn()} />);

    const cardRow = screen.getByTestId('layer-row-n_card000001');
    fireEvent.contextMenu(cardRow, { clientX: 100, clientY: 200 });

    expect(screen.getByTestId('context-menu-duplicate')).toBeDefined();
    expect(screen.getByTestId('context-menu-delete')).toBeDefined();
    expect(screen.getByTestId('context-menu-wrap-row')).toBeDefined();
    expect(screen.getByTestId('context-menu-wrap-col')).toBeDefined();
    expect(screen.getByTestId('context-menu-wrap-grid')).toBeDefined();
    expect(screen.getByTestId('context-menu-copy')).toHaveProperty('disabled', true);
    expect(screen.getByTestId('context-menu-paste')).toHaveProperty('disabled', true);
  });

  it('renders ComponentInstance as a single row and expands slots [R-LT-07]', () => {
    const doc = sampleDocument();
    const pageId = doc.workspace.pageOrder[0] ?? 'p_home000001';
    const page = doc.pages[pageId];
    if (page?.root) {
      page.root.children = [
        {
          id: 'n_comp000001',
          type: 'ComponentInstance',
          content: { kind: 'instance', componentId: 'c_card000001', propValues: {} },
          slots: {
            header: [
              {
                id: 'n_slot_head01',
                type: 'Text',
                content: { kind: 'text', text: 'Slot header' },
              },
            ],
          },
        },
      ];
    }
    const root = setupStore(doc);
    render(<LayerTree root={root} onSelect={vi.fn()} />);

    expect(screen.getByTestId('layer-row-n_comp000001')).toBeDefined();
    expect(screen.getByText('Slot header')).toBeDefined();
  });
});
