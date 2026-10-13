import { createContext, useContext } from 'react';

export type CanvasContextValue = {
  readonly iframe?: HTMLIFrameElement | undefined;
  readonly iframeDoc?: Document | undefined;
};

export const CanvasContext = createContext<CanvasContextValue>({});

export const useCanvasContext = () => useContext(CanvasContext);
