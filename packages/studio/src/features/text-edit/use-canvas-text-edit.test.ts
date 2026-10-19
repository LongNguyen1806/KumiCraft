import { type ElementRef, type ElementSource } from '@reactcraft/shared';
import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { editSource, fetchElementSource } from '../../api/source-client.ts';
import { useComponentsStore } from '../components-panel/use-project-components.ts';
import { useDesignStore } from '../design/design-store.ts';
import { BridgeChannel } from '../selection/bridge-channel.ts';
import { useSelectionStore } from '../selection/selection-store.ts';
import { useCanvasTextEdit } from './use-canvas-text-edit.ts';

vi.mock('../../api/source-client.ts', () => ({
  fetchElementSource: vi.fn(),
  editSource: vi.fn(),
}));

const mockFetchElementSource = vi.mocked(fetchElementSource);
const mockEditSource = vi.mocked(editSource);

const SAMPLE_REF: ElementRef = {
  loc: 'src/pages/Home.tsx:12:7',
  index: 0,
};

const STATIC_SOURCE: ElementSource = {
  loc: 'src/pages/Home.tsx:12:7',
  tag: 'h1',
  fileHash: 'a'.repeat(64),
  className: { kind: 'none' },
  text: { kind: 'static', value: 'Sản phẩm' },
  attributes: {},
  inLoop: false,
};

