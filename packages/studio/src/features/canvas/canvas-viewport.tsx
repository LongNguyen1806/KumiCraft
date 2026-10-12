import type { Frame } from '@reactcraft/model';
import { useTranslation } from 'react-i18next';

import { useEditorStore } from '../../store/editor-store.ts';
import { CanvasIframe } from './canvas-iframe.tsx';
import { CanvasNode } from './canvas-node.tsx';

export function CanvasViewport({
  frame,
  onContentHeight,
}: {
  readonly frame?: Frame | undefined;
  readonly onContentHeight?: ((height: number) => void) | undefined;
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

  if (page === undefined) {
    return (
      <div className="flex h-64 items-center justify-center text-sm text-neutral-400">
        {t('canvas.noActivePage')}
      </div>
    );
  }

  return (
    <CanvasIframe frame={resolvedFrame} onContentHeight={onContentHeight}>
      <div className="min-h-screen w-full bg-white text-neutral-900">
        <CanvasNode nodeId={page.root.id} />
      </div>
    </CanvasIframe>
  );
}
