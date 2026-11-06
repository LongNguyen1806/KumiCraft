// Unit tests for Canvas layer menu (SPEC-04 R-SL-13, WP-2.12c).
import {
  BridgeLayerMenuPayloadSchema,
  type ElementRef,
  type LayerMenuItem,
} from '@kumicraft/shared';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { initI18n } from '../../i18n/i18n.ts';
import { useCanvasViewStore } from '../editor/canvas-view-store.ts';
import { studioBridgeChannel } from '../selection/bridge-channel.ts';
import { useSelectionStore } from '../selection/selection-store.ts';
import { selectParentNode } from '../shortcuts/shortcut-actions.ts';
import { LayerMenu } from './layer-menu.tsx';
import { useLayerMenuStore } from './layer-menu-store.ts';

const ORIGIN = 'http://127.0.0.1:5173';
const NONCE = '1234567890123456789012';

function makeItem(tag: string, loc: string, index = 0, label?: string): LayerMenuItem {
  return {
    ref: { loc, index },
    tag,
    ...(label !== undefined ? { label } : {}),
  };
}

function dispatchBridgeMessage(type: string, payload: unknown, fakeWindow: Window): void {
  window.dispatchEvent(
    new MessageEvent('message', {
      source: fakeWindow,
      origin: ORIGIN,
      data: {
        rc: 1,
        nonce: NONCE,
        type,
        payload,
      },
    }),
  );
}

