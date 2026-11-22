// SelectGroup controls for multi-selection, containers, and SelectGroup management (K9.8-1 TK-73).
import {
  type ElementRef,
  type ElementSource,
  parseLocString,
  type SelectGroupMode,
  type StyleSystemId,
  type TreeNode,
} from '@kumicraft/shared';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { applyInteraction } from '../../../../api/interaction-client.ts';
import { fetchComponentProps } from '../../../../api/project-client.ts';
import { studioBridgeChannel } from '../../../../core/bridge-channel.ts';
import { useSelectionStore } from '../../../../core/selection-store.ts';
import type { MultiTargetItem } from '../../types.ts';
import {
  directChildrenOf,
  findParentIndex,
  InteractionErrorNotice,
  ToolActionButton,
  useInteractionTask,
} from './interaction-shared.tsx';
import {
  collectSelectGroupTargets,
  linkItemsOf,
  SELECT_CONTAINER_TAGS,
} from './select-group-tree.ts';

export { SELECT_CONTAINER_TAGS };

const SELECT_MODES: readonly SelectGroupMode[] = ['single', 'multiple'];

type MultiSelectInvalidReason =
  'needTwoItems' | 'differentFiles' | 'insideLoop' | 'dynamicClass' | 'differentParents';

function validateMultiSelectGroup(
  items: readonly MultiTargetItem[],
  treeNodes: readonly TreeNode[],
): MultiSelectInvalidReason | undefined {
  if (items.length < 2) return 'needTwoItems';
  const files = new Set(items.map((i) => parseLocString(i.ref.loc)?.file));
  if (files.size > 1) return 'differentFiles';
  if (items.some((i) => i.source?.inLoop === true)) return 'insideLoop';
  if (items.some((i) => i.source?.className.kind === 'expression')) return 'dynamicClass';
  if (treeNodes.length > 0) {
    const parents = new Set(items.map((i) => findParentIndex(treeNodes, i.ref)));
    if (parents.size > 1 || parents.has(undefined)) return 'differentParents';
  }
  return undefined;
}

function ModeRadios({
  mode,
  onChange,
}: {
  readonly mode: SelectGroupMode;
  readonly onChange: (m: SelectGroupMode) => void;
}) {
  const { t } = useTranslation();
  return (
    <div className="flex items-center gap-2 text-[11px] text-ink-soft">
      {SELECT_MODES.map((m) => (
        <label key={m} className="flex items-center gap-1">
          <input
            type="radio"
            name="select-group-mode"
            data-testid={`select-group-mode-${m}`}
            checked={mode === m}
            onChange={() => {
              onChange(m);
            }}
          />
          {t(m === 'single' ? 'interaction.selectModeSingle' : 'interaction.selectModeMultiple')}
        </label>
      ))}
    </div>
  );
}

export function SelectGroupMultiControls({
  items,
  styleSystem,
  onDone,
}: {
  readonly items: readonly MultiTargetItem[];
  readonly styleSystem?: StyleSystemId | undefined;
  readonly onDone: () => void;
}) {
  const { t } = useTranslation();
  const treeNodes = useSelectionStore((s) => s.treeNodes);
  const [mode, setMode] = useState<SelectGroupMode>('single');
  const { busy, error, run } = useInteractionTask(onDone);
  const invalidKey = validateMultiSelectGroup(items, treeNodes);
  const disabledReason =
    invalidKey !== undefined ? t(`interaction.reasons.${invalidKey}`) : undefined;
  const elements = items.map((item) => ({ loc: item.ref.loc, tag: item.source?.tag ?? 'div' }));

  return (
    <div className="flex flex-col gap-1.5">
      <ModeRadios mode={mode} onChange={setMode} />
      <ToolActionButton
        testId="make-select-group"
        label={t('interaction.makeSelectGroup')}
        tooltip={t('interaction.makeSelectGroupTooltip')}
        disabledReason={disabledReason}
        busy={busy}
        onClick={() => {
          void run(() =>
            applyInteraction({
              action: 'makeSelectGroup',
              elements,
              mode,
              ...(styleSystem !== undefined ? { styleSystem } : {}),
            }),
          );
        }}
      />
      <InteractionErrorNotice error={error} />
    </div>
  );
}

