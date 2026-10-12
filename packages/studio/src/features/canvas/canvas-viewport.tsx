import { useTranslation } from 'react-i18next';

import { useEditorStore } from '../../store/editor-store.ts';
import { CanvasIframe } from './canvas-iframe.tsx';
import { CanvasNode } from './canvas-node.tsx';

export function CanvasViewport() {
  const { t } = useTranslation();
  const activePageId = useEditorStore((s) => s.activePageId);
  const page = useEditorStore((s) =>
    activePageId !== undefined ? s.document?.pages[activePageId] : undefined,
  );

  if (page === undefined) {
    return (
      <div className="flex h-64 items-center justify-center text-sm text-neutral-400">
        {t('canvas.noActivePage')}
      </div>
    );
  }

  return (
    <CanvasIframe>
      <div className="min-h-screen w-full bg-white text-neutral-900">
        <CanvasNode nodeId={page.root.id} />
      </div>
    </CanvasIframe>
  );
}
