// @vitest-environment happy-dom
// Test 8: DOM, keyboard navigation, Escape focus-restore, outside-click, and reduced-motion behavior of generated kit components.
import { runInThisContext } from 'node:vm';

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import React from 'react';
import { transformWithOxc } from 'vite';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { buildKitTemplateCode } from '../../../../server/src/core/source-editor/structure/kit-templates/index.ts';

type CompiledExports = Record<string, React.ComponentType<Record<string, unknown>>>;

async function compileKitComponent(
  name: 'Tabs' | 'Modal' | 'Dropdown' | 'Carousel' | 'DataTable',
): Promise<CompiledExports> {
  const source = buildKitTemplateCode(name, true);
  if (source === undefined) throw new Error(`Missing template: ${name}`);
  const transformed = await transformWithOxc(source, `${name}.tsx`, {
    jsx: { runtime: 'classic' },
  });
  const cjsCode = transformed.code
    .replace(/import\s*\{([^}]+)\}\s*from\s*['"]react['"];?/g, 'const {$1} = React;')
    .replace(/import\s+type\s+[^;]+;/g, '')
    .replace(/export function\s+([A-Za-z0-9_]+)/g, 'exports.$1 = function $1');
  const exportsObj: CompiledExports = {};
  const fn = runInThisContext(`(function(React, exports) {\n${cjsCode}\n})`) as (
    react: typeof React,
    exports: CompiledExports,
  ) => void;
  fn(React, exportsObj);
  return exportsObj;
}

describe('kit DOM behavior (Test 8)', () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('Tabs supports ArrowRight, ArrowLeft, Home, and End keyboard navigation', async () => {
    const mod = await compileKitComponent('Tabs');
    const Tabs = mod.Tabs;
    const Tab = mod.Tab;
    expect(Tabs).toBeDefined();
    expect(Tab).toBeDefined();
    if (!Tabs || !Tab) return;

    render(
      React.createElement(
        Tabs,
        {},
        React.createElement(Tab, { label: 'One' }, 'Panel 1'),
        React.createElement(Tab, { label: 'Two' }, 'Panel 2'),
        React.createElement(Tab, { label: 'Three' }, 'Panel 3'),
      ),
    );

    const tab1 = screen.getByRole('tab', { name: 'One' });
    const tab2 = screen.getByRole('tab', { name: 'Two' });
    const tab3 = screen.getByRole('tab', { name: 'Three' });
    tab1.focus();

    fireEvent.keyDown(tab1, { key: 'ArrowRight' });
    expect(tab2.getAttribute('aria-selected')).toBe('true');
    expect(document.activeElement).toBe(tab2);

    fireEvent.keyDown(tab2, { key: 'End' });
    expect(tab3.getAttribute('aria-selected')).toBe('true');
    expect(document.activeElement).toBe(tab3);

    fireEvent.keyDown(tab3, { key: 'ArrowLeft' });
    expect(tab2.getAttribute('aria-selected')).toBe('true');
    expect(document.activeElement).toBe(tab2);

    fireEvent.keyDown(tab2, { key: 'Home' });
    expect(tab1.getAttribute('aria-selected')).toBe('true');
    expect(document.activeElement).toBe(tab1);
  });

  it('Modal closes on Escape and restores focus to trigger button', async () => {
    const mod = await compileKitComponent('Modal');
    const Modal = mod.Modal;
    expect(Modal).toBeDefined();
    if (!Modal) return;

    render(
      React.createElement(
        Modal,
        { triggerLabel: 'Open Dialog', title: 'Confirm' },
        React.createElement('p', {}, 'Modal body text'),
      ),
    );

    const trigger = screen.getByRole('button', { name: 'Open Dialog' });
    trigger.focus();
    fireEvent.click(trigger);

    const dialog = document.querySelector('dialog') ?? undefined;
    expect(dialog).toBeDefined();
    expect(dialog?.hasAttribute('open')).toBe(true);

    if (dialog !== undefined) {
      fireEvent.keyDown(dialog, { key: 'Escape' });
      expect(dialog.hasAttribute('open')).toBe(false);
    }
    expect(document.activeElement).toBe(trigger);
  });

  it('Dropdown closes on Escape and outside click', async () => {
    const mod = await compileKitComponent('Dropdown');
    const Dropdown = mod.Dropdown;
    expect(Dropdown).toBeDefined();
    if (!Dropdown) return;

    render(
      React.createElement(
        'div',
        {},
        React.createElement('button', { type: 'button' }, 'Outside'),
        React.createElement(
          Dropdown,
          { triggerLabel: 'Actions' },
          React.createElement('a', { href: '#edit' }, 'Edit'),
        ),
      ),
    );

    const trigger = screen.getByRole('button', { name: 'Actions' });
    fireEvent.click(trigger);
    expect(screen.getByRole('menu')).toBeDefined();

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('menu')).toBeNull();

    fireEvent.click(trigger);
    expect(screen.getByRole('menu')).toBeDefined();
    fireEvent.pointerDown(screen.getByRole('button', { name: 'Outside' }));
    expect(screen.queryByRole('menu')).toBeNull();
  });

  it('Carousel pauses autoplay when prefers-reduced-motion: reduce is active', async () => {
    const setIntervalSpy = vi.spyOn(window, 'setInterval');
    vi.stubGlobal('matchMedia', (query: string) => ({
      matches: query.includes('prefers-reduced-motion'),
      media: query,
      onchange: undefined,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }));

    const mod = await compileKitComponent('Carousel');
    const Carousel = mod.Carousel;
    expect(Carousel).toBeDefined();
    if (!Carousel) return;

    render(
      React.createElement(
        Carousel,
        { autoPlay: true },
        React.createElement('div', {}, 'Slide 1'),
        React.createElement('div', {}, 'Slide 2'),
      ),
    );

    expect(setIntervalSpy).not.toHaveBeenCalled();
    expect(screen.getByText('Slide 1')).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: /Next|Sau/ }));
    expect(screen.getByText('Slide 2')).toBeDefined();
    vi.unstubAllGlobals();
  });

  it('DataTable filters rows, sorts columns with aria-sort, paginates, and shows empty state (Test 5)', async () => {
    const mod = await compileKitComponent('DataTable');
    const DataTable = mod.DataTable;
    expect(DataTable).toBeDefined();
    if (!DataTable) return;

    const rows = [
      { id: 1, name: 'Charlie', score: 30 },
      { id: 2, name: 'Alice', score: 10 },
      { id: 3, name: 'Bob', score: 20 },
      { id: 4, name: 'Diana', score: 40 },
    ];
    const columns = [
      { key: 'name', label: 'Name' },
      { key: 'score', label: 'Score' },
    ];

    render(
      React.createElement(DataTable, {
        data: rows,
        columns,
        pageSize: 2,
        searchPlaceholder: 'Search...',
        emptyMessage: 'Chưa có dữ liệu',
      }),
    );

    // Page 1 shows first 2 rows (Charlie, Alice), not Bob
    expect(screen.getByText('Charlie')).toBeDefined();
    expect(screen.queryByText('Bob')).toBeNull();

    // Pagination Next -> page 2 shows Bob & Diana
    fireEvent.click(screen.getByRole('button', { name: 'Trang sau' }));
    expect(screen.getByText('Bob')).toBeDefined();
    expect(screen.queryByText('Charlie')).toBeNull();

    // Sort Name ascending then descending
    const nameHeader = screen.getByRole('columnheader', { name: /Name/i });
    const sortBtn = nameHeader.querySelector('button');
    expect(sortBtn).toBeDefined();
    if (sortBtn) {
      fireEvent.click(sortBtn);
      expect(nameHeader.getAttribute('aria-sort')).toBe('ascending');
      expect(screen.getByText('Alice')).toBeDefined();

      fireEvent.click(sortBtn);
      expect(nameHeader.getAttribute('aria-sort')).toBe('descending');
      expect(screen.getByText('Diana')).toBeDefined();
    }

    // Search filters rows & empty match shows emptyMessage
    const searchInput = screen.getByPlaceholderText('Search...');
    fireEvent.change(searchInput, { target: { value: 'Bob' } });
    expect(screen.getByText('Bob')).toBeDefined();
    expect(screen.queryByText('Alice')).toBeNull();

    fireEvent.change(searchInput, { target: { value: 'NonExistent' } });
    expect(screen.getByText('Chưa có dữ liệu')).toBeDefined();
  });
});
