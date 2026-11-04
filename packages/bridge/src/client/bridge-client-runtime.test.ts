// @vitest-environment happy-dom
// Bridge client runtime: Studio messages (V-110..V-114), navigation (R-BR-19), build errors (R-BR-17).
import { type BridgeEnvelope, BridgeSelectionInfoPayloadSchema } from '@kumicraft/shared';
import { afterEach, beforeEach, describe, expect, it, type MockInstance, vi } from 'vitest';

import { BridgeClientRuntime, type HotContext } from './bridge-client-runtime.ts';
import { toBuildError } from './build-error.ts';

const NONCE = 'nonce-1234567890';
const STUDIO = 'http://127.0.0.1:4173';
const ROOT = 'D:/work/shop';

let runtime: BridgeClientRuntime;
let sent: BridgeEnvelope[];
let hotListeners: Map<string, (payload: unknown) => void>;
let postMessageSpy: MockInstance<Window['postMessage']>;

const hot: HotContext = {
  on: (event, callback) => {
    hotListeners.set(event, callback);
  },
};

function fromStudio(
  type: string,
  payload: unknown,
  overrides: { origin?: string; nonce?: string; source?: MessageEventSource } = {},
): void {
  window.dispatchEvent(
    new MessageEvent('message', {
      data: { rc: 1, nonce: overrides.nonce ?? NONCE, type, payload },
      origin: overrides.origin ?? STUDIO,
      source: overrides.source ?? window.parent,
    }),
  );
}

/**
 * A pointer press in design mode is swallowed (R-BR-13); in preview mode the app receives it.
 * happy-dom has no layout, so the probe avoids click, which hit-tests by coordinates.
 */
function clickIsIntercepted(): boolean {
  const press = new PointerEvent('pointerdown', { bubbles: true, cancelable: true });
  document.body.dispatchEvent(press);
  return press.defaultPrevented;
}

const sentOfType = (type: string) => sent.filter((m) => m.type === type).map((m) => m.payload);
const sentSelectionInfo = () =>
  sentOfType('selection-info').map((p) => BridgeSelectionInfoPayloadSchema.parse(p));

beforeEach(() => {
  sent = [];
  hotListeners = new Map();
  // The parent window is the Studio; its postMessage is where the Bridge output goes.
  postMessageSpy = vi.spyOn(window.parent, 'postMessage').mockImplementation((message: unknown) => {
    sent.push(message as BridgeEnvelope);
  });
  document.body.innerHTML = '<main data-rc-loc="src/App.tsx:1:1"><p>Hi</p></main>';
  runtime = new BridgeClientRuntime({ nonce: NONCE, studioOrigin: STUDIO, rootDir: ROOT, hot });
});

afterEach(() => {
  runtime.destroy();
  vi.restoreAllMocks();
});

describe('Studio messages [V-111]', () => {
  it('applies a valid message from the parent window [R-BR-13]', () => {
    expect(clickIsIntercepted()).toBe(true);

    fromStudio('set-mode', { mode: 'preview' });

    expect(clickIsIntercepted()).toBe(false);
  });

  it('ignores another source, another origin, another nonce or a payload that does not parse', () => {
    // An inline page: happy-dom gives it a window without loading anything.
    const otherWindow = document.createElement('iframe');
    otherWindow.srcdoc = '<!doctype html><title>other</title>';
    document.body.appendChild(otherWindow);
    const other = otherWindow.contentWindow ?? undefined;

    if (other !== undefined) fromStudio('set-mode', { mode: 'preview' }, { source: other });
    fromStudio('set-mode', { mode: 'preview' }, { origin: 'http://evil.test' });
    fromStudio('set-mode', { mode: 'preview' }, { nonce: 'stale-nonce-00000' });
    fromStudio('set-mode', { mode: 'run' });
    fromStudio('set-mode', { mode: 'preview', extra: true });

    expect(other).toBeDefined();
    expect(clickIsIntercepted()).toBe(true);
  });
});

