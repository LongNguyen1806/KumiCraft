import { createContext, type ReactNode, useContext } from 'react';

const CanvasScaleContext = createContext<number>(1);

export function CanvasScaleProvider({
  scale,
  children,
}: {
  readonly scale: number;
  readonly children: ReactNode;
}) {
  return <CanvasScaleContext.Provider value={scale}>{children}</CanvasScaleContext.Provider>;
}

export function useCanvasScale(): number {
  return useContext(CanvasScaleContext);
}
