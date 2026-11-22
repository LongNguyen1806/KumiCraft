// Selected-state guard and group-hover parent picker (K9.8-1 TK-74). Dark mode tools were removed:
// dark mode is a project-wide job handed to the AI (Library tile "Dark mode").
import { type ElementInfo, type ElementRef, type TreeNode } from '@kumicraft/shared';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { fetchElementSourceByLoc } from '../../../api/source-client.ts';
import { sendEdit } from '../../../core/edits.ts';
import { useSelectionStore } from '../../../core/selection-store.ts';
import type { InspectorTarget } from '../types.ts';

type ElementTarget = Extract<InspectorTarget, { readonly kind: 'element' }>;

export function canEnableSelectedState(
  source: ElementTarget['source'],
  ref: ElementRef | undefined,
  selectionInfo: readonly ElementInfo[],
  treeNodes: readonly TreeNode[],
): boolean {
  if (source?.tag === 'SelectItem') return true;
  if (ref === undefined) return false;
  const tag = source?.tag ?? '';
  if (tag !== 'a' && tag !== 'Link') return false;
  const info = selectionInfo.find((i) => i.ref.loc === ref.loc && i.ref.index === ref.index);
  const ancestors = info?.ancestors ?? [];
  return ancestors.some((anc) => {
    const node = treeNodes.find((t) => t.ref.loc === anc.loc && t.ref.index === anc.index);
    return node?.tag === 'ScrollSpy';
  });
}

type AncestorOption = {
  readonly ref: ElementRef;
  readonly label: string;
};

function useAncestorOptions(ref: ElementRef): readonly AncestorOption[] {
  const selectionInfo = useSelectionStore((s) => s.selectionInfo);
  const treeNodes = useSelectionStore((s) => s.treeNodes);
  const info = selectionInfo.find((i) => i.ref.loc === ref.loc && i.ref.index === ref.index);
  const rawAncestors = info?.ancestors ?? [];
  return rawAncestors.map((anc) => {
    const node = treeNodes.find((t) => t.ref.loc === anc.loc && t.ref.index === anc.index);
    const label = node ? `<${node.tag}>${node.label ? ` ${node.label}` : ''}` : anc.loc;
    return { ref: anc, label };
  });
}

async function ensureGroupClassOnAncestor(ancRef: ElementRef): Promise<boolean> {
  const src = await fetchElementSourceByLoc(ancRef.loc);
  if (src === undefined) return false;
  if (src.className.kind !== 'static' && src.className.kind !== 'none') return false;
  const before = src.className.kind === 'static' ? src.className.value : '';
  if (/\bgroup\b/.test(before)) return true;
  await sendEdit({
    edit: {
      kind: 'setClasses',
      loc: src.loc,
      tag: src.tag,
      before,
      steps: [{ kind: 'addClass', name: 'group' }],
    },
  });
  return true;
}

function ancKey(ref: ElementRef): string {
  return `${ref.loc}#${String(ref.index)}`;
}

function AncestorSelect({
  options,
  value,
  onPick,
}: {
  readonly options: ReturnType<typeof useAncestorOptions>;
  readonly value: string;
  readonly onPick: (key: string) => void;
}) {
  return (
    <select
      data-testid="group-hover-parent-select"
      value={value}
      onChange={(e) => {
        onPick(e.target.value);
      }}
      className="h-[24px] min-w-0 flex-1 rounded border border-line bg-card-solid px-1.5 text-[11px] text-ink"
    >
      {options.map((opt) => (
        <option key={ancKey(opt.ref)} value={ancKey(opt.ref)}>
          {opt.label}
        </option>
      ))}
    </select>
  );
}

export function GroupHoverParentPicker({
  target,
  onGroupChange,
}: {
  readonly target: ElementTarget;
  readonly onGroupChange: (ref: ElementRef | undefined) => void;
}) {
  const { t } = useTranslation();
  const options = useAncestorOptions(target.ref);
  const selectedKey = target.groupRef
    ? ancKey(target.groupRef)
    : options[0]
      ? ancKey(options[0].ref)
      : '';
  const [status, setStatus] = useState<string>();

  if (options.length === 0) return undefined;

  const handleSelectParent = async (key: string) => {
    const picked = options.find((o) => ancKey(o.ref) === key);
    onGroupChange(picked?.ref);
    if (picked !== undefined) {
      const ok = await ensureGroupClassOnAncestor(picked.ref);
      setStatus(ok ? t('inspector.groupParentReady') : undefined);
    }
  };

  return (
    <div className="flex flex-col gap-1 pt-0.5 text-[11px]">
      <div className="flex items-center gap-1.5">
        <span className="shrink-0 text-ink-soft">{t('inspector.groupParentLabel')}</span>
        <AncestorSelect
          options={options}
          value={selectedKey}
          onPick={(key) => {
            void handleSelectParent(key);
          }}
        />
        <button
          type="button"
          data-testid="add-group-class-btn"
          onClick={() => {
            void handleSelectParent(selectedKey);
          }}
          className="shrink-0 rounded border border-line bg-card-solid px-1.5 py-0.5 text-[10px] text-ink hover:bg-field"
        >
          {t('inspector.addGroupClass')}
        </button>
      </div>
      {status !== undefined && <span className="text-[10px] text-accent">{status}</span>}
    </div>
  );
}