describe('navigation [R-BR-19]', () => {
  it('goes to the route of the Studio and reports it back', () => {
    fromStudio('navigate', { route: '/products' });

    expect(window.location.pathname).toBe('/products');
    expect(sentOfType('route')).toContainEqual({ route: '/products' });
  });

  it('ignores the old payload shape', () => {
    const before = window.location.pathname;

    fromStudio('navigate', { path: '/old-shape' });

    expect(window.location.pathname).toBe(before);
  });
});

describe('keyboard while text is edited [R-TX-03]', () => {
  it('leaves Ctrl+Z to the text instead of sending Undo to the Studio', () => {
    const main = document.querySelector('main') ?? undefined;
    const pressCtrlZ = () =>
      main?.dispatchEvent(new KeyboardEvent('keydown', { key: 'z', ctrlKey: true, bubbles: true }));
    fromStudio('text-edit-start', { ref: { loc: 'src/App.tsx:1:1', index: 0 } });

    expect(main?.isContentEditable).toBe(true);
    pressCtrlZ();
    fromStudio('text-edit-end', {});
    pressCtrlZ();

    expect(sentOfType('shortcut')).toEqual([
      { key: 'z', ctrl: true, meta: false, shift: false, alt: false },
    ]);
  });
});

describe('build errors [R-BR-17]', () => {
  it('reports a Vite error with the file relative to the project and a 1-based column', () => {
    hotListeners.get('vite:error')?.({
      type: 'error',
      err: {
        message: 'Unexpected token',
        id: 'D:/work/shop/src/App.tsx',
        loc: { file: 'D:/work/shop/src/App.tsx', line: 3, column: 4 },
      },
    });

    expect(sentOfType('build-error')).toEqual([
      { message: 'Unexpected token', file: 'src/App.tsx', line: 3, column: 5 },
    ]);
  });

  it('reports a successful update', () => {
    hotListeners.get('vite:afterUpdate')?.({ type: 'update', updates: [] });

    expect(sentOfType('build-ok')).toEqual([{}]);
  });

  it('keeps a generic message when the Vite payload has another shape', () => {
    expect(toBuildError({ unexpected: true }, ROOT)).toEqual({ message: 'Build error' });
    expect(toBuildError({ err: { message: 'x', id: 'C:\\other\\file.ts' } }, ROOT)).toEqual({
      message: 'x',
      file: 'C:/other/file.ts',
    });
  });

  it('extracts file, line, column from relative frame in message when loc is missing [R-BR-17]', () => {
    const res = toBuildError(
      {
        err: {
          message: 'Failed to parse JSX\n╭─[ src/pages/Home.tsx:44:6 ]\n44 │ <div>',
        },
      },
      ROOT,
    );
    expect(res).toEqual({
      message: 'Failed to parse JSX\n╭─[ src/pages/Home.tsx:44:6 ]\n44 │ <div>',
      file: 'src/pages/Home.tsx',
      line: 44,
      column: 6,
    });
  });

  it('does not read a plugin tag before the frame as part of the path [R-BR-17]', () => {
    const message = '[plugin:vite:react] Failed to parse JSX ╭─[ src/pages/Home.tsx:44:6 ]';
    expect(toBuildError({ err: { message } }, ROOT)).toEqual({
      message,
      file: 'src/pages/Home.tsx',
      line: 44,
      column: 6,
    });
  });

  it('normalizes absolute Windows path in message frame to relative under rootDir [R-BR-17]', () => {
    const res = toBuildError(
      {
        err: {
          message: 'Syntax error\n╭─[ D:\\work\\shop\\src\\pages\\Home.tsx:44:6 ]',
        },
      },
      ROOT,
    );
    expect(res).toEqual({
      message: 'Syntax error\n╭─[ D:\\work\\shop\\src\\pages\\Home.tsx:44:6 ]',
      file: 'src/pages/Home.tsx',
      line: 44,
      column: 6,
    });
  });

  it('ignores frame in message when loc exists [R-BR-17]', () => {
    const res = toBuildError(
      {
        err: {
          message: 'Error\n╭─[ src/pages/Ignored.tsx:99:99 ]',
          loc: { file: 'D:/work/shop/src/pages/Home.tsx', line: 10, column: 2 },
        },
      },
      ROOT,
    );
    expect(res).toEqual({
      message: 'Error\n╭─[ src/pages/Ignored.tsx:99:99 ]',
      file: 'src/pages/Home.tsx',
      line: 10,
      column: 3,
    });
  });

  it('keeps error without line and column when no frame is found in message [R-BR-17]', () => {
    const res = toBuildError(
      {
        err: {
          message: 'Generic build error without location frame',
          id: 'D:/work/shop/src/main.tsx',
        },
      },
      ROOT,
    );
    expect(res).toEqual({
      message: 'Generic build error without location frame',
      file: 'src/main.tsx',
    });
  });
});

