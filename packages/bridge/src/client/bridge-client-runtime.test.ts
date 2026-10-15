// @vitest-environment happy-dom
// Bridge client runtime: Studio messages (V-110..V-114), navigation (R-BR-19), build errors (R-BR-17).
import type { BridgeEnvelope } from '@reactcraft/shared';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { BridgeClientRuntime, type HotContext, toBuildError } from './bridge-client-runtime.ts';

const NONCE = 'nonce-1234567890';
const STUDIO = 'http://127.0.0.1:4173';
const ROOT = 'D:/work/shop';

let runtime: BridgeClientRuntime;
let sent: BridgeEnvelope[];
let hotListeners: Map<string, (payload: unknown) => void>;

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

beforeEach(() => {
  sent = [];
  hotListeners = new Map();
  // The parent window is the Studio; its postMessage is where the Bridge output goes.
  vi.spyOn(window.parent, 'postMessage').mockImplementation((message: unknown) => {
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
  it('applies a valid message from the parent window', () => {
    expect(clickIsIntercepted()).toBe(true);

    fromStudio('set-mode', { mode: 'preview' });

    expect(clickIsIntercepted()).toBe(false);
  });

  it('ignores another source, another origin, another nonce or a payload that does not parse', () => {
    const otherWindow = document.createElement('iframe');
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
      { key: 'Undo', ctrl: true, meta: false, shift: false, alt: false },
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
