// @vitest-environment happy-dom
// Tests for K9.8-1 Groups 1, 2, 4, 5, 6, 9: DOM behavior of generated SelectGroup, Toast, LoadingButton, ScrollSpy kits.
import { runInThisContext } from 'node:vm';

import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import React from 'react';
import { transformWithOxc } from 'vite';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { buildKitTemplateCode } from '../../../../server/src/core/source-editor/structure/kit-templates/index.ts';

type GenericComponent = React.ComponentType<{ readonly [k: string]: unknown }>;

interface CompiledKitModule {
  readonly SelectGroup?: GenericComponent;
  readonly SelectItem?: GenericComponent;
  readonly SelectPanel?: GenericComponent;
  readonly ToastHost?: GenericComponent;
  readonly ToastTrigger?: GenericComponent;
  readonly LoadingButton?: GenericComponent;
  readonly ScrollSpy?: GenericComponent;
}

async function compileTsxModule(
  source: string,
  filename: string,
  extraBindings: { readonly [key: string]: unknown } = {},
): Promise<CompiledKitModule> {
  const transformed = await transformWithOxc(source, filename, {
    jsx: { runtime: 'classic' },
  });
  const extraNames = Object.keys(extraBindings);
  let cjsCode = transformed.code
    .replace(/import\s*\{([^}]+)\}\s*from\s*['"]react['"];?/g, 'const {$1} = React;')
    .replace(/import\s+type\s+[^;]+;/g, '')
    .replace(/import\s*\{([^}]+)\}\s*from\s*['"]\.\/theme(?:\.ts)?['"];?/g, '')
    .replace(/export\s+type\s+[\s\S]*?(?:;\n|\n)/g, '')
    .replace(/export function\s+([A-Za-z0-9_]+)/g, 'const $1 = exports.$1 = function $1');
  if (extraNames.length > 0) {
    cjsCode = `const { ${extraNames.join(', ')} } = extra;\n${cjsCode}`;
  }
  const exportsObj: CompiledKitModule = {};
  const fn = runInThisContext(`(function(React, exports, extra) {\n${cjsCode}\n})`) as (
    react: typeof React,
    exports: CompiledKitModule,
    extra: { readonly [key: string]: unknown },
  ) => void;
  fn(React, exportsObj, extraBindings);
  return exportsObj;
}

describe('K9.8-1 generated kit DOM behavior (Groups 1, 2, 4, 5, 6, 9)', () => {
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    vi.restoreAllMocks();
    window.localStorage.clear();
    document.documentElement.classList.remove('dark');
  });

  it('SelectGroup supports click, ArrowRight/ArrowLeft, Enter/Space, linked panels, and preview event (Groups 1 & 2)', async () => {
    const src = buildKitTemplateCode('SelectGroup', true);
    expect(src).toBeDefined();
    if (!src) return;
    const mod = await compileTsxModule(src, 'SelectGroup.tsx');
    const { SelectGroup, SelectItem, SelectPanel } = mod;
    if (!SelectGroup || !SelectItem || !SelectPanel) throw new Error('Missing SelectGroup exports');

    // The group sits inside a spaced list: it must not add an element between the list and its items.
    render(
      React.createElement(
        'div',
        { 'data-testid': 'list', className: 'space-y-3' },
        React.createElement(
          SelectGroup,
          { mode: 'single', linked: true, defaultValue: 'item-1' },
          React.createElement(
            SelectItem,
            { value: 'item-1', className: 'base', selectedClassName: 'ring' },
            'Plan A',
          ),
          React.createElement(
            SelectItem,
            { value: 'item-2', className: 'base', selectedClassName: 'ring' },
            'Plan B',
          ),
          React.createElement(
            SelectItem,
            { value: 'item-3', className: 'base', selectedClassName: 'ring' },
            'Plan C',
          ),
          React.createElement(
            SelectPanel,
            { value: 'item-1' },
            React.createElement('p', {}, 'Content 1'),
          ),
          React.createElement(
            SelectPanel,
            { value: 'item-2' },
            React.createElement('p', {}, 'Content 2'),
          ),
          React.createElement(
            SelectPanel,
            { value: 'item-3' },
            React.createElement('p', {}, 'Content 3'),
          ),
        ),
      ),
    );

    const list = screen.getByTestId('list');
    const item1 = screen.getByRole('tab', { name: 'Plan A' });
    const item2 = screen.getByRole('tab', { name: 'Plan B' });
    const item3 = screen.getByRole('tab', { name: 'Plan C' });
    // [QA K9.8-1] No wrapper: items and the shown panel are direct children of the list.
    expect(item1.parentElement).toBe(list);
    expect(screen.getByText('Content 1').parentElement).toBe(list);
    expect(screen.getByText('Content 1').getAttribute('role')).toBe('tabpanel');

    expect(item1.getAttribute('data-selected')).toBe('true');
    expect(item1.getAttribute('aria-selected')).toBe('true');
    expect(screen.queryByText('Content 2')).toBeNull();

    // Click item 2
    fireEvent.click(item2);
    expect(item2.getAttribute('data-selected')).toBe('true');
    expect(item1.hasAttribute('data-selected')).toBe(false);
    expect(screen.getByText('Content 2')).toBeDefined();
    expect(screen.queryByText('Content 1')).toBeNull();

    // ArrowRight navigates focus & updates linked selection to item 3
    fireEvent.keyDown(item2, { key: 'ArrowRight' });
    expect(item3.getAttribute('data-selected')).toBe('true');
    expect(document.activeElement).toBe(item3);
    expect(screen.getByText('Content 3')).toBeDefined();

    // Bridge preview: a non-bubbling event sent to the list (an ancestor) switches the choice.
    act(() => {
      list.dispatchEvent(
        new CustomEvent('kumicraft:select-preview', { detail: { activeIndex: 0 } }),
      );
    });
    expect(item1.getAttribute('data-selected')).toBe('true');
    expect(screen.getByText('Content 1')).toBeDefined();
  });

  it('ToastHost announces aria-live="polite", auto-dismisses, honors prefers-reduced-motion, and ToastTrigger preserves onClick (Group 5)', async () => {
    vi.useFakeTimers();
    const matchMock = vi.fn().mockReturnValue({ matches: true });
    vi.stubGlobal('matchMedia', matchMock);

    const toastSrc = buildKitTemplateCode('Toast', true);
    if (!toastSrc) throw new Error('Missing Toast');
    const mod = await compileTsxModule(toastSrc, 'Toast.tsx');
    const { ToastHost, ToastTrigger } = mod;
    if (!ToastHost || !ToastTrigger) throw new Error('Missing Toast exports');

    const origClick = vi.fn();
    render(
      React.createElement(
        React.Fragment,
        {},
        React.createElement(
          ToastTrigger,
          { message: 'Đã thêm vào giỏ', variant: 'success', durationMs: 3000 },
          React.createElement('button', { type: 'button', onClick: origClick }, 'Thêm'),
        ),
        React.createElement(ToastHost, {}),
      ),
    );

    const triggerBtn = screen.getByRole('button', { name: 'Thêm' });
    fireEvent.click(triggerBtn);
    expect(origClick).toHaveBeenCalledTimes(1);

    const status = screen.getByRole('status');
    expect(status.textContent).toContain('Đã thêm vào giỏ');
    expect(status.closest('[aria-live="polite"]')).toBeDefined();
    expect(status.style.transition).toBe('none');

    act(() => {
      vi.advanceTimersByTime(3100);
    });
    expect(screen.queryAllByRole('status')).toHaveLength(0);
  });

  it('LoadingButton locks clicks with aria-busy, preserves width, and auto-resets demo after 1500ms (Group 6)', async () => {
    vi.useFakeTimers();
    const loadSrc = buildKitTemplateCode('LoadingButton', true);
    if (!loadSrc) throw new Error('Missing LoadingButton');
    const mod = await compileTsxModule(loadSrc, 'LoadingButton.tsx');
    if (!mod.LoadingButton) throw new Error('Missing LoadingButton export');

    // [QA K9.8-1] Outside KumiCraft (no data-rc-loc on the page) the demo pause never runs and the
    // button keeps the user's own display classes: no inline display is forced.
    const realClick = vi.fn();
    const real = render(
      React.createElement(
        mod.LoadingButton,
        { demo: true, className: 'hidden sm:inline-flex', onClick: realClick },
        'Mua',
      ),
    );
    const realBtn = screen.getByRole('button', { name: 'Mua' });
    fireEvent.click(realBtn);
    expect(realClick).toHaveBeenCalledTimes(1);
    expect(realBtn.getAttribute('aria-busy')).toBeNull();
    expect(realBtn.style.display).toBe('');
    real.unmount();

    // On the KumiCraft Canvas the page carries data-rc-loc: the demo pause runs.
    const marker = document.createElement('div');
    marker.setAttribute('data-rc-loc', 'src/App.tsx:1:1');
    document.body.appendChild(marker);
    const onClick = vi.fn();
    render(
      React.createElement(
        mod.LoadingButton,
        { demo: true, loadingText: 'Đang gửi...', onClick },
        'Gửi đơn',
      ),
    );

    const btn = screen.getByRole('button', { name: 'Gửi đơn' });
    vi.spyOn(btn, 'getBoundingClientRect').mockReturnValue(new DOMRect(0, 0, 140, 40));

    fireEvent.click(btn);
    expect(onClick).toHaveBeenCalledTimes(1);
    expect(btn.getAttribute('aria-busy')).toBe('true');
    expect((btn as HTMLButtonElement).disabled).toBe(true);
    expect(btn.style.minWidth).toBe('140px');
    expect(btn.textContent).toContain('Đang gửi...');

    // Second click while busy is blocked
    fireEvent.click(btn);
    expect(onClick).toHaveBeenCalledTimes(1);

    act(() => {
      vi.advanceTimersByTime(1600);
    });
    expect(btn.getAttribute('aria-busy')).not.toBe('true');
    expect((btn as HTMLButtonElement).disabled).toBe(false);
    expect(btn.textContent).toContain('Gửi đơn');
    marker.remove();
  });

  it('ScrollSpy highlights nav link whose target section intersects viewport (Group 9)', async () => {
    let ioCallback: ((entries: IntersectionObserverEntry[]) => void) | undefined;
    class MockIntersectionObserver {
      constructor(cb: (entries: IntersectionObserverEntry[]) => void) {
        ioCallback = cb;
      }
      observe() {}
      disconnect() {}
      unobserve() {}
      takeRecords() {
        return [];
      }
    }
    vi.stubGlobal('IntersectionObserver', MockIntersectionObserver);

    const sec1 = document.createElement('section');
    sec1.id = 'intro';
    const sec2 = document.createElement('section');
    sec2.id = 'pricing';
    document.body.appendChild(sec1);
    document.body.appendChild(sec2);

    const spySrc = buildKitTemplateCode('ScrollSpy', true);
    if (!spySrc) throw new Error('Missing ScrollSpy');
    const mod = await compileTsxModule(spySrc, 'ScrollSpy.tsx');
    if (!mod.ScrollSpy) throw new Error('Missing ScrollSpy export');

    render(
      React.createElement(
        mod.ScrollSpy,
        { offset: 100 },
        React.createElement(
          'nav',
          { 'data-testid': 'menu' },
          React.createElement('a', { href: '#intro' }, 'Intro'),
          React.createElement('a', { href: '#pricing' }, 'Pricing'),
          // A router link marked by the project's own NavLink: the kit leaves it alone.
          React.createElement('a', { href: '/about', 'aria-current': 'page' }, 'About'),
        ),
      ),
    );

    act(() => {
      ioCallback?.([
        {
          target: sec2,
          isIntersecting: true,
          boundingClientRect: new DOMRect(0, 80, 500, 300),
          intersectionRatio: 0.5,
          intersectionRect: new DOMRect(0, 80, 500, 300),
          rootBounds: new DOMRect(0, 0, 1280, 800),
          time: 10,
        },
      ]);
    });

    const link1 = screen.getByRole('link', { name: 'Intro' });
    const link2 = screen.getByRole('link', { name: 'Pricing' });
    expect(link2.getAttribute('data-selected')).toBe('true');
    expect(link2.getAttribute('aria-current')).toBe('true');
    expect(link1.hasAttribute('data-selected')).toBe(false);
    // [QA K9.8-1] No wrapper around the menu, and the router's aria-current stays.
    expect(screen.getByTestId('menu').parentElement?.tagName).toBe('DIV');
    expect(screen.getByTestId('menu').parentElement?.hasAttribute('data-kc-scroll-spy')).toBe(
      false,
    );
    expect(screen.getByRole('link', { name: 'About' }).getAttribute('aria-current')).toBe('page');
  });
});
