import { describe, expect, it, vi } from 'vitest';

import { dispatchStudioMessage, type StudioMessageHandlers } from './studio-messages.ts';

function createHandlers(): StudioMessageHandlers {
  return {
    setMode: vi.fn(),
    handleSelect: vi.fn(),
    handleHighlight: vi.fn(),
    handleNavigate: vi.fn(),
    handleTextEditStart: vi.fn(),
    commitTextEdit: vi.fn(),
    handleDragOver: vi.fn(),
    handleDragEnd: vi.fn(),
    handleDesignFile: vi.fn(),
    handleSetGrid: vi.fn(),
    handleMeasureFree: vi.fn(),
    handleStyleProbe: vi.fn(),
    handleStylePreview: vi.fn(),
    handleStylePreviewClear: vi.fn(),
  };
}

describe('studio-messages [R-ST-13]', () => {
  it('ignores style-preview with invalid schema when value contains semicolon [R-ST-13]', () => {
    const handlers = createHandlers();

    dispatchStudioMessage(
      'style-preview',
      {
        ref: { loc: 'src/App.tsx:1:1', index: 0 },
        property: 'padding-top',
        value: '24px; color: red',
      },
      handlers,
    );
    expect(handlers.handleStylePreview).not.toHaveBeenCalled();

    dispatchStudioMessage(
      'style-preview',
      {
        ref: { loc: 'src/App.tsx:1:1', index: 0 },
        property: 'padding-top',
        value: '24px',
      },
      handlers,
    );
    expect(handlers.handleStylePreview).toHaveBeenCalledWith({
      ref: { loc: 'src/App.tsx:1:1', index: 0 },
      property: 'padding-top',
      value: '24px',
    });

    dispatchStudioMessage('style-preview-clear', {}, handlers);
    expect(handlers.handleStylePreviewClear).toHaveBeenCalledTimes(1);
  });
});

describe('studio-messages set-grid [R-FF-11, spec-log #125]', () => {
  it('passes the grid with the snap switch and the zoom, and drops a bad zoom', () => {
    const handlers = createHandlers();
    dispatchStudioMessage('set-grid', { size: 8, snap: false, scale: 0.5 }, handlers);
    expect(handlers.handleSetGrid).toHaveBeenCalledWith({ size: 8, snap: false, scale: 0.5 });

    dispatchStudioMessage('set-grid', { size: 8 }, handlers);
    expect(handlers.handleSetGrid).toHaveBeenLastCalledWith({ size: 8 });

    dispatchStudioMessage('set-grid', { size: 8, scale: -1 }, handlers);
    expect(handlers.handleSetGrid).toHaveBeenCalledTimes(2);
  });
});
