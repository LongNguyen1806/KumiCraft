// LayerTree row rendering component (SPEC-04 M-LT).
import type { TreeNode } from '@kumicraft/shared';
import { memo } from 'react';
import { useTranslation } from 'react-i18next';

import { studioBridgeChannel } from '../../core/bridge-channel.ts';
import { useDndStore } from '../../core/dnd-store.ts';
import type { VisibleNodeMeta } from './layer-tree-utils.ts';

const CHEVRON_EXPANDED = '▾';
const CHEVRON_COLLAPSED = '▸';

export type LayerTreeRowProps = {
  readonly meta: VisibleNodeMeta;
  readonly isSelected: boolean;
  readonly isHovered: boolean;
  readonly isCollapsed: boolean;
  readonly rowRef?: React.Ref<HTMLDivElement> | undefined;
  readonly onNodeClick: (node: TreeNode) => void;
  readonly onNodeHover: (node: TreeNode) => void;
  readonly onMouseLeave: () => void;
  readonly onToggleCollapse: (loc: string, e: React.MouseEvent) => void;
};

function LayerTreeRowBadges({
  instances,
  isBoundary,
  componentName,
}: {
  readonly instances: number;
  readonly isBoundary?: boolean | undefined;
  readonly componentName?: string | undefined;
}) {
  return (
    <div className="ml-auto flex items-center gap-1">
      {instances > 1 && (
        <span
          data-testid="instances-badge"
          className="rounded bg-field px-1 py-0.5 font-mono text-[10px] text-ink-faint"
        >
          {`×${String(instances)}`}
        </span>
      )}
      {isBoundary && componentName && (
        <span
          data-testid="component-badge"
          className="rounded bg-accent-soft px-1 py-0.5 text-[10px] font-medium text-accent"
        >
          {componentName}
        </span>
      )}
    </div>
  );
}

function LayerTreeChevronButton({
  hasChildren,
  isCollapsed,
  loc,
  onToggleCollapse,
}: {
  readonly hasChildren: boolean;
  readonly isCollapsed: boolean;
  readonly loc: string;
  readonly onToggleCollapse: (loc: string, e: React.MouseEvent) => void;
}) {
  const { t } = useTranslation();
  if (!hasChildren) {
    return <span className="w-4" />;
  }
  return (
    <button
      type="button"
      onClick={(e) => {
        onToggleCollapse(loc, e);
      }}
      className="flex h-4 w-4 items-center justify-center rounded text-ink-faint hover:text-ink"
      aria-label={isCollapsed ? t('editor.expand') : t('editor.collapse')}
    >
      <span className="text-[10px]" aria-hidden="true">
        {isCollapsed ? CHEVRON_COLLAPSED : CHEVRON_EXPANDED}
      </span>
    </button>
  );
}

function getRowClassName(isSelected: boolean, isHovered: boolean): string {
  const base =
    'group flex h-[26px] cursor-pointer items-center gap-1.5 rounded-[5px] px-1.5 transition-colors';
  if (isSelected) {
    return `${base} bg-accent-soft font-medium text-ink shadow-[inset_2px_0_0_var(--color-accent)]`;
  }
  if (isHovered) return `${base} bg-field-hover text-ink`;
  return `${base} text-ink-soft hover:bg-field hover:text-ink`;
}

function LayerTreeRowLabel({
  tag,
  label,
}: {
  readonly tag: string;
  readonly label?: string | undefined;
}) {
  return (
    <>
      <span className="font-mono text-[11.5px] font-medium text-ink">{tag}</span>
      {label && (
        <span className="truncate font-mono text-[11px] text-ink-faint group-hover:text-ink-soft">
          {label}
        </span>
      )}
    </>
  );
}

function handleLayerDragStart(e: React.DragEvent, node: TreeNode): void {
  e.dataTransfer.setData('text/plain', node.tag);
  e.dataTransfer.effectAllowed = 'move';
  useDndStore.getState().startDrag({ source: 'layer', ref: node.ref, tag: node.tag });
}

function handleLayerDragEnd(): void {
  if (useDndStore.getState().drag !== undefined) {
    studioBridgeChannel.dragEnd(false);
    useDndStore.getState().endDrag();
  }
}

function LayerTreeRowView(props: LayerTreeRowProps) {
  const { meta, isSelected, isHovered, isCollapsed, rowRef, onMouseLeave, onToggleCollapse } =
    props;
  const { node, depth, hasChildren, isBoundary, componentName } = meta;

  return (
    <div
      ref={rowRef}
      role="treeitem"
      tabIndex={0}
      draggable
      aria-selected={isSelected}
      aria-expanded={hasChildren ? !isCollapsed : undefined}
      onClick={() => {
        props.onNodeClick(node);
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          props.onNodeClick(node);
        }
      }}
      onMouseEnter={() => {
        props.onNodeHover(node);
      }}
      onMouseLeave={onMouseLeave}
      onDragStart={(e) => {
        handleLayerDragStart(e, node);
      }}
      onDragEnd={handleLayerDragEnd}
      style={{ paddingLeft: `${String(depth * 12 + 6)}px` }}
      className={getRowClassName(isSelected, isHovered)}
    >
      <LayerTreeChevronButton
        hasChildren={hasChildren}
        isCollapsed={isCollapsed}
        loc={node.ref.loc}
        onToggleCollapse={onToggleCollapse}
      />
      <LayerTreeRowLabel tag={node.tag} label={node.label} />
      <LayerTreeRowBadges
        instances={node.instances}
        isBoundary={isBoundary}
        componentName={componentName}
      />
    </div>
  );
}

/**
 * R-SL-12: a hover or a selection changes two rows; the others keep their props (stable `meta`,
 * callbacks and no ref) and are not rendered again, so a 5,000-node tree scrolls smoothly.
 */
export const LayerTreeRow = memo(LayerTreeRowView);
