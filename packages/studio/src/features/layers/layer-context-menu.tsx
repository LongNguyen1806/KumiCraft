// Context menu for Layer Tree rows (SPEC-04.1 section 12, R-LT-06).
import type { DesignNode, DesignOperation, TreeTarget } from '@reactcraft/model';
import { assignIds, denormalize } from '@reactcraft/model';
import type { ReactNode } from 'react';
import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';

import { useEditorStore } from '../../store/editor-store.ts';

export type ContextMenuState = {
  readonly x: number;
  readonly y: number;
  readonly nodeId: string;
};

type LayerContextMenuProps = {
  readonly state: ContextMenuState;
  readonly onClose: () => void;
  readonly onStartRename: (nodeId: string) => void;
};

/** The subtree of `nodeId` with temporary ids, so `assignIds` gives every copy a new id. */
function copyWithTemporaryIds(nodeId: string): DesignNode | undefined {
  const { flatNodes } = useEditorStore.getState();
  if (flatNodes[nodeId] === undefined) return undefined;
  let next = 0;
  const reId = (node: DesignNode): DesignNode => ({
    ...node,
    id: `tmp_${String(++next)}`,
    ...(node.children === undefined ? {} : { children: node.children.map(reId) }),
  });
  return reId(denormalize({ rootId: nodeId, nodes: flatNodes }));
}

function duplicateNode(nodeId: string, treeTarget: TreeTarget): void {
  const store = useEditorStore.getState();
  const parentId = store.flatNodes[nodeId]?.parentId;
  const copy = copyWithTemporaryIds(nodeId);
  if (parentId === undefined || copy === undefined) return;
  const index = (store.flatNodes[parentId]?.childIds ?? []).indexOf(nodeId) + 1;
  const { ops } = assignIds([{ op: 'insert', target: treeTarget, parentId, index, node: copy }]);
  const [inserted] = ops;
  const applied = store.dispatch(ops, { label: 'Duplicate', source: 'user' });
  if (applied.ok && inserted?.op === 'insert') store.selectNode(inserted.node.id);
}

function wrapNode(nodeId: string, type: 'row' | 'column' | 'grid', treeTarget: TreeTarget): void {
  const store = useEditorStore.getState();
  // Plain values, not tokens: the workspace may have deleted any token (R-LB-02).
  const gap = { px: 16 };
  const wrapper: DesignNode = {
    id: 'tmp_1',
    type: type === 'grid' ? 'Grid' : 'Stack',
    content: { kind: 'none' },
    style: type === 'grid' ? { columns: 2, gap } : { direction: type, gap },
    children: [],
  };
  const { ops } = assignIds([{ op: 'wrap', target: treeTarget, nodeIds: [nodeId], wrapper }]);
  store.dispatch(ops, { label: 'Wrap', source: 'user' });
}

function WrapTypeButtons({
  nodeId,
  treeTarget,
  onClose,
}: {
  readonly nodeId: string;
  readonly treeTarget: TreeTarget;
  readonly onClose: () => void;
}): ReactNode {
  const { t } = useTranslation();
  return (
    <>
      <button
        type="button"
        data-testid="context-menu-wrap-row"
        onClick={() => {
          onClose();
          wrapNode(nodeId, 'row', treeTarget);
        }}
        className="px-3 py-1.5 text-left hover:bg-neutral-100"
      >
        {t('layers.menu.wrapRow')}
      </button>
      <button
        type="button"
        data-testid="context-menu-wrap-col"
        onClick={() => {
          onClose();
          wrapNode(nodeId, 'column', treeTarget);
        }}
        className="px-3 py-1.5 text-left hover:bg-neutral-100"
      >
        {t('layers.menu.wrapColumn')}
      </button>
      <button
        type="button"
        data-testid="context-menu-wrap-grid"
        onClick={() => {
          onClose();
          wrapNode(nodeId, 'grid', treeTarget);
        }}
        className="px-3 py-1.5 text-left hover:bg-neutral-100"
      >
        {t('layers.menu.wrapGrid')}
      </button>
    </>
  );
}

