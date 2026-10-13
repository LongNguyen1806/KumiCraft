import type { Frame } from '@reactcraft/model';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';

import { useEditorStore } from '../../store/editor-store.ts';
import { CanvasIframe } from './canvas-iframe.tsx';
import { CanvasNode } from './canvas-node.tsx';

/** PB-16: marks `rc:canvas-render` from opening a page to two frames after it is drawn. */
function useCanvasRenderMark(activePageId: string | undefined, rootId: string | undefined) {
  useEffect(() => {
    if (activePageId === undefined) return undefined;
    try {
      performance.mark('rc:canvas-open');
    } catch {
      // ignore
    }

    let cancelled = false;
    let raf1 = 0;
    let raf2 = 0;

    raf1 = requestAnimationFrame(() => {
      raf2 = requestAnimationFrame(() => {
        if (cancelled) return;
        try {
          performance.mark('rc:canvas-ready');
          performance.measure('rc:canvas-render', 'rc:canvas-open', 'rc:canvas-ready');
        } catch {
          // ignore
        }
      });
    });

    return () => {
      cancelled = true;
      cancelAnimationFrame(raf1);
      cancelAnimationFrame(raf2);
    };
  }, [activePageId, rootId]);
}

export function CanvasViewport({
  frame,
  onContentHeight,
  onIframe,
  onDocReady,
}: {
  readonly frame?: Frame | undefined;
  readonly onContentHeight?: ((height: number) => void) | undefined;
  readonly onIframe?: ((iframe: HTMLIFrameElement | undefined) => void) | undefined;
  readonly onDocReady?: ((doc: Document) => void) | undefined;
} = {}) {
  const { t } = useTranslation();
  const activePageId = useEditorStore((s) => s.activePageId);
  const page = useEditorStore((s) =>
    activePageId !== undefined ? s.document?.pages[activePageId] : undefined,
  );
  const workspaceFrames = useEditorStore((s) => s.document?.workspace.frames);
  const primaryFrameId = useEditorStore((s) => s.document?.workspace.primaryFrameId);
  const resolvedFrame =
    frame ?? workspaceFrames?.find((f) => f.id === primaryFrameId) ?? workspaceFrames?.[0];

  useCanvasRenderMark(activePageId, page?.root.id);

  if (page === undefined) {
    return (
      <div className="flex h-64 items-center justify-center text-sm text-neutral-400">
        {t('canvas.noActivePage')}
      </div>
    );
  }

  return (
    <CanvasIframe
      frame={resolvedFrame}
      onContentHeight={onContentHeight}
      onIframe={onIframe}
      onDocReady={onDocReady}
    >
      <div className="min-h-screen w-full bg-white text-neutral-900">
        <CanvasNode nodeId={page.root.id} />
      </div>
    </CanvasIframe>
  );
}
