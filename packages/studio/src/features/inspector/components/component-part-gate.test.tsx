// @vitest-environment happy-dom
// A part written inside a component's file is shown but locked, with the way to edit it; a part the
// page passes into a component says which component holds it (thiet-ke-component.md §4.2, §4.3).
import type { ElementSource } from '@kumicraft/shared';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import i18next from 'i18next';
import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { useSelectionStore } from '../../../core/selection-store.ts';
import { initI18n } from '../../../i18n/i18n.ts';
import { useDesignStore } from '../../design/design-store.ts';
import { computeVisibleNodes } from '../../layers/layer-tree-utils.ts';
import { ComponentPartGate } from './component-part-gate.tsx';

const PAGE = 'src/pages/Home.tsx';

function source(loc: string, component?: ElementSource['component']): ElementSource {
  return {
    loc,
    tag: 'p',
    fileHash: 'a'.repeat(64),
    className: { kind: 'static', value: '' },
    text: { kind: 'none' },
    attributes: {},
    inLoop: false,
    ...(component !== undefined ? { component } : {}),
  };
}

function renderGate(loc: string, src: ElementSource) {
  render(
    <ComponentPartGate refTarget={{ loc, index: 0 }} source={src}>
      <div data-testid="body" />
    </ComponentPartGate>,
  );
}

beforeAll(async () => {
  await initI18n();
  await i18next.changeLanguage('vi');
});

beforeEach(() => {
  useDesignStore.setState({
    target: { kind: 'page', file: PAGE, route: '/', name: 'Home' },
    componentMode: undefined,
  });
});

afterEach(() => {
  cleanup();
});

describe('ComponentPartGate', () => {
  it('locks a part of a component file and offers to edit the component [R-IN-11]', () => {
    const loc = 'src/components/ProductCard.tsx:9:7';
    useSelectionStore
      .getState()
      .setSelectionInfo([{ ref: { loc, index: 0 }, found: true, tag: 'p', instances: 3 }]);
    renderGate(loc, source(loc, { name: 'ProductCard', usages: 3 }));
    expect(screen.getByTestId('component-part-notice').textContent).toContain('cả 3 chỗ dùng');
    expect(screen.getByTestId('component-part-locked').hasAttribute('inert')).toBe(true);
    fireEvent.click(screen.getByTestId('component-part-edit'));
    expect(useDesignStore.getState().componentMode).toEqual({
      componentName: 'ProductCard',
      filePath: 'src/components/ProductCard.tsx',
    });
  });

  it('names the component a page part sits in, and leaves page parts alone [R-IN-11]', () => {
    const loc = `${PAGE}:8:9`;
    const cardRoot = { loc: 'src/components/Card.tsx:3:5', index: 0 };
    useSelectionStore
      .getState()
      .setSelectionInfo([
        { ref: { loc, index: 0 }, found: true, tag: 'h3', instances: 1, ancestors: [cardRoot] },
      ]);
    useSelectionStore
      .getState()
      .setTree([
        { ref: cardRoot, tag: 'div', instances: 1, component: { loc: `${PAGE}:7:7`, tag: 'Card' } },
      ]);
    renderGate(loc, source(loc));
    expect(screen.getByTestId('component-children-line').textContent).toContain('Card');
    expect(screen.queryByTestId('component-part-locked')).toBeNull();
    cleanup();
    useSelectionStore
      .getState()
      .setSelectionInfo([{ ref: { loc, index: 0 }, found: true, tag: 'h3', instances: 1 }]);
    renderGate(loc, source(loc));
    expect(screen.queryByTestId('component-children-line')).toBeNull();
    expect(screen.getByTestId('body')).toBeDefined();
  });
});

describe('the Layers name of a component', () => {
  it('is the use React reports, not the file of the inner component [R-SL-08]', () => {
    const rows = computeVisibleNodes(
      [
        { ref: { loc: `${PAGE}:5:5`, index: 0 }, tag: 'main', instances: 1 },
        {
          ref: { loc: 'src/components/Card.tsx:3:5', index: 0 },
          parent: 0,
          tag: 'div',
          instances: 1,
          component: { loc: `${PAGE}:7:7`, tag: 'ProductCard' },
        },
      ],
      new Set(),
    );
    expect(rows[1]?.componentName).toBe('ProductCard');
  });
});
