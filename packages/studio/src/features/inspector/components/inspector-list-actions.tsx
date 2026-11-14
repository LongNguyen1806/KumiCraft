// Quick add/remove item buttons when selecting lists, accordion details, Tabs, or Carousel.
import { ListMinus, ListPlus } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { applyStructureEdit } from '../../../api/source-client.ts';
import { useSelectionStore } from '../../selection/selection-store.ts';
import type { InspectorTarget } from '../types.ts';
import { findListContext, type ItemContext } from './list-context.ts';

async function addListItem(ctx: ItemContext, isVi: boolean): Promise<void> {
  const jsx = ctx.newItemJsx(isVi);
  const res =
    ctx.itemTargetRef !== undefined
      ? await applyStructureEdit({
          kind: 'insert',
          target: {
            kind: 'sibling',
            ref: { loc: ctx.itemTargetRef.loc, tag: ctx.itemTag },
            where: 'after',
          },
          jsx,
        })
      : ctx.listParentRef !== undefined
        ? await applyStructureEdit({
            kind: 'insert',
            target: {
              kind: 'child',
              parent: { loc: ctx.listParentRef.loc, tag: ctx.parentTag },
              where: 'end',
            },
            jsx,
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
    <div className="flex items-center gap-1 pt-0.5">
      <button
        type="button"
        data-testid="list-add-item"
        disabled={disabled}
        onClick={onAdd}
        className="border-line bg-field text-ink-soft hover:border-border hover:text-ink inline-flex h-6 cursor-pointer items-center gap-1 rounded border px-2 text-[11px] disabled:cursor-not-allowed disabled:opacity-40"
      >
        <ListPlus className="size-3" aria-hidden="true" />
        <span>{t('inspector.list.addItem')}</span>
      </button>
      <button
        type="button"
        data-testid="list-remove-item"
        disabled={disabled || !canRemove}
        onClick={onRemove}
        className="border-line bg-field text-ink-soft hover:border-border hover:text-ink inline-flex h-6 cursor-pointer items-center gap-1 rounded border px-2 text-[11px] disabled:cursor-not-allowed disabled:opacity-40"
      >
        <ListMinus className="size-3" aria-hidden="true" />
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
      onAdd={() => void runAction(() => addListItem(ctx, i18n.language.startsWith('vi')))}
      onRemove={() => {
        const item = ctx.itemTargetRef;
        if (item === undefined) return;
        void runAction(async () => {
          await applyStructureEdit({
            kind: 'remove',
            elements: [{ loc: item.loc, tag: ctx.itemTag }],
          });
          if (ctx.listParentRef !== undefined) {
            useSelectionStore
              .getState()
              .setSelectedRefs([{ loc: ctx.listParentRef.loc, index: 0 }]);
          }
        });
      }}
    />
  );
}