describe('Studio: LayerMenu [R-SL-13]', () => {
  beforeAll(async () => {
    await initI18n();
  });

  beforeEach(() => {
    useSelectionStore.getState().reset();
    useLayerMenuStore.getState().close();
    useCanvasViewStore.getState().setMode('design');
    useCanvasViewStore.getState().setDisplayedZoom(1);
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('Scenario 1: validates BridgeLayerMenuPayloadSchema with 0, 31, and 3 items [R-SL-13]', () => {
    const zeroRes = BridgeLayerMenuPayloadSchema.safeParse({ x: 0, y: 0, items: [] });
    expect(zeroRes.success).toBe(false);

    const thirtyOne = Array.from({ length: 31 }, (_, i) =>
      makeItem('div', `src/Home.tsx:${String(i + 1)}:1`),
    );
    const thirtyOneRes = BridgeLayerMenuPayloadSchema.safeParse({ x: 0, y: 0, items: thirtyOne });
    expect(thirtyOneRes.success).toBe(false);

    const three = [
      makeItem('section', 'src/Home.tsx:1:1'),
      makeItem('div', 'src/Home.tsx:2:1'),
      makeItem('p', 'src/Home.tsx:3:1'),
    ];
    const threeRes = BridgeLayerMenuPayloadSchema.safeParse({ x: 10, y: 20, items: three });
    expect(threeRes.success).toBe(true);
  });

  it('Scenario 2: responds to layer-menu, layer-menu-close, and select messages [R-SL-13]', () => {
    const fakeWindow = {} as Window;
    studioBridgeChannel.attach(fakeWindow, ORIGIN, NONCE);

    const items = [
      makeItem('section', 'src/Home.tsx:1:1'),
      makeItem('div', 'src/Home.tsx:2:1'),
      makeItem('p', 'src/Home.tsx:3:1'),
    ];

    dispatchBridgeMessage('layer-menu', { x: 10, y: 20, items }, fakeWindow);
    expect(useLayerMenuStore.getState().menu?.items).toHaveLength(3);

    dispatchBridgeMessage('layer-menu-close', {}, fakeWindow);
    expect(useLayerMenuStore.getState().menu).toBeUndefined();

    dispatchBridgeMessage('layer-menu', { x: 10, y: 20, items }, fakeWindow);
    expect(useLayerMenuStore.getState().menu?.items).toHaveLength(3);

    dispatchBridgeMessage('select', { refs: [{ loc: 'src/Home.tsx:1:1', index: 0 }] }, fakeWindow);
    expect(useLayerMenuStore.getState().menu).toBeUndefined();

    studioBridgeChannel.detach();
  });

  it('Scenario 3: renders 4 rows and shows component label only when file differs [R-SL-13]', () => {
    const items = [
      makeItem('section', 'src/pages/Home.tsx:1:1', 0, 'Container'),
      makeItem('div', 'src/pages/Home.tsx:2:1', 0, 'Grid'),
      makeItem('article', 'src/components/ProductCard.tsx:1:1', 0, 'Card'),
      makeItem('img', 'src/components/ProductCard.tsx:2:1'),
    ];
    useLayerMenuStore.getState().show({ x: 100, y: 50, items });

    render(<LayerMenu />);

    const rows = screen.getAllByTestId('layer-menu-item');
    expect(rows).toHaveLength(4);
    expect(rows[0]?.textContent).toContain('section');
    expect(rows[0]?.textContent).toContain('Container');
    expect(rows[1]?.textContent).toContain('div');
    expect(rows[2]?.textContent).toContain('article');
    expect(rows[3]?.textContent).toContain('img');

    const fileBadges = screen.getAllByTestId('layer-menu-file');
    expect(fileBadges).toHaveLength(1);
    expect(fileBadges[0]?.textContent).toBe('ProductCard');
    const badgeEl = fileBadges[0];
    if (badgeEl !== undefined) {
      expect(rows[2]?.contains(badgeEl)).toBe(true);
    }
  });

  it('[WP-4.00] with several frames, only the frame the menu was opened in draws it (M-MF)', () => {
    useCanvasViewStore.setState({ activeOpenFrameId: 'frame-a' });
    useLayerMenuStore
      .getState()
      .show({ x: 10, y: 10, items: [makeItem('div', 'src/Home.tsx:1:1')] });

    render(
      <>
        <LayerMenu openFrameId="frame-a" />
        <LayerMenu openFrameId="frame-b" />
      </>,
    );

    expect(screen.getAllByTestId('layer-menu')).toHaveLength(1);
    expect(useLayerMenuStore.getState().frameId).toBe('frame-a');
  });

  it('Scenario 4: positions menu using displayedZoom coordinates [R-SL-13]', () => {
    useCanvasViewStore.getState().setDisplayedZoom(0.5);
    const items = [makeItem('div', 'src/Home.tsx:1:1')];
    useLayerMenuStore.getState().show({ x: 100, y: 50, items });

    render(<LayerMenu />);

    const menuEl = screen.getByTestId('layer-menu');
    expect(menuEl.style.left).toBe('50px');
    expect(menuEl.style.top).toBe('25px');
  });

  it('Scenario 4b: opens up and left when the pointer is near the bottom-right of the Canvas [R-SL-13]', () => {
    useCanvasViewStore.getState().setDisplayedZoom(1);
    useLayerMenuStore
      .getState()
      .show({ x: 700, y: 500, items: [makeItem('div', 'src/Home.tsx:1:1')] });

    render(<LayerMenu boxWidth={800} boxHeight={600} />);

    const menuEl = screen.getByTestId('layer-menu');
    expect(menuEl.style.right).toBe('100px');
    expect(menuEl.style.bottom).toBe('100px');
    expect(menuEl.style.left).toBe('');
    expect(menuEl.style.top).toBe('');
    expect(menuEl.style.maxHeight).toBe('320px');
  });

  it('Scenario 5: highlights hovered row and clears highlight on leave [R-SL-13]', () => {
    const highlightSpy = vi
      .spyOn(studioBridgeChannel, 'highlight')
      .mockImplementation(() => undefined);
    const divRef: ElementRef = { loc: 'src/Home.tsx:2:1', index: 0 };
    const items = [makeItem('section', 'src/Home.tsx:1:1'), makeItem('div', 'src/Home.tsx:2:1')];
    useLayerMenuStore.getState().show({ x: 10, y: 20, items });

    render(<LayerMenu />);

    const rows = screen.getAllByTestId('layer-menu-item');
    const divRow = rows[1];
    expect(divRow).toBeDefined();
    if (divRow) {
      fireEvent.mouseEnter(divRow);
      expect(highlightSpy).toHaveBeenCalledWith(divRef);
      expect(useSelectionStore.getState().hoveredRef).toEqual(divRef);
    }

    const menuEl = screen.getByTestId('layer-menu');
    fireEvent.mouseLeave(menuEl);
    expect(highlightSpy).toHaveBeenCalledWith(undefined);
    expect(useSelectionStore.getState().hoveredRef).toBeUndefined();
  });

  it('Scenario 6: selects clicked item and closes menu [R-SL-13]', () => {
    const selectSpy = vi.spyOn(studioBridgeChannel, 'select').mockImplementation(() => undefined);
    const divRef: ElementRef = { loc: 'src/Home.tsx:2:1', index: 0 };
    const items = [makeItem('section', 'src/Home.tsx:1:1'), makeItem('div', 'src/Home.tsx:2:1')];
    useLayerMenuStore.getState().show({ x: 10, y: 20, items });

    render(<LayerMenu />);

    const rows = screen.getAllByTestId('layer-menu-item');
    const divRow = rows[1];
    expect(divRow).toBeDefined();
    if (divRow) {
      fireEvent.click(divRow);
    }

    expect(useSelectionStore.getState().selectedRefs).toEqual([divRef]);
    expect(selectSpy).toHaveBeenCalledWith([divRef], false);
    expect(useLayerMenuStore.getState().menu).toBeUndefined();
  });

  it('Scenario 7: supports shift-click to toggle items in selection [R-SL-13]', () => {
    const imgRef: ElementRef = { loc: 'src/Home.tsx:1:1', index: 0 };
    const divRef: ElementRef = { loc: 'src/Home.tsx:2:1', index: 0 };
    useSelectionStore.getState().setSelectedRefs([imgRef]);

    const items = [makeItem('img', 'src/Home.tsx:1:1'), makeItem('div', 'src/Home.tsx:2:1')];
    useLayerMenuStore.getState().show({ x: 10, y: 20, items });

    const { unmount } = render(<LayerMenu />);
    const rows = screen.getAllByTestId('layer-menu-item');
    const divRow = rows[1];
    expect(divRow).toBeDefined();
    if (divRow) {
      fireEvent.click(divRow, { shiftKey: true });
    }
    expect(useSelectionStore.getState().selectedRefs).toEqual([imgRef, divRef]);
    unmount();

    useLayerMenuStore.getState().show({ x: 10, y: 20, items });
    render(<LayerMenu />);
    const updatedRows = screen.getAllByTestId('layer-menu-item');
    const imgRow = updatedRows[0];
    expect(imgRow).toBeDefined();
    if (imgRow) {
      fireEvent.click(imgRow, { shiftKey: true });
    }
    expect(useSelectionStore.getState().selectedRefs).toEqual([divRef]);
  });

  it('Scenario 8: closes menu on selectParentNode without changing selection [R-SL-13]', () => {
    const divRef: ElementRef = { loc: 'src/Home.tsx:2:1', index: 0 };
    useSelectionStore.getState().setSelectedRefs([divRef]);
    useLayerMenuStore.getState().show({
      x: 10,
      y: 20,
      items: [makeItem('div', 'src/Home.tsx:2:1')],
    });

    const handled = selectParentNode();
    expect(handled).toBe(true);
    expect(useLayerMenuStore.getState().menu).toBeUndefined();
    expect(useSelectionStore.getState().selectedRefs).toEqual([divRef]);
  });

  it('Scenario 9: closes on click outside or when switching to preview mode [R-SL-13]', () => {
    const highlightSpy = vi
      .spyOn(studioBridgeChannel, 'highlight')
      .mockImplementation(() => undefined);
    const items = [makeItem('div', 'src/Home.tsx:1:1')];
    useLayerMenuStore.getState().show({ x: 10, y: 20, items });

    const { rerender } = render(<LayerMenu />);
    expect(screen.queryByTestId('layer-menu')).toBeTruthy();

    fireEvent.mouseDown(document.body);
    expect(useLayerMenuStore.getState().menu).toBeUndefined();
    expect(highlightSpy).toHaveBeenCalledWith(undefined);

    useLayerMenuStore.getState().show({ x: 10, y: 20, items });
    useCanvasViewStore.getState().setMode('preview');
    rerender(<LayerMenu />);
    expect(useLayerMenuStore.getState().menu).toBeUndefined();
  });

  it('Scenario 10: does not render layer-menu in preview mode [R-SL-13]', () => {
    useCanvasViewStore.getState().setMode('preview');
    useLayerMenuStore.getState().show({
      x: 10,
      y: 20,
      items: [makeItem('div', 'src/Home.tsx:1:1')],
    });

    render(<LayerMenu />);
    expect(screen.queryByTestId('layer-menu')).toBeFalsy();
  });
});