describe('useCanvasTextEdit (SPEC-04 section 10 M-TX, R-TX-01..08)', () => {
  let channel: BridgeChannel;
  let mockWindow: Window;
  let startTextEditSpy: ReturnType<typeof vi.spyOn>;
  let endTextEditSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.clearAllMocks();
    useSelectionStore.getState().reset();
    channel = new BridgeChannel();
    mockWindow = window;
    vi.spyOn(mockWindow, 'postMessage').mockImplementation(() => {});
    channel.attach(mockWindow, window.location.origin, 'test-nonce');
    startTextEditSpy = vi.spyOn(channel, 'startTextEdit');
    endTextEditSpy = vi.spyOn(channel, 'endTextEdit');
  });

  afterEach(() => {
    channel.detach();
    useDesignStore.getState().setTarget(undefined);
    useDesignStore.getState().exitComponentMode();
    useComponentsStore.getState().setComponents([]);
  });

  const dispatchBridgeMessage = async (type: string, payload: unknown) => {
    await act(async () => {
      window.dispatchEvent(
        new MessageEvent('message', {
          origin: 'http://localhost:3000',
          source: mockWindow,
          data: {
            rc: 1,
            nonce: 'test-nonce',
            type,
            payload,
          },
        }),
      );
      await Promise.resolve();
    });
  };

  it('starts text edit when text is static and source is editable [R-TX-01]', async () => {
    mockFetchElementSource.mockResolvedValueOnce(STATIC_SOURCE);
    const { result } = renderHook(() => useCanvasTextEdit({ channel }));

    await dispatchBridgeMessage('text-edit-request', { ref: SAMPLE_REF });

    expect(mockFetchElementSource).toHaveBeenCalledWith({
      file: 'src/pages/Home.tsx',
      line: 12,
      column: 7,
    });
    expect(startTextEditSpy).toHaveBeenCalledWith(SAMPLE_REF);
    expect(result.current.isEditing).toBe(true);
    expect(result.current.editingRef).toEqual(SAMPLE_REF);
    expect(result.current.warning).toBeUndefined();
  });

  it('shows E023 warning when text is an expression [R-TX-01]', async () => {
    const exprSource: ElementSource = {
      ...STATIC_SOURCE,
      text: { kind: 'expression', code: 'item.title' },
    };
    mockFetchElementSource.mockResolvedValueOnce(exprSource);
    const { result } = renderHook(() => useCanvasTextEdit({ channel }));

    await dispatchBridgeMessage('text-edit-request', { ref: SAMPLE_REF });

    expect(startTextEditSpy).not.toHaveBeenCalled();
    expect(result.current.isEditing).toBe(false);
    expect(result.current.warning).toEqual({
      code: 'E023',
      reason: 'expression',
      messageKey: 'textEdit.errors.expression',
      loc: SAMPLE_REF.loc,
      file: 'src/pages/Home.tsx',
      line: 12,
      column: 7,
    });
  });

  it('shows E023 warning when text is mixed [R-TX-01]', async () => {
    const mixedSource: ElementSource = {
      ...STATIC_SOURCE,
      text: { kind: 'mixed' },
    };
    mockFetchElementSource.mockResolvedValueOnce(mixedSource);
    const { result } = renderHook(() => useCanvasTextEdit({ channel }));

    await dispatchBridgeMessage('text-edit-request', { ref: SAMPLE_REF });

    expect(startTextEditSpy).not.toHaveBeenCalled();
    expect(result.current.isEditing).toBe(false);
    expect(result.current.warning?.reason).toBe('mixed');
  });

  it('shows E023 warning when source is readonly [R-TX-01]', async () => {
    const readonlySource: ElementSource = {
      ...STATIC_SOURCE,
      readonly: 'outsideSource',
    };
    mockFetchElementSource.mockResolvedValueOnce(readonlySource);
    const { result } = renderHook(() => useCanvasTextEdit({ channel }));

    await dispatchBridgeMessage('text-edit-request', { ref: SAMPLE_REF });

    expect(startTextEditSpy).not.toHaveBeenCalled();
    expect(result.current.isEditing).toBe(false);
    expect(result.current.warning?.reason).toBe('readonly');
  });

  it('detects multiple instances and sets loopCount [R-TX-07]', async () => {
    useSelectionStore.getState().setTree([
      {
        ref: SAMPLE_REF,
        tag: 'h1',
        instances: 3,
      },
    ]);
    mockFetchElementSource.mockResolvedValueOnce(STATIC_SOURCE);
    const { result } = renderHook(() => useCanvasTextEdit({ channel }));

    await dispatchBridgeMessage('text-edit-request', { ref: SAMPLE_REF });

    expect(result.current.loopCount).toBe(3);
  });

  it('calls editSource with setText on text-commit [R-TX-05]', async () => {
    mockFetchElementSource.mockResolvedValueOnce(STATIC_SOURCE);
    mockEditSource.mockResolvedValueOnce({
      changed: true,
      file: 'src/pages/Home.tsx',
      fileHash: 'b'.repeat(64),
      element: { ...STATIC_SOURCE, text: { kind: 'static', value: 'Sản phẩm mới' } },
    });

    const { result } = renderHook(() => useCanvasTextEdit({ channel }));

    await dispatchBridgeMessage('text-edit-request', { ref: SAMPLE_REF });
    expect(result.current.isEditing).toBe(true);

    await dispatchBridgeMessage('text-commit', { ref: SAMPLE_REF, text: 'Sản phẩm mới' });

    expect(mockEditSource).toHaveBeenCalledWith({
      edit: {
        kind: 'setText',
        loc: SAMPLE_REF.loc,
        tag: 'h1',
        before: 'Sản phẩm',
        after: 'Sản phẩm mới',
      },
    });
    expect(result.current.isEditing).toBe(false);
  });

  it('clears editing on text-cancel [R-TX-04]', async () => {
    mockFetchElementSource.mockResolvedValueOnce(STATIC_SOURCE);
    const { result } = renderHook(() => useCanvasTextEdit({ channel }));

    await dispatchBridgeMessage('text-edit-request', { ref: SAMPLE_REF });
    expect(result.current.isEditing).toBe(true);

    await dispatchBridgeMessage('text-cancel', { ref: SAMPLE_REF });

    expect(result.current.isEditing).toBe(false);
    expect(result.current.editingRef).toBeUndefined();
  });

  it('ends text edit when canvas mode changes away from design [R-TX-06]', async () => {
    mockFetchElementSource.mockResolvedValueOnce(STATIC_SOURCE);
    const { result } = renderHook(() => useCanvasTextEdit({ channel }));

    await dispatchBridgeMessage('text-edit-request', { ref: SAMPLE_REF });
    expect(result.current.isEditing).toBe(true);

    act(() => {
      useSelectionStore.getState().setMode('preview');
    });

    expect(endTextEditSpy).toHaveBeenCalledWith(SAMPLE_REF);
    expect(result.current.isEditing).toBe(false);
  });

  it('dismissWarning and openEditorForWarning work properly', async () => {
    const onOpen = vi.fn();
    mockFetchElementSource.mockResolvedValueOnce({
      ...STATIC_SOURCE,
      text: { kind: 'expression', code: 'count' },
    });

    const { result } = renderHook(() => useCanvasTextEdit({ channel, onOpenEditor: onOpen }));

    await dispatchBridgeMessage('text-edit-request', { ref: SAMPLE_REF });

    expect(result.current.warning).toBeDefined();

    act(() => {
      result.current.openEditorForWarning();
    });
    expect(onOpen).toHaveBeenCalledWith('src/pages/Home.tsx', 12, 7);

    act(() => {
      result.current.dismissWarning();
    });
    expect(result.current.warning).toBeUndefined();
  });

  it('Scenario 12: double click on foreign component enters componentMode, double click on home edits text [R-CP-15]', async () => {
    useDesignStore.getState().setTarget({
      kind: 'page',
      name: 'Home',
      file: 'src/pages/Home.tsx',
      route: '/',
    });

    useComponentsStore.getState().setComponents([
      {
        name: 'Header',
        file: 'src/components/Header.tsx',
        kind: 'component',
        usages: 1,
        importStatement: "import { Header } from '@/components/Header';",
      },
    ]);

    renderHook(() => useCanvasTextEdit({ channel }));

    // 1st double click: element in Header.tsx
    const headerRef: ElementRef = { loc: 'src/components/Header.tsx:10:3', index: 0 };
    await dispatchBridgeMessage('text-edit-request', { ref: headerRef });

    // Enters component mode, did NOT start inline text edit
    expect(useDesignStore.getState().componentMode).toEqual({
      componentName: 'Header',
      filePath: 'src/components/Header.tsx',
    });
    expect(startTextEditSpy).not.toHaveBeenCalled();

    // Reset componentMode back to page mode
    useDesignStore.getState().exitComponentMode();

    // 2nd double click: element in Home.tsx
    mockFetchElementSource.mockResolvedValueOnce(STATIC_SOURCE);
    await dispatchBridgeMessage('text-edit-request', { ref: SAMPLE_REF });

    // Starts text edit as usual
    expect(startTextEditSpy).toHaveBeenCalledWith(SAMPLE_REF);
  });
});