function PanelPreviewButtons({
  selectItems,
  groupRef,
}: {
  readonly selectItems: readonly TreeNode[];
  readonly groupRef: ElementRef;
}) {
  const { t } = useTranslation();
  const [activePreview, setActivePreview] = useState<number>();
  if (selectItems.length === 0) return undefined;
  return (
    <div className="flex flex-wrap items-center gap-1" data-testid="select-preview-buttons">
      <span className="text-[10px] text-ink-soft">{t('interaction.previewChoice')}</span>
      {selectItems.map((item, idx) => (
        <button
          key={`${item.ref.loc}#${String(item.ref.index)}`}
          type="button"
          data-testid={`preview-select-item-${String(idx)}`}
          onClick={() => {
            setActivePreview(idx);
            studioBridgeChannel.setSelectPanelPreview(groupRef, idx);
          }}
          className={`rounded border px-1.5 py-0.5 text-[10px] ${
            activePreview === idx
              ? 'border-accent bg-accent-soft font-semibold text-accent'
              : 'border-line bg-card-solid text-ink hover:bg-field'
          }`}
        >
          {String(idx + 1)}
        </button>
      ))}
    </div>
  );
}

type ResolvedSelectGroup = {
  readonly isSelectGroup: boolean;
  /** Reached through one of its items: the group renders no element of its own (QA K9.8-1). */
  readonly viaItem: boolean;
  readonly groupLoc: string;
  readonly groupTag: string;
  readonly resolving: boolean;
};

type BoundaryResolved = { readonly key: string; readonly loc: string; readonly tag: string };

