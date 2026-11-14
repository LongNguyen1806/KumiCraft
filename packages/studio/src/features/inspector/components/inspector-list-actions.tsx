// Add/remove list item controls for ul, ol, and li elements (K9.7-2 TK-2).
import type { ElementRef, TreeNode } from '@kumicraft/shared';
import { Minus, Plus } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { applyStructureEdit } from '../../../api/source-client.ts';
import { useSelectionStore } from '../../selection/selection-store.ts';
import type { InspectorTarget } from '../types.ts';

type ListContext = {
  readonly itemTargetRef: ElementRef | undefined;
  readonly listParentRef: ElementRef | undefined;
  readonly listTag: 'ul' | 'ol';
  readonly itemCount: number;
};

function findListContext(
  treeNodes: readonly TreeNode[],
  ref: ElementRef,
  tag: string,
): ListContext | undefined {
  const lower = tag.toLowerCase();
  if (lower !== 'ul' && lower !== 'ol' && lower !== 'li') return undefined;

  const idx = treeNodes.findIndex((n) => n.ref.loc === ref.loc && n.ref.index === ref.index);
  if (lower === 'ul' || lower === 'ol') {
    const children =
      idx >= 0 ? treeNodes.filter((n) => n.parent === idx && n.tag.toLowerCase() === 'li') : [];
    const last = children[children.length - 1];
    return {
      itemTargetRef: last?.ref,
      listParentRef: ref,
      listTag: lower,
      itemCount: children.length,
    };
  }

  const node = idx >= 0 ? treeNodes[idx] : undefined;
  const parentIdx = node?.parent;
  const parentNode = parentIdx !== undefined ? treeNodes[parentIdx] : undefined;
  const parentTag = parentNode?.tag.toLowerCase();
  const siblings =
    parentIdx !== undefined
      ? treeNodes.filter((n) => n.parent === parentIdx && n.tag.toLowerCase() === 'li')
      : [node];
  return {
    itemTargetRef: ref,
    listParentRef: parentNode?.ref,
    listTag: parentTag === 'ol' ? 'ol' : 'ul',
    itemCount: siblings.length,
  };
}

async function addListItem(
  ctx: ReturnType<typeof findListContext> & object,
  itemLabel: string,
): Promise<void> {
  const res =
    ctx.itemTargetRef !== undefined
      ? await applyStructureEdit({
          kind: 'duplicate',
          elements: [{ loc: ctx.itemTargetRef.loc, tag: 'li' }],
        })
      : ctx.listParentRef !== undefined
        ? await applyStructureEdit({
            kind: 'insert',
            target: {
              kind: 'child',
              parent: { loc: ctx.listParentRef.loc, tag: ctx.listTag },
              where: 'end',
            },
            jsx: `<li>${itemLabel}</li>`,
          })
        : undefined;
  const nextLoc = res?.locs[0];
  if (nextLoc !== undefined) {
    useSelectionStore.getState().setSelectedRefs([{ loc: nextLoc, index: 0 }]);
  }
}

function ListActionButtons({
  disabled,
  canRemove,
  onAdd,
  onRemove,
}: {
  readonly disabled: boolean;
  readonly canRemove: boolean;
  readonly onAdd: () => void;
  readonly onRemove: () => void;
}) {
  const { t } = useTranslation();
  return (
    <div className="flex items-center gap-1.5 pt-0.5">
      <button
        type="button"
        data-testid="list-add-item"
        disabled={disabled}
        onClick={onAdd}
        className="flex h-6 flex-1 items-center justify-center gap-1 rounded border border-line bg-card-solid px-2 text-[11px] font-medium text-ink hover:bg-field disabled:cursor-not-allowed disabled:opacity-40"
      >
        <Plus className="size-3" />
        <span>{t('inspector.list.addItem')}</span>
      </button>
      <button
        type="button"
        data-testid="list-remove-item"
        disabled={disabled || !canRemove}
        onClick={onRemove}
        className="flex h-6 flex-1 items-center justify-center gap-1 rounded border border-line bg-card-solid px-2 text-[11px] font-medium text-ink hover:bg-field disabled:cursor-not-allowed disabled:opacity-40"
      >
        <Minus className="size-3" />
        <span>{t('inspector.list.removeItem')}</span>
      </button>
    </div>
  );
}

export function InspectorListActions({
  target,
  disabled,
}: {
  readonly target: Extract<InspectorTarget, { readonly kind: 'element' }>;
  readonly disabled: boolean;
}) {
  const { i18n } = useTranslation();
  const treeNodes = useSelectionStore((s) => s.treeNodes);
  const [busy, setBusy] = useState(false);

  const ctx = findListContext(treeNodes, target.ref, target.source?.tag ?? '');
  if (ctx === undefined) return undefined;
  const isDisabled = disabled || busy;

  const runAction = async (work: () => Promise<void>) => {
    if (isDisabled) return;
    setBusy(true);
    try {
      await work();
      target.refresh();
    } finally {
      setBusy(false);
    }
  };

  return (
    <ListActionButtons
      disabled={isDisabled}
      canRemove={ctx.itemTargetRef !== undefined && ctx.itemCount > 1}
      onAdd={() => {
        void runAction(() =>
          addListItem(ctx, i18n.language.startsWith('vi') ? 'Mục mới' : 'New item'),
        );
      }}
      onRemove={() => {
        const item = ctx.itemTargetRef;
        if (item === undefined || ctx.itemCount <= 1) return;
        void runAction(async () => {
          await applyStructureEdit({ kind: 'remove', elements: [{ loc: item.loc, tag: 'li' }] });
          if (ctx.listParentRef !== undefined && item.loc === target.ref.loc) {
            useSelectionStore
              .getState()
              .setSelectedRefs([{ loc: ctx.listParentRef.loc, index: 0 }]);
          }
        });
      }}
    />
  );
}
