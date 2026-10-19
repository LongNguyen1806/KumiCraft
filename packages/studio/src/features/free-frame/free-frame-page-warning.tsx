import { type ElementSource, parseLocString, type TreeNode } from '@reactcraft/shared';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { fetchElementSourceByLoc } from '../../api/source-client.ts';
import { useCanvasViewStore } from '../editor/canvas-view-store.ts';
import { useSelectionStore } from '../selection/selection-store.ts';

export function isDraftFile(filePath: string, draftsDir: string): boolean {
  return filePath.startsWith(`${draftsDir.replace(/\/+$/, '')}/`);
}

function useIsChildOfFree(
  loc: string | undefined,
  isFree: boolean,
  treeNodes: readonly TreeNode[],
): boolean {
  const [isChildOfFree, setIsChildOfFree] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function checkParent() {
      if (!loc || isFree) {
        setIsChildOfFree(false);
        return;
      }
      const nodeIdx = treeNodes.findIndex((n) => n.ref.loc === loc);
      const parentIdx = nodeIdx >= 0 ? treeNodes[nodeIdx]?.parent : undefined;
      const parentNode = parentIdx !== undefined ? treeNodes[parentIdx] : undefined;
      if (!parentNode) {
        setIsChildOfFree(false);
        return;
      }
      const pSource = await fetchElementSourceByLoc(parentNode.ref.loc);
      if (!cancelled) {
        setIsChildOfFree(pSource?.free === true);
      }
    }
    void checkParent();
    return () => {
      cancelled = true;
    };
  }, [loc, isFree, treeNodes]);

  return isChildOfFree;
}

export function FreeFramePageWarning({ source }: { readonly source?: ElementSource | undefined }) {
  const { t } = useTranslation();
  const treeNodes = useSelectionStore((s) => s.treeNodes);
  const draftsDir = useCanvasViewStore((s) => s.draftsDir);
  const loc = source?.loc;
  const isFree = source?.free === true;
  const isChildOfFree = useIsChildOfFree(loc, isFree, treeNodes);

  if (!source) return <></>;
  const filePath = parseLocString(source.loc)?.file ?? '';
  if (isDraftFile(filePath, draftsDir) || (!isFree && !isChildOfFree)) return <></>;

  return (
    <div
      role="alert"
      data-testid="free-frame-page-warning"
      className="rounded border border-amber-500/30 bg-amber-500/10 p-2 text-xs text-amber-500"
    >
      {t(
        'freeFrame.pageWarning',
        'Khung tự do có thể vỡ trên màn hình nhỏ. Khuyên dùng trong Trang bản nháp.',
      )}
    </div>
  );
}
