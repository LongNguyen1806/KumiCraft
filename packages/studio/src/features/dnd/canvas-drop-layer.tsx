// Drop overlay over the Canvas iframe during Studio HTML5 drag (SPEC-04 M-DD, R-DD-10).
import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';

import { useEditMode } from '../project/use-edit-mode.ts';
import { studioBridgeChannel } from '../selection/bridge-channel.ts';
import { useDndStore } from './dnd-store.ts';
import { handleDrop } from './drop-actions.ts';

export function toFrameCoords(
  clientX: number,
  clientY: number,
  rect: { readonly left: number; readonly top: number },
  zoom: number,
  clientLeft = 0,
  clientTop = 0,
): { x: number; y: number } {
  return {
    x: (clientX - rect.left) / zoom - clientLeft,
    y: (clientY - rect.top) / zoom - clientTop,
  };
}

export type CanvasDropLayerProps = {
  readonly iframeRef: { readonly current?: HTMLIFrameElement | undefined };
  readonly zoom: number;
};

function scheduleDragOver(
  rafRef: { current: number | undefined },
  iframeRef: { readonly current?: HTMLIFrameElement | undefined },
  zoom: number,
  clientX: number,
  clientY: number,
): void {
  if (rafRef.current !== undefined) return;
  rafRef.current = requestAnimationFrame(() => {
    rafRef.current = undefined;
    const currentDrag = useDndStore.getState().drag;
    const iframe = iframeRef.current;
    if (!currentDrag || !iframe) return;
    const rect = iframe.getBoundingClientRect();
    const { x, y } = toFrameCoords(
      clientX,
      clientY,
      rect,
      zoom,
      iframe.clientLeft,
      iframe.clientTop,
    );
    studioBridgeChannel.dragOver({
      x,
      y,
      source: currentDrag.source === 'layer' ? 'layer' : 'library',
      ...(currentDrag.source === 'layer' ? { refs: [currentDrag.ref] } : {}),
    });
  });
}

export function CanvasDropLayer({ iframeRef, zoom }: CanvasDropLayerProps) {
  const { i18n } = useTranslation();
  const drag = useDndStore((s) => s.drag);
  const rafRef = useRef<number>(undefined);

  const cancelPendingRaf = () => {
    if (rafRef.current !== undefined) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = undefined;
    }
  };

  useEffect(() => cancelPendingRaf, []);

  const editMode = useEditMode();

  if (!drag || editMode === 'viewOnly') return <></>;

  return (
    <div
      data-testid="canvas-drop-layer"
      className="absolute inset-0 z-10"
      onDragOver={(e) => {
        e.preventDefault();
        scheduleDragOver(rafRef, iframeRef, zoom, e.clientX, e.clientY);
      }}
      onDragLeave={(e) => {
        if (e.relatedTarget instanceof Node && e.currentTarget.contains(e.relatedTarget)) {
          return;
        }
        cancelPendingRaf();
        studioBridgeChannel.dragEnd(false);
        useDndStore.getState().setDropTarget(undefined);
      }}
      onDrop={(e) => {
        e.preventDefault();
        cancelPendingRaf();
        studioBridgeChannel.dragEnd(true);
        void handleDrop(i18n.language);
      }}
    />
  );
}
