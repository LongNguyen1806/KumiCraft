// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest';

import { measureElementA11y } from './a11y-measure.ts';
import { computeAltMeasureSegments, renderAltMeasureSegments } from './alt-measure.ts';
import { BridgeClientRuntime } from './bridge-client-runtime.ts';
import { FreeOverlay } from './free-frame/free-overlay.ts';
import { runResponsiveAudit } from './responsive-audit.ts';

function rect(left: number, top: number, width: number, height: number): DOMRect {
  return {
    x: left,
    y: top,
    left,
    top,
    width,
    height,
    right: left + width,
    bottom: top + height,
    toJSON: () => ({}),
  };
}

function getEl(id: string): HTMLElement {
  const el = document.getElementById(id);
  if (!el) throw new Error(`Missing #${id}`);
  return el;
}

afterEach(() => {
  document.body.innerHTML = '';
  vi.restoreAllMocks();
});

describe('Bridge TK-61 free-frame child guides', () => {
  it('highlights parent free frame and draws scaled X/Y guides when selecting a child', () => {
    document.body.innerHTML = `
      <section id="frame" data-rc-loc="src/App.tsx:2:3" data-rc-free>
        <div id="child" data-rc-loc="src/App.tsx:3:5">Box</div>
      </section>
    `;
    const frame = getEl('frame');
    const child = getEl('child');
    frame.getBoundingClientRect = () => rect(100, 50, 500, 400);
    child.getBoundingClientRect = () => rect(164, 98, 120, 40);

    const host = document.createElement('div');
    document.body.appendChild(host);
    const root = host.attachShadow({ mode: 'open' });
    const overlay = new FreeOverlay(root);
    overlay.setScale(0.5);
    overlay.setResizeTarget(child);
    overlay.render(document);

    const frameBox = root.querySelector<HTMLElement>('.free-frame');
    expect(frameBox?.classList.contains('free-frame-active')).toBe(true);
    expect(frameBox?.style.borderWidth).toBe('3px');
    expect(root.querySelector('.free-frame-label')?.textContent).toBe('Khung tự do');

    const labels = [...root.querySelectorAll<HTMLElement>('.child-guide-label')];
    expect(labels.map((l) => [l.dataset['axis'], l.textContent, l.style.fontSize])).toEqual([
      ['x', '64px', '20px'],
      ['y', '48px', '20px'],
    ]);
  });
});

describe('Bridge TK-63 Alt-hover distance measure', () => {
  it('computes gaps between sibling boxes and inner distances for nested boxes', () => {
    const a = rect(100, 100, 80, 40);
    const b = rect(220, 180, 100, 50);
    expect(computeAltMeasureSegments(a, b)).toEqual([
      { axis: 'x', side: 'right', from: 180, to: 220, at: 120, px: 40 },
      { axis: 'y', side: 'bottom', from: 140, to: 180, at: 140, px: 40 },
    ]);

    const outer = rect(50, 50, 300, 200);
    const inner = rect(90, 80, 100, 60);
    expect(computeAltMeasureSegments(inner, outer)).toEqual([
      { axis: 'y', side: 'top', from: 50, to: 80, at: 140, px: 30 },
      { axis: 'y', side: 'bottom', from: 140, to: 250, at: 140, px: 110 },
      { axis: 'x', side: 'left', from: 50, to: 90, at: 110, px: 40 },
      { axis: 'x', side: 'right', from: 190, to: 350, at: 110, px: 160 },
    ]);

    const layer = document.createElement('div');
    renderAltMeasureSegments(layer, computeAltMeasureSegments(a, b), 1);
    const renderedLabels = [...layer.querySelectorAll('.alt-measure-label')].map(
      (n) => n.textContent,
    );
    expect(renderedLabels).toEqual(['40px', '40px']);
  });

  it('draws distances on Alt+hover in runtime and clears when Alt is released', () => {
    document.body.innerHTML = `
      <div id="wrap">
        <div id="first" data-rc-loc="src/App.tsx:2:3">A</div>
        <div id="second" data-rc-loc="src/App.tsx:3:5">B</div>
      </div>
    `;
    const first = getEl('first');
    const second = getEl('second');
    first.getBoundingClientRect = () => rect(20, 20, 80, 40);
    second.getBoundingClientRect = () => rect(150, 20, 80, 40);

    vi.spyOn(window.parent, 'postMessage').mockImplementation(() => undefined);
    let shadowRef: ShadowRoot | undefined;
    const attachSpy = vi.spyOn(Element.prototype, 'attachShadow').mockImplementation(function (
      this: Element,
      init,
    ) {
      attachSpy.mockRestore();
      const s = this.attachShadow({ ...init, mode: 'open' });
      shadowRef = s;
      return s;
    });
    Object.defineProperty(document, 'elementsFromPoint', {
      value: () => [second],
      configurable: true,
    });

    const runtime = new BridgeClientRuntime({
      nonce: 'n1',
      studioOrigin: 'http://localhost:5173',
      rootDir: '/proj',
    });

    try {
      window.dispatchEvent(
        new MessageEvent('message', {
          origin: 'http://localhost:5173',
          source: window.parent,
          data: {
            rc: 1,
            nonce: 'n1',
            type: 'select',
            payload: { refs: [{ loc: 'src/App.tsx:2:3', index: 0 }], reveal: false },
          },
        }),
      );

      vi.spyOn(window, 'requestAnimationFrame').mockImplementation((cb) => {
        cb(0);
        return 1;
      });

      window.dispatchEvent(
        new PointerEvent('pointermove', { clientX: 160, clientY: 30, altKey: true, bubbles: true }),
      );
      expect(shadowRef?.querySelectorAll('.alt-measure-label').length).toBe(1);
      expect(shadowRef?.querySelector('.alt-measure-label')?.textContent).toBe('50px');

      window.dispatchEvent(new KeyboardEvent('keyup', { key: 'Alt', bubbles: true }));
      expect(shadowRef?.querySelectorAll('.alt-measure-label').length).toBe(0);
    } finally {
      runtime.destroy();
    }
  });
});

