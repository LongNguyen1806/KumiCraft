import type { ReactNode } from 'react';
import { createPortal } from 'react-dom';

export function CanvasPortal({
  children,
  container,
}: {
  readonly children: ReactNode;
  readonly container: Element | DocumentFragment;
}) {
  return createPortal(children, container);
}