describe('selection info [R-BR-16]', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('sends debounced selection-info with found true when element is selected [R-BR-16]', () => {
    fromStudio('select', { refs: [{ loc: 'src/App.tsx:1:1', index: 0 }], reveal: false });
    fromStudio('select', { refs: [{ loc: 'src/App.tsx:1:1', index: 0 }], reveal: false });

    expect(sentOfType('selection-info')).toHaveLength(0);

    vi.advanceTimersByTime(16);

    const msgs = sentSelectionInfo();
    expect(msgs).toHaveLength(1);
    expect(msgs[0]?.items).toHaveLength(1);
    expect(msgs[0]?.items[0]?.found).toBe(true);
  });

  it('reports found false when selected element is removed from DOM [R-BR-16]', async () => {
    fromStudio('select', { refs: [{ loc: 'src/App.tsx:1:1', index: 0 }], reveal: false });
    vi.advanceTimersByTime(16);

    const main = document.querySelector('[data-rc-loc="src/App.tsx:1:1"]');
    main?.remove();

    await Promise.resolve();
    vi.advanceTimersByTime(16);

    const msgs = sentSelectionInfo();
    expect(msgs).toHaveLength(2);
    expect(msgs[1]?.items[0]?.found).toBe(false);
  });

  it('reports updated domClass when class changes without triggering tree rescan [R-BR-16]', async () => {
    fromStudio('select', { refs: [{ loc: 'src/App.tsx:1:1', index: 0 }], reveal: false });
    vi.advanceTimersByTime(16);
    vi.advanceTimersByTime(100);
    const initialTreeCount = sentOfType('tree').length;

    const main = document.querySelector('[data-rc-loc="src/App.tsx:1:1"]');
    main?.setAttribute('class', 'bg-red-500 p-4');

    await Promise.resolve();
    vi.advanceTimersByTime(16);

    const infoMsgs = sentSelectionInfo();
    const latest = infoMsgs[infoMsgs.length - 1];
    expect(latest?.items[0]?.domClass).toBe('bg-red-500 p-4');

    vi.advanceTimersByTime(100);
    expect(sentOfType('tree')).toHaveLength(initialTreeCount);
  });

  it('sends selection-info on vite:afterUpdate HMR event [R-BR-16]', () => {
    fromStudio('select', { refs: [{ loc: 'src/App.tsx:1:1', index: 0 }], reveal: false });
    vi.advanceTimersByTime(16);
    const initialCount = sentOfType('selection-info').length;

    hotListeners.get('vite:afterUpdate')?.({ type: 'update', updates: [] });
    vi.advanceTimersByTime(16);

    expect(sentOfType('selection-info')).toHaveLength(initialCount + 1);
  });

  it('sends empty items when selection is cleared [R-BR-16]', () => {
    fromStudio('select', { refs: [], reveal: false });
    vi.advanceTimersByTime(16);

    const msgs = sentSelectionInfo();
    expect(msgs).toHaveLength(1);
    expect(msgs[0]?.items).toEqual([]);
  });
});

