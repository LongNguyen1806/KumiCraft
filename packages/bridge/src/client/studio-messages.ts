// Studio message dispatcher (V-111).
import {
  StudioDesignFilePayloadSchema,
  type StudioDragEndPayload,
  StudioDragEndPayloadSchema,
  type StudioDragOverPayload,
  StudioDragOverPayloadSchema,
  type StudioHighlightPayload,
  StudioHighlightPayloadSchema,
  StudioNavigatePayloadSchema,
  type StudioSelectPayload,
  StudioSelectPayloadSchema,
  StudioSetModePayloadSchema,
  type StudioTextEditStartPayload,
  StudioTextEditStartPayloadSchema,
} from '@reactcraft/shared';

export type StudioMessageHandlers = {
  setMode: (mode: 'design' | 'preview') => void;
  handleSelect: (data: StudioSelectPayload) => void;
  handleHighlight: (data: StudioHighlightPayload) => void;
  handleNavigate: (route: string) => void;
  handleTextEditStart: (data: StudioTextEditStartPayload) => void;
  commitTextEdit: () => void;
  handleDragOver: (data: StudioDragOverPayload) => void;
  handleDragEnd: (data: StudioDragEndPayload) => void;
  handleDesignFile: (file?: string) => void;
};

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
    case 'design-file': {
      const parsed = StudioDesignFilePayloadSchema.safeParse(payload);
      if (parsed.success) handlers.handleDesignFile(parsed.data.file);
      break;
    }
  }
}
