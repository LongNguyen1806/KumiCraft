// Bridge → Studio Canvas navigation (canvas-zoom, canvas-pan): the Bridge sends the pointer as a
// fraction of the page, the Studio places it on the frame element on screen.
import { BridgeCanvasPanPayloadSchema, BridgeCanvasZoomPayloadSchema } from '@kumicraft/shared';

import { requestCanvasPan, requestCanvasZoom } from './canvas-navigation.ts';

function frameElementOf(win: Window | undefined): HTMLIFrameElement | undefined {
  if (win === undefined) return undefined;
  for (const iframe of document.querySelectorAll('iframe')) {
    if (iframe.contentWindow === win) return iframe;
  }
  return undefined;
}

/** Handles a navigation message; false for any other type. */
export function handleCanvasNavigation(
  type: string,
  payload: unknown,
  win: Window | undefined,
): boolean {
  if (type === 'canvas-zoom') {
    const res = BridgeCanvasZoomPayloadSchema.safeParse(payload);
    const rect = frameElementOf(win)?.getBoundingClientRect();
    if (res.success && rect !== undefined) {
      requestCanvasZoom({
        x: rect.left + res.data.x * rect.width,
        y: rect.top + res.data.y * rect.height,
        deltaY: res.data.deltaY,
      });
    }
    return true;
  }
  if (type === 'canvas-pan') {
    const res = BridgeCanvasPanPayloadSchema.safeParse(payload);
    if (res.success) {
      requestCanvasPan({
        phase: res.data.phase,
        screen: { x: res.data.screenX, y: res.data.screenY },
      });
    }
    return true;
  }
  return false;
}