function useResolvedSelectGroup(source: ElementSource): ResolvedSelectGroup {
  const selectionInfo = useSelectionStore((s) => s.selectionInfo);
  const parentLoc = selectionInfo.find((i) => i.ref.loc === source.loc)?.ancestors?.[0]?.loc;
  // A choice (SelectItem) is selectable on the Canvas: it opens its group's tools (QA K9.8-1).
  const isDirect = source.tag === 'SelectGroup' || source.tag === 'SelectItem';
  const kitName = source.component?.name;
  const viaItem = source.tag === 'SelectItem' || kitName === 'SelectItem';
  const isBoundary =
    !isDirect &&
    (kitName === 'SelectGroup' || viaItem) &&
    parentLoc !== undefined &&
    parseLocString(parentLoc)?.file !== parseLocString(source.loc)?.file;
  const queryKey = isBoundary ? `${source.loc}:${parentLoc}:${source.fileHash}` : '';
  const targetParent = parentLoc ?? '';
  const [resolved, setResolved] = useState<BoundaryResolved>();

  useEffect(() => {
    if (!isBoundary) return undefined;
    let cancelled = false;
    async function load() {
      try {
        const res = await fetchComponentProps({
          loc: source.loc,
          tag: source.tag,
          parentLoc: targetParent,
          componentName: viaItem ? 'SelectItem' : 'SelectGroup',
        });
        if (!cancelled && res.loc !== undefined)
          setResolved({ key: queryKey, loc: res.loc, tag: res.tag });
      } catch {
        /* wait for next refresh */
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [isBoundary, queryKey, source.loc, source.tag, targetParent, viaItem]);

  const plain = { viaItem, groupLoc: source.loc, groupTag: source.tag, resolving: false };
  if (isDirect) return { ...plain, isSelectGroup: true };
  if (!isBoundary) return { ...plain, isSelectGroup: false };
  const matched = resolved?.key === queryKey ? resolved : undefined;
  return {
    isSelectGroup: true,
    viaItem,
    groupLoc: matched?.loc ?? source.loc,
    groupTag: matched?.tag ?? 'SelectGroup',
    resolving: matched === undefined,
  };
}

function SelectGroupLinkRow({
  groupLoc,
  candidates,
  busy,
  onLink,
}: {
  readonly groupLoc: string;
  readonly candidates: readonly TreeNode[];
  readonly busy: boolean;
  readonly onLink: (target: TreeNode) => void;
}) {
  const { t } = useTranslation();
  const [linkLoc, setLinkLoc] = useState(candidates[0]?.ref.loc ?? '');
  const chosen = candidates.find((c) => c.ref.loc === linkLoc) ?? candidates[0];
  return (
    <div className="flex items-center gap-1" data-group-loc={groupLoc}>
      <select
        data-testid="select-group-link-target"
        aria-label={t('interaction.linkContentTarget')}
        value={chosen?.ref.loc ?? ''}
        onChange={(e) => {
          setLinkLoc(e.target.value);
        }}
        className="h-[26px] min-w-0 flex-1 rounded border border-line bg-card-solid px-1.5 text-[11px] text-ink"
      >
        {candidates.map((c) => (
          <option key={c.ref.loc} value={c.ref.loc}>
            &lt;{c.tag}&gt;{c.label ? ` ${c.label}` : ''}
          </option>
        ))}
      </select>
      <button
        type="button"
        data-testid="select-group-link"
        title={t('interaction.linkSelectTooltip')}
        disabled={busy || chosen === undefined}
        onClick={() => {
          if (chosen !== undefined) onLink(chosen);
        }}
        className="h-[26px] shrink-0 rounded border border-line bg-card-solid px-2 text-[11px] font-medium text-ink hover:bg-field disabled:opacity-50"
      >
        {t('interaction.linkContent')}
      </button>
    </div>
  );
}

type PanelManagerProps = {
  readonly resolved: ResolvedSelectGroup;
  readonly refTarget: ElementRef;
  readonly styleSystem?: StyleSystemId | undefined;
  readonly onDone: () => void;
};

const nodeGuard = (node: TreeNode) => ({ loc: node.ref.loc, tag: node.tag });

function SelectGroupPanelManager({ resolved, refTarget, styleSystem, onDone }: PanelManagerProps) {
  const { t } = useTranslation();
  const treeNodes = useSelectionStore((s) => s.treeNodes);
  const { selectItems, linkCandidates } = collectSelectGroupTargets(
    treeNodes,
    refTarget,
    resolved.groupLoc,
    resolved.viaItem,
  );
  const { busy, error, run } = useInteractionTask(onDone);
  const disabled = busy || resolved.resolving;
  const group = { loc: resolved.groupLoc, tag: resolved.groupTag };
  const items = linkItemsOf(selectItems, resolved.groupLoc);
  const onLink = (node: TreeNode) =>
    void run(() =>
      applyInteraction({ action: 'linkSelectContent', group, items, target: nodeGuard(node) }),
    );
  const onRemove = () =>
    void run(() =>
      applyInteraction({
        action: 'removeSelectGroup',
        group,
        ...(styleSystem !== undefined ? { styleSystem } : {}),
      }),
    );

  return (
    <div className="flex flex-col gap-1.5">
      <PanelPreviewButtons selectItems={selectItems} groupRef={refTarget} />
      <SelectGroupLinkRow
        groupLoc={resolved.groupLoc}
        candidates={linkCandidates}
        busy={disabled}
        onLink={onLink}
      />
      <ToolActionButton
        testId="remove-select-group"
        label={t('interaction.removeSelectGroup')}
        tooltip={t('interaction.removeSelectGroupTooltip')}
        variant="danger"
        busy={disabled}
        onClick={onRemove}
      />
      <InteractionErrorNotice error={error} />
    </div>
  );
}

type SelectSingleProps = {
  readonly source: ElementSource;
  readonly refTarget: ElementRef;
  readonly styleSystem?: StyleSystemId | undefined;
  readonly onDone: () => void;
};

function singleContainerReasonKey(
  source: ElementSource,
  childCount: number,
): 'readonly' | 'insideLoop' | 'needTwoChildren' | undefined {
  if (source.readonly !== undefined) return 'readonly';
  if (source.inLoop) return 'insideLoop';
  return childCount < 2 ? 'needTwoChildren' : undefined;
}

export function SelectGroupSingleControls({
  source,
  refTarget,
  styleSystem,
  onDone,
}: SelectSingleProps) {
  const { t } = useTranslation();
  const treeNodes = useSelectionStore((s) => s.treeNodes);
  const { busy, error, run } = useInteractionTask(onDone);
  const resolved = useResolvedSelectGroup(source);
  if (resolved.isSelectGroup) {
    return (
      <SelectGroupPanelManager
        resolved={resolved}
        refTarget={refTarget}
        styleSystem={styleSystem}
        onDone={onDone}
      />
    );
  }
  if (!SELECT_CONTAINER_TAGS.has(source.tag)) return undefined;

  const children = directChildrenOf(treeNodes, refTarget);
  const reasonKey = singleContainerReasonKey(source, children.length);
  const onMake = () =>
    void run(() =>
      applyInteraction({
        action: 'makeSelectGroup',
        elements: children.map((c) => ({ loc: c.ref.loc, tag: c.tag })),
        mode: 'single',
        ...(styleSystem !== undefined ? { styleSystem } : {}),
      }),
    );

  return (
    <div className="flex flex-col gap-1">
      <ToolActionButton
        testId="make-select-group"
        label={t('interaction.makeSelectGroup')}
        tooltip={t('interaction.makeSelectGroupTooltip')}
        disabledReason={reasonKey !== undefined ? t(`interaction.reasons.${reasonKey}`) : undefined}
        busy={busy}
        onClick={onMake}
      />
      <InteractionErrorNotice error={error} />
    </div>
  );
}