describe('Bridge TK-65 accessibility hints & contrast', () => {
  it('flags missing alt, unlabeled icon button, unlabeled input, and low computed contrast', () => {
    document.body.innerHTML = `
      <img id="photo" src="/a.png" />
      <button id="iconBtn"><svg></svg></button>
      <input id="email" type="text" />
      <div id="card">
        <p id="lowContrast">Muted text</p>
        <p id="highContrast">Clear text</p>
      </div>
    `;
    const card = getEl('card');
    const low = getEl('lowContrast');
    const high = getEl('highContrast');

    vi.spyOn(window, 'getComputedStyle').mockImplementation((el) => {
      if (el === card) {
        return { backgroundColor: 'rgb(255, 255, 255)' } as CSSStyleDeclaration;
      }
      if (el === low) {
        return {
          color: 'rgb(180, 180, 180)',
          backgroundColor: 'rgba(0, 0, 0, 0)',
        } as CSSStyleDeclaration;
      }
      if (el === high) {
        return {
          color: 'rgb(15, 23, 42)',
          backgroundColor: 'rgba(0, 0, 0, 0)',
        } as CSSStyleDeclaration;
      }
      return { color: '', backgroundColor: '' } as CSSStyleDeclaration;
    });

    expect(measureElementA11y(getEl('photo'))?.missingAlt).toBe(true);
    expect(measureElementA11y(getEl('iconBtn'))?.missingAccessibleName).toBe(true);
    expect(measureElementA11y(getEl('email'))?.unlabeledInput).toBe(true);
    expect(measureElementA11y(low)?.contrast).toBeLessThan(4.5);
    expect(measureElementA11y(high)?.contrast).toBeGreaterThan(10);
  });
});

describe('Bridge TK-66 responsive audit', () => {
  it('detects horizontal overflow and sibling overlap > 20%, ignoring absolute/fixed siblings', () => {
    document.body.innerHTML = `
      <div id="wide" data-rc-loc="src/App.tsx:2:3">Wide</div>
      <div id="parent">
        <div id="sibA" data-rc-loc="src/App.tsx:3:3">A</div>
        <div id="sibB" data-rc-loc="src/App.tsx:4:3">B</div>
        <div id="floating" data-rc-loc="src/App.tsx:5:3">Overlay</div>
      </div>
    `;
    Object.defineProperty(document.documentElement, 'clientWidth', {
      value: 375,
      configurable: true,
    });
    const wide = getEl('wide');
    const sibA = getEl('sibA');
    const sibB = getEl('sibB');
    const floating = getEl('floating');

    wide.getBoundingClientRect = () => rect(0, 0, 480, 40);
    sibA.getBoundingClientRect = () => rect(0, 50, 100, 100);
    sibB.getBoundingClientRect = () => rect(70, 50, 100, 100); // 30 x 100 = 30% overlap
    floating.getBoundingClientRect = () => rect(0, 50, 100, 100);

    vi.spyOn(window, 'getComputedStyle').mockImplementation((el) => {
      if (el === floating) {
        return {
          display: 'block',
          visibility: 'visible',
          position: 'absolute',
          overflowX: 'visible',
        } as CSSStyleDeclaration;
      }
      return {
        display: 'block',
        visibility: 'visible',
        position: 'static',
        overflowX: 'visible',
      } as CSSStyleDeclaration;
    });

    const issues = runResponsiveAudit(document, window);
    expect(issues).toEqual([
      {
        ref: { loc: 'src/App.tsx:2:3', index: 0 },
        tag: 'div',
        kind: 'overflow',
        detail: '480px / 375px',
        width: 375,
      },
      {
        ref: { loc: 'src/App.tsx:4:3', index: 0 },
        tag: 'div',
        kind: 'overlap',
        detail: 'div ↔ div (30%)',
        width: 375,
      },
    ]);
  });
});
