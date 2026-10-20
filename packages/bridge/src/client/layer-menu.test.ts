// @vitest-environment happy-dom
// Unit tests for the right-click layer menu and Canvas tools wiring (SPEC-04 R-SL-13, R-FF-10).
import { afterEach, describe, expect, it } from 'vitest';

import { CanvasTools } from './canvas-tools.ts';
import { buildLayerMenu } from './layer-menu.ts';
import { BridgeOverlay } from './overlay.ts';

/** happy-dom has no hit testing: answer `elementsFromPoint` with a fixed stack. */
function stubHitTest(stack: Element[]): void {
  Object.defineProperty(document, 'elementsFromPoint', {
    configurable: true,
    value: () => stack,
  });
}

function setupPage(): Element {
  document.body.innerHTML = `
    <section data-rc-loc="src/pages/Home.tsx:3:5" class="py-16">
      <div data-rc-loc="src/pages/Home.tsx:4:7" class="grid gap-6">
        <article data-rc-loc="src/components/ProductCard.tsx:5:5">
          <img id="img" data-rc-loc="src/components/ProductCard.tsx:6:7" alt="">
        </article>
      </div>
    </section>
  `;
  const img = document.getElementById('img');
  if (!img) throw new Error('Missing img');
  stubHitTest([img]);
  return img;
}

afterEach(() => {
  Reflect.deleteProperty(document, 'elementsFromPoint');
  document.body.innerHTML = '';
});

describe('buildLayerMenu [R-SL-13]', () => {
  it('lists every element under the pointer from the outside in, with tag and label', () => {
    setupPage();
    expect(buildLayerMenu(document, 120, 80)).toEqual({
      x: 120,
      y: 80,
      items: [
        { ref: { loc: 'src/pages/Home.tsx:3:5', index: 0 }, tag: 'section', label: 'py-16' },
        { ref: { loc: 'src/pages/Home.tsx:4:7', index: 0 }, tag: 'div', label: 'grid' },
        { ref: { loc: 'src/components/ProductCard.tsx:5:5', index: 0 }, tag: 'article' },
        { ref: { loc: 'src/components/ProductCard.tsx:6:7', index: 0 }, tag: 'img' },
      ],
    });
  });

  it('in component focus mode only offers elements of the focused file', () => {
    setupPage();
    const menu = buildLayerMenu(document, 120, 80, 'src/components/ProductCard.tsx', true);
    expect(menu?.items.map((i) => i.tag)).toEqual(['article', 'img']);
  });

  it('nothing under the pointer gives no menu', () => {
    document.body.innerHTML = '<p>plain</p>';
    stubHitTest([]);
    expect(buildLayerMenu(document, 1, 1)).toBeUndefined();
  });
});

describe('CanvasTools [R-SL-13, R-FF-10]', () => {
  function setupTools() {
    const sent: { type: string; payload: unknown }[] = [];
    const overlay = new BridgeOverlay();
    const tools = new CanvasTools(
      (type, payload) => {
        sent.push({ type, payload });
      },
      overlay,
      window,
    );
    return { sent, tools, overlay };
  }

  it('after a draw, the release click is swallowed but the next real click is not [R-DT-14]', () => {
    const img = setupPage();
    const { sent, tools, overlay } = setupTools();
    tools.setTool('frame');
    const press = new PointerEvent('pointerdown', { button: 0, clientX: 120, clientY: 80 });
    img.dispatchEvent(press);
    expect(tools.pointerDown(press, [])).toBe(true);
    window.dispatchEvent(new PointerEvent('pointerup', { clientX: 220, clientY: 160 }));
    expect(sent.map((m) => m.type)).toEqual(['draw-end']);

    expect(tools.swallowDrawClick()).toBe(true); // the click right after the release
    tools.setTool('select'); // Studio switches back after the insert
    expect(tools.swallowDrawClick()).toBe(false);
    expect(tools.consumeClickSuppression()).toBe(false); // the user's next click selects
    overlay.destroy();
  });

  it('right-click sends layer-menu; the next press or scroll sends one layer-menu-close', () => {
    const img = setupPage();
    const { sent, tools, overlay } = setupTools();
    tools.contextMenu(
      new MouseEvent('contextmenu', { clientX: 120, clientY: 80 }),
      undefined,
      false,
    );
    expect(sent.map((m) => m.type)).toEqual(['layer-menu']);

    const press = new PointerEvent('pointerdown', { button: 0, bubbles: true });
    img.dispatchEvent(press);
    tools.pointerDown(press, []);
    tools.scrolled();
    expect(sent.map((m) => m.type)).toEqual(['layer-menu', 'layer-menu-close']);
    overlay.destroy();
  });

  it('a selection from Studio means the menu is already closed: no extra close', () => {
    setupPage();
    const { sent, tools, overlay } = setupTools();
    tools.contextMenu(
      new MouseEvent('contextmenu', { clientX: 120, clientY: 80 }),
      undefined,
      false,
    );
    tools.selectionChanged();
    tools.scrolled();
    expect(sent.map((m) => m.type)).toEqual(['layer-menu']);
    overlay.destroy();
  });

  it('measure-free answers free-measure for a known element only', () => {
    setupPage();
    const { sent, tools, overlay } = setupTools();
    tools.measureFree({ loc: 'src/pages/Home.tsx:4:7', index: 0 }, document);
    tools.measureFree({ loc: 'src/pages/Missing.tsx:1:1', index: 0 }, document);
    expect(sent).toHaveLength(1);
    expect(sent[0]).toMatchObject({
      type: 'free-measure',
      payload: {
        ref: { loc: 'src/pages/Home.tsx:4:7', index: 0 },
        hasHeight: false,
        children: [
          { ref: { loc: 'src/components/ProductCard.tsx:5:5', index: 0 }, tag: 'article' },
        ],
      },
    });
    overlay.destroy();
  });
});
