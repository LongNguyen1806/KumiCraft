import type { PointerEvent } from 'react';
import { useTranslation } from 'react-i18next';

import type { Side } from './use-panel-layout.ts';

type ResizerProps = {
  readonly side: Side;
  readonly width: number;
  readonly hidden: boolean;
  readonly onResize: (width: number) => void;
};

/** The line beside a panel: drag it to change the panel width (R-SH-01), or use the arrow keys. */
export function Resizer({ side, width, hidden, onResize }: ResizerProps) {
  const { t } = useTranslation();
  const direction = side === 'left' ? 1 : -1;

  const startDrag = (event: PointerEvent<HTMLButtonElement>) => {
    const handle = event.currentTarget;
    const startX = event.clientX;
    handle.setPointerCapture(event.pointerId);
    const move = (moveEvent: globalThis.PointerEvent) => {
      onResize(width + (moveEvent.clientX - startX) * direction);
    };
    handle.addEventListener('pointermove', move);
    handle.addEventListener(
      'pointerup',
      () => {
        handle.removeEventListener('pointermove', move);
      },
      { once: true },
    );
  };

  if (hidden) return <div />;
  return (
    <button
      type="button"
      aria-label={t(side === 'left' ? 'editor.resizeLeft' : 'editor.resizeRight')}
      title={t(side === 'left' ? 'editor.resizeLeft' : 'editor.resizeRight')}
      onPointerDown={startDrag}
      onKeyDown={(event) => {
        if (event.key === 'ArrowLeft') onResize(width - 16 * direction);
        if (event.key === 'ArrowRight') onResize(width + 16 * direction);
      }}
      className="group relative cursor-col-resize bg-card-solid"
    >
      <span className="absolute inset-y-0 left-1/2 w-px -translate-x-1/2 bg-line transition-[width,background-color] group-hover:w-[3px] group-hover:bg-accent group-focus-visible:w-[3px] group-focus-visible:bg-accent" />
    </button>
  );
}