describe('core behaviour', () => {
  it('puts the overlay in a closed shadow root and puts it back when removed [R-BR-11]', async () => {
    const host = document.getElementById('__rc_overlay_host');
    if (!host) throw new Error('Missing __rc_overlay_host');
    expect(host.style.position).toBe('fixed');
    expect(host.style.zIndex).toBe('2147483647');
    expect(host.style.pointerEvents).toBe('none');
    expect(host.shadowRoot).toBeNull();
    host.remove();
    await Promise.resolve();
    expect(document.documentElement.contains(host)).toBe(true);
  });

  it('sends one tree with the new element 100 ms after the DOM changes [R-BR-12]', async () => {
    vi.useFakeTimers();
    vi.advanceTimersByTime(200);
    const before = sentOfType('tree').length;
    const main = document.querySelector('main');
    if (!main) throw new Error('Missing main');
    const sec = document.createElement('section');
    sec.setAttribute('data-rc-loc', 'src/App.tsx:9:1');
    main.appendChild(sec);
    await Promise.resolve();
    vi.advanceTimersByTime(99);
    expect(sentOfType('tree')).toHaveLength(before);
    vi.advanceTimersByTime(1);
    expect(sentOfType('tree')).toHaveLength(before + 1);
    const latestTree = sentOfType('tree')[sentOfType('tree').length - 1] as {
      nodes: Array<{ ref: { loc: string } }>;
    };
    expect(latestTree.nodes.some((n) => n.ref.loc === 'src/App.tsx:9:1')).toBe(true);
    vi.useRealTimers();
  });

  it('targets the nearest element with data-rc-loc under the pointer, skipping the overlay [R-BR-14]', () => {
    const overlayHost = document.getElementById('__rc_overlay_host');
    const main = document.querySelector('main');
    const p = document.querySelector('p');
    if (!overlayHost || !main || !p) throw new Error('Missing DOM elements');
    Object.defineProperty(document, 'elementsFromPoint', {
      configurable: true,
      value: () => [overlayHost, p, main, document.body],
    });
    try {
      window.dispatchEvent(new PointerEvent('pointermove', { clientX: 5, clientY: 5 }));
      const hoverMsgs = sentOfType('hover');
      expect(hoverMsgs[hoverMsgs.length - 1]).toEqual({
        ref: { loc: 'src/App.tsx:1:1', index: 0 },
      });
    } finally {
      Reflect.deleteProperty(document, 'elementsFromPoint');
    }
  });

  it('draws overlay changes once per animation frame [R-BR-15]', () => {
    const raf = vi.spyOn(window, 'requestAnimationFrame');
    const caf = vi.spyOn(window, 'cancelAnimationFrame');
    fromStudio('highlight', { ref: { loc: 'src/App.tsx:1:1', index: 0 } });
    fromStudio('highlight', { ref: { loc: 'src/App.tsx:1:1', index: 0 } });
    expect(raf).toHaveBeenCalledTimes(2);
    expect(caf).toHaveBeenCalledWith(raf.mock.results[0]?.value);
  });

  it('sends Undo shortcuts to the Studio in design mode [R-BR-18]', () => {
    const event = new KeyboardEvent('keydown', { key: 'z', ctrlKey: true, cancelable: true });
    window.dispatchEvent(event);
    expect(sentOfType('shortcut')).toEqual([
      { key: 'z', ctrl: true, meta: false, shift: false, alt: false },
    ]);
    expect(event.defaultPrevented).toBe(true);
  });

  it('scrolls the primary element into view when the Studio asks [R-BR-20]', () => {
    const main = document.querySelector('main');
    if (!main) throw new Error('Missing main');
    const scrollSpy = vi.fn();
    main.scrollIntoView = scrollSpy;
    fromStudio('select', { refs: [{ loc: 'src/App.tsx:1:1', index: 0 }], reveal: true });
    expect(scrollSpy).toHaveBeenCalledWith({ block: 'nearest', inline: 'nearest' });
    fromStudio('select', { refs: [{ loc: 'src/App.tsx:1:1', index: 0 }], reveal: false });
    expect(scrollSpy).toHaveBeenCalledTimes(1);
  });

  it('posts only to the Studio origin [S-101]', () => {
    expect(sent.length).toBeGreaterThan(0);
    for (const call of postMessageSpy.mock.calls) {
      expect(call[1]).toBe(STUDIO);
    }
  });
});

describe('drag handle press [R-DD-10]', () => {
  it('lets a press on the overlay reach the drag handle while page presses stay swallowed', () => {
    const host = document.getElementById('__rc_overlay_host');
    expect(host).not.toBeNull();
    let reached = false;
    host?.addEventListener('pointerdown', () => {
      reached = true;
    });
    host?.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, cancelable: true }));
    expect(reached).toBe(true);
    expect(clickIsIntercepted()).toBe(true);
  });
});
