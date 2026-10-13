// Auto-scroll the editor main container when dragging near top/bottom edges (R-DD-02, spec-log).
import { useEffect, useRef } from 'react';

const EDGE_ZONE = 40;
const MAX_SPEED = 15;

function calculateScrollStep(pointerY: number, rect: DOMRect): number {
  const distTop = pointerY - rect.top;
  const distBottom = rect.bottom - pointerY;
  if (distTop >= 0 && distTop < EDGE_ZONE) {
    const factor = (EDGE_ZONE - distTop) / EDGE_ZONE;
    return -Math.round(factor * MAX_SPEED);
  }
  if (distBottom >= 0 && distBottom < EDGE_ZONE) {
    const factor = (EDGE_ZONE - distBottom) / EDGE_ZONE;
    return Math.round(factor * MAX_SPEED);
  }
  return 0;
}

export function useCanvasAutoScroll(
  isDragging: boolean,
  pointerY: number,
  container: HTMLElement | undefined,
): void {
  const animRef = useRef(0);

  useEffect(() => {
    if (!isDragging || !container) {
      if (animRef.current) cancelAnimationFrame(animRef.current);
      return undefined;
    }

    let cancelled = false;

    const scrollLoop = () => {
      if (cancelled) return;
      const step = calculateScrollStep(pointerY, container.getBoundingClientRect());
      if (step !== 0) {
        container.scrollTop = Math.max(0, container.scrollTop + step);
      }
      animRef.current = requestAnimationFrame(scrollLoop);
    };

    animRef.current = requestAnimationFrame(scrollLoop);

    return () => {
      cancelled = true;
      if (animRef.current) cancelAnimationFrame(animRef.current);
    };
  }, [isDragging, pointerY, container]);
}
