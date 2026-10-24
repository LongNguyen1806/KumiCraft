// Studio message dispatcher (V-111).
import {
  type DrawTool,
  type ElementRef,
  StudioDesignFilePayloadSchema,
  type StudioDragEndPayload,
  StudioDragEndPayloadSchema,
  type StudioDragOverPayload,
  StudioDragOverPayloadSchema,
  type StudioHighlightPayload,
  StudioHighlightPayloadSchema,
  StudioMeasureFreePayloadSchema,
  StudioNavigatePayloadSchema,
  type StudioSelectPayload,
  StudioSelectPayloadSchema,
  type StudioSetGridPayload,
  StudioSetGridPayloadSchema,
  StudioSetModePayloadSchema,
  StudioSetToolPayloadSchema,
  type StudioStyleProbePayload,
  StudioStyleProbePayloadSchema,
  type StudioTextEditStartPayload,
  StudioTextEditStartPayloadSchema,
} from '@kumicraft/shared';

export type StudioMessageHandlers = {
  setMode: (mode: 'design' | 'preview') => void;
  handleSelect: (data: StudioSelectPayload) => void;
  handleHighlight: (data: StudioHighlightPayload) => void;
  handleNavigate: (route: string) => void;
  handleTextEditStart: (data: StudioTextEditStartPayload) => void;
  commitTextEdit: () => void;
  handleDragOver: (data: StudioDragOverPayload) => void;
  handleDragEnd: (data: StudioDragEndPayload) => void;
  handleDesignFile: (file?: string, focus?: boolean) => void;
  handleSetGrid: (size: StudioSetGridPayload['size']) => void;
  handleMeasureFree: (ref: ElementRef) => void;
  handleSetTool?: ((tool: DrawTool) => void) | undefined;
  handleStyleProbe?: ((data: StudioStyleProbePayload) => void) | undefined;
};

/** Free frame and drawing tool messages (R-FF-10, R-FF-11, R-DT-10). */
function dispatchFreeFrame(
  type: string,
  payload: unknown,
  handlers: Pick<StudioMessageHandlers, 'handleSetGrid' | 'handleMeasureFree' | 'handleSetTool'>,
): boolean {
  if (type === 'set-grid') {
    const parsed = StudioSetGridPayloadSchema.safeParse(payload);
    if (parsed.success) handlers.handleSetGrid(parsed.data.size);
    return true;
  }
  if (type === 'measure-free') {
    const parsed = StudioMeasureFreePayloadSchema.safeParse(payload);
    if (parsed.success) handlers.handleMeasureFree(parsed.data.ref);
    return true;
  }
  if (type === 'set-tool') {
    const parsed = StudioSetToolPayloadSchema.safeParse(payload);
    if (parsed.success) handlers.handleSetTool?.(parsed.data.tool);
    return true;
  }
  return false;
}

function dispatchDragOrEdit(
  type: string,
  payload: unknown,
  handlers: Pick<
    StudioMessageHandlers,
    'handleTextEditStart' | 'commitTextEdit' | 'handleDragOver' | 'handleDragEnd'
  >,
): boolean {
  if (type === 'text-edit-start') {
    const parsed = StudioTextEditStartPayloadSchema.safeParse(payload);
    if (parsed.success) handlers.handleTextEditStart(parsed.data);
    return true;
  }
  if (type === 'text-edit-end') {
    handlers.commitTextEdit();
    return true;
  }
  if (type === 'drag-over') {
    const parsed = StudioDragOverPayloadSchema.safeParse(payload);
    if (parsed.success) handlers.handleDragOver(parsed.data);
    return true;
  }
  if (type === 'drag-end') {
    const parsed = StudioDragEndPayloadSchema.safeParse(payload);
    if (parsed.success) handlers.handleDragEnd(parsed.data);
    return true;
  }
  return false;
}

export function dispatchStudioMessage(
  type: string,
  payload: unknown,
  handlers: StudioMessageHandlers,
): void {
  if (dispatchDragOrEdit(type, payload, handlers)) return;
  if (dispatchFreeFrame(type, payload, handlers)) return;
  switch (type) {
    case 'set-mode': {
      const parsed = StudioSetModePayloadSchema.safeParse(payload);
      if (parsed.success) handlers.setMode(parsed.data.mode);
      break;
    }
    case 'select': {
      const parsed = StudioSelectPayloadSchema.safeParse(payload);
      if (parsed.success) handlers.handleSelect(parsed.data);
      break;
    }
    case 'highlight': {
      const parsed = StudioHighlightPayloadSchema.safeParse(payload);
      if (parsed.success) handlers.handleHighlight(parsed.data);
      break;
    }
    case 'navigate': {
      const parsed = StudioNavigatePayloadSchema.safeParse(payload);
      if (parsed.success) handlers.handleNavigate(parsed.data.route);
      break;
    }
    case 'style-probe': {
      const parsed = StudioStyleProbePayloadSchema.safeParse(payload);
      if (parsed.success) handlers.handleStyleProbe?.(parsed.data);
      break;
    }
    case 'design-file': {
      const parsed = StudioDesignFilePayloadSchema.safeParse(payload);
      if (parsed.success) handlers.handleDesignFile(parsed.data.file, parsed.data.focus);
      break;
    }
  }
}
