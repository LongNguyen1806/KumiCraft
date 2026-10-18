// Studio message dispatcher (V-111).
import {
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
};

export function dispatchStudioMessage(
  type: string,
  payload: unknown,
  handlers: StudioMessageHandlers,
): void {
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
    case 'text-edit-start': {
      const parsed = StudioTextEditStartPayloadSchema.safeParse(payload);
      if (parsed.success) handlers.handleTextEditStart(parsed.data);
      break;
    }
    case 'text-edit-end':
      handlers.commitTextEdit();
      break;
  }
}
