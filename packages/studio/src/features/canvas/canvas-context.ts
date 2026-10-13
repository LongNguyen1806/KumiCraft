import { createContext, useContext } from 'react';

export type CanvasContextValue = {
  readonly iframe?: HTMLIFrameElement | undefined;
  readonly iframeDoc?: Document | undefined;
  readonly setIframe?: ((iframe: HTMLIFrameElement | undefined) => void) | undefined;
  readonly setIframeDoc?: ((doc: Document | undefined) => void) | undefined;
};

export const CanvasContext = createContext<CanvasContextValue>({});

export const useCanvasContext = () => useContext(CanvasContext);