function UnwrapButton({
  nodeId,
  treeTarget,
  onClose,
}: {
  readonly nodeId: string;
  readonly treeTarget: TreeTarget;
  readonly onClose: () => void;
}): ReactNode {
  const { t } = useTranslation();
  return (
    <button
      type="button"
      data-testid="context-menu-unwrap"
      onClick={() => {
        onClose();
        const op: DesignOperation = { op: 'unwrap', target: treeTarget, wrapperId: nodeId };
        useEditorStore.getState().dispatch([op], { label: 'Unwrap node', source: 'user' });
      }}
      className="px-3 py-1.5 text-left hover:bg-neutral-100"
    >
      {t('layers.menu.unwrap')}
    </button>
  );
}

function PrimaryMenuItems({
  nodeId,
  treeTarget,
  onClose,
}: {
  readonly nodeId: string;
  readonly treeTarget: TreeTarget;
  readonly onClose: () => void;
}): ReactNode {
  const { t } = useTranslation();
  return (
    <>
      <button
        type="button"
        data-testid="context-menu-duplicate"
        onClick={() => {
          onClose();
          duplicateNode(nodeId, treeTarget);
        }}
        className="px-3 py-1.5 text-left hover:bg-neutral-100"
      >
        {t('layers.menu.duplicate')}
      </button>
      <button
        type="button"
        data-testid="context-menu-delete"
        onClick={() => {
          onClose();
          const op: DesignOperation = { op: 'remove', target: treeTarget, nodeId };
          useEditorStore.getState().dispatch([op], { label: 'Remove node', source: 'user' });
        }}
        className="px-3 py-1.5 text-left text-danger hover:bg-neutral-100"
      >
        {t('layers.menu.delete')}
      </button>
    </>
  );
}

function RenameAndClipboardButtons({
  nodeId,
  onClose,
  onStartRename,
}: {
  readonly nodeId: string;
  readonly onClose: () => void;
  readonly onStartRename: (nodeId: string) => void;
}): ReactNode {
  const { t } = useTranslation();
  return (
    <>
      <button
        type="button"
        data-testid="context-menu-rename"
        onClick={() => {
          onClose();
          onStartRename(nodeId);
        }}
        className="px-3 py-1.5 text-left hover:bg-neutral-100"
      >
        {t('layers.menu.rename')}
      </button>
      <button
        type="button"
        disabled
        data-testid="context-menu-copy"
        className="px-3 py-1.5 text-left text-neutral-300 cursor-not-allowed"
      >
        {t('layers.menu.copy')}
      </button>
      <button
        type="button"
        disabled
        data-testid="context-menu-paste"
        className="px-3 py-1.5 text-left text-neutral-300 cursor-not-allowed"
      >
        {t('layers.menu.pasteInside')}
      </button>
    </>
  );
}

export function LayerContextMenu({
  state,
  onClose,
  onStartRename,
}: LayerContextMenuProps): ReactNode {
  const menuRef = useRef<HTMLDivElement | undefined>(undefined);
  const { x, y, nodeId } = state;

  useEffect(() => {
    const handleOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    window.addEventListener('pointerdown', handleOutside);
    return () => {
      window.removeEventListener('pointerdown', handleOutside);
    };
  }, [onClose]);

  const activePageId = useEditorStore.getState().activePageId;
  const treeTarget: TreeTarget = { kind: 'page', pageId: activePageId ?? 'p_home000001' };

  return (
    <div
      ref={(el) => {
        menuRef.current = el ?? undefined;
      }}
      data-testid="layer-context-menu"
      style={{ left: x, top: y }}
      className="fixed z-50 flex min-w-[160px] flex-col rounded-lg border border-neutral-200 bg-white py-1 shadow-lg text-xs text-ink"
    >
      <PrimaryMenuItems nodeId={nodeId} treeTarget={treeTarget} onClose={onClose} />
      <div className="my-1 border-t border-neutral-100" />
      <WrapTypeButtons nodeId={nodeId} treeTarget={treeTarget} onClose={onClose} />
      <UnwrapButton nodeId={nodeId} treeTarget={treeTarget} onClose={onClose} />
      <div className="my-1 border-t border-neutral-100" />
      <RenameAndClipboardButtons nodeId={nodeId} onClose={onClose} onStartRename={onStartRename} />
    </div>
  );
}
