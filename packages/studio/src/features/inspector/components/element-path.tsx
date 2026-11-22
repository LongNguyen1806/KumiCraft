// Breadcrumb navigation for nested element ancestors (SPEC-04 R-SL-14, WP-2.12c).
import type { ElementRef, TreeNode } from '@kumicraft/shared';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { studioBridgeChannel } from '../../../core/bridge-channel.ts';
import { useSelectionStore } from '../../../core/selection-store.ts';

/** Tổ tiên có data-rc-loc theo tree, từ gốc tới phần tử; không có trong tree → []. */
export function buildElementPath(treeNodes: readonly TreeNode[], ref: ElementRef): TreeNode[] {
  const nodeIdx = treeNodes.findIndex((n) => n.ref.loc === ref.loc && n.ref.index === ref.index);
  if (nodeIdx === -1) return [];

  const path: TreeNode[] = [];
  const visited = new Set<number>();
  let currentIdx: number | undefined = nodeIdx;

  while (currentIdx !== undefined && currentIdx >= 0 && currentIdx < treeNodes.length) {
    if (visited.has(currentIdx) || path.length >= treeNodes.length) {
      break;
    }
    visited.add(currentIdx);
    const item: TreeNode | undefined = treeNodes[currentIdx];
    if (!item) break;
    path.push(item);
    currentIdx = item.parent;
  }

  return path.reverse();
}

export type PathSlot =
  { readonly kind: 'node'; readonly node: TreeNode } | { readonly kind: 'more' };

/** ≤ 6 bậc: giữ nguyên. > 6: [bậc đầu, more, 4 bậc cuối] (đủ 6 ô). */
export function collapsePath(path: readonly TreeNode[], max = 6): PathSlot[] {
  if (path.length <= max) {
    return path.map((node) => ({ kind: 'node' as const, node }));
  }
  const first = path[0];
  if (!first) return [];
  const lastFour = path.slice(-4);
  return [
    { kind: 'node' as const, node: first },
    { kind: 'more' as const },
    ...lastFour.map((node) => ({ kind: 'node' as const, node })),
  ];
}

function PathNodeLabel({ node }: { readonly node: TreeNode }) {
  const truncatedLabel = node.label !== undefined ? `.${node.label.slice(0, 12)}` : undefined;
  return (
    <>
      <span className="font-mono">{node.tag}</span>
      {truncatedLabel !== undefined && (
        <span className="text-[11px] text-ink-soft">{truncatedLabel}</span>
      )}
    </>
  );
}

function PathAncestorButton({ node }: { readonly node: TreeNode }) {
  return (
    <button
      type="button"
      data-testid="element-path-item"
      data-loc={node.ref.loc}
      onClick={() => {
        useSelectionStore.getState().setSelectedRefs([node.ref]);
        studioBridgeChannel.select([node.ref], true);
      }}
      onMouseEnter={() => {
        studioBridgeChannel.highlight(node.ref);
        useSelectionStore.getState().setHoveredRef(node.ref);
      }}
      onMouseLeave={() => {
        studioBridgeChannel.highlight(undefined);
        useSelectionStore.getState().setHoveredRef(undefined);
      }}
      className="rounded px-1 text-ink-soft transition-colors hover:bg-field-hover hover:text-ink"
    >
      <PathNodeLabel node={node} />
    </button>
  );
}

function PathSlotView({
  slot,
  isLast,
  onExpand,
}: {
  readonly slot: PathSlot;
  readonly isLast: boolean;
  readonly onExpand: () => void;
}) {
  const { t } = useTranslation();
  if (slot.kind === 'more') {
    return (
      <button
        type="button"
        data-testid="element-path-more"
        aria-label={t('inspector.path.more', 'Hiện mọi bậc')}
        onClick={onExpand}
        className="rounded px-1 font-bold text-ink-soft hover:bg-field-hover hover:text-ink"
      >
        …
      </button>
    );
  }

  if (isLast) {
    return (
      <span className="font-semibold text-ink px-1">
        <PathNodeLabel node={slot.node} />
      </span>
    );
  }

  return <PathAncestorButton node={slot.node} />;
}

function PathSlotsList({
  slots,
  onExpand,
}: {
  readonly slots: readonly PathSlot[];
  readonly onExpand: () => void;
}) {
  return (
    <div className="flex items-center gap-1">
      {slots.map((slot, idx) => (
        <div
          key={
            slot.kind === 'more' ? 'more' : `${slot.node.ref.loc}#${String(slot.node.ref.index)}`
          }
          className="flex items-center gap-1"
        >
          {idx > 0 && <span className="text-ink-faint select-none">›</span>}
          <PathSlotView slot={slot} isLast={idx === slots.length - 1} onExpand={onExpand} />
        </div>
      ))}
    </div>
  );
}

export function ElementPath() {
  const { t } = useTranslation();
  const selectedRefs = useSelectionStore((s) => s.selectedRefs);
  const treeNodes = useSelectionStore((s) => s.treeNodes);

  const selectedRef = selectedRefs.length === 1 ? selectedRefs[0] : undefined;
  const currentKey = selectedRef ? `${selectedRef.loc}#${String(selectedRef.index)}` : '';
  const [prevKey, setPrevKey] = useState(currentKey);
  const [expanded, setExpanded] = useState(false);

  if (prevKey !== currentKey) {
    setPrevKey(currentKey);
    setExpanded(false);
  }

  if (!selectedRef) return <></>;
  const path = buildElementPath(treeNodes, selectedRef);
  if (path.length === 0) return <></>;

  const slots = expanded
    ? path.map((node) => ({ kind: 'node' as const, node }))
    : collapsePath(path);

  return (
    <nav
      aria-label={t('inspector.path.label', 'Đường dẫn phần tử')}
      data-testid="element-path"
      className="-mx-3 -mt-2.5 flex items-center gap-1 overflow-x-auto border-b border-line bg-wash-cool px-3 py-1.5 text-[11.5px] whitespace-nowrap"
    >
      <PathSlotsList
        slots={slots}
        onExpand={() => {
          setExpanded(true);
        }}
      />
      <span
        data-testid="element-path-hint"
        className="ml-auto shrink-0 pl-2 text-[10.5px] text-ink-faint"
      >
        {t('inspector.path.hint', 'Esc: chọn cha')}
      </span>
    </nav>
  );
}
