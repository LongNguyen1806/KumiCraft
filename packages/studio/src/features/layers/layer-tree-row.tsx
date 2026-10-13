// Layer Tree row component (SPEC-04.1 section 12, R-LT-02, R-LT-04).
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { DesignNode, NodeRecord, TreeTarget } from '@reactcraft/model';
import {
  AlignLeft,
  AppWindow,
  Badge,
  Box,
  Boxes,
  CheckSquare,
  ChevronDown,
  ChevronRight,
  CircleDot,
  CreditCard,
  Eye,
  EyeOff,
  FileText,
  Folder,
  Heading,
  Image,
  Layout,
  LayoutGrid,
  Link2,
  List,
  Lock,
  Minus,
  Square,
  Star,
  Table,
  TextCursorInput,
  ToggleLeft,
  Type,
  Unlock,
  User,
} from 'lucide-react';
import type { ComponentType, ReactNode } from 'react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { useEditorStore } from '../../store/editor-store.ts';

export type LayerRowData = {
  readonly id: string;
  readonly nodeId: string;
  readonly depth: number;
  readonly hasChildren: boolean;
  readonly isExpanded: boolean;
  readonly isSlot?: boolean;
  readonly slotName?: string;
};

const NODE_ICON_MAP: Record<string, ComponentType<{ size?: number; className?: string }>> = {
  Stack: Box,
  Container: Box,
  Section: Layout,
  Grid: LayoutGrid,
  Heading,
  Text: Type,
  Image,
  Icon: Star,
  Link: Link2,
  Divider: Minus,
  Badge,
  Avatar: User,
  Button: Square,
  Form: FileText,
  Input: TextCursorInput,
  Textarea: AlignLeft,
  Select: ChevronDown,
  Checkbox: CheckSquare,
  Radio: CircleDot,
  Switch: ToggleLeft,
  Table,
  List,
  Card: CreditCard,
  Modal: AppWindow,
  Tabs: Folder,
  ComponentInstance: Boxes,
};

function NodeIcon({ type }: { readonly type: string }): ReactNode {
  const IconComponent = NODE_ICON_MAP[type] ?? Box;
  return <IconComponent size={14} className="shrink-0 text-ink-soft" />;
}

type RowActionProps = {
  readonly node: DesignNode | NodeRecord;
  readonly treeTarget: TreeTarget;
};

type MetaToggleProps = {
  readonly node: DesignNode | NodeRecord;
  readonly treeTarget: TreeTarget;
  readonly field: 'hidden' | 'locked';
};

/** Hide/show or lock/unlock: one `setNodeMeta`, one Undo step (R-LT-02). */
function MetaToggle({ node, treeTarget, field }: MetaToggleProps): ReactNode {
  const { t } = useTranslation();
  const on = node[field] === true;
  const toggle = () => {
    useEditorStore
      .getState()
      .dispatch([{ op: 'setNodeMeta', target: treeTarget, nodeId: node.id, [field]: !on }], {
        label: field === 'hidden' ? 'Hide or show' : 'Lock or unlock',
        source: 'user',
      });
  };
  const title =
    field === 'hidden'
      ? t(on ? 'layers.actions.show' : 'layers.actions.hide')
      : t(on ? 'layers.actions.unlock' : 'layers.actions.lock');
  const icon =
    field === 'hidden' ? (
      on ? (
        <EyeOff size={13} className="text-danger" />
      ) : (
        <Eye size={13} />
      )
    ) : on ? (
      <Lock size={13} className="text-sun" />
    ) : (
      <Unlock size={13} />
    );
  return (
    <button
      type="button"
      data-testid={`layer-${field === 'hidden' ? 'hide' : 'lock'}-${node.id}`}
      title={title}
      aria-label={title}
      aria-pressed={on}
      onClick={(e) => {
        e.stopPropagation();
        toggle();
      }}
      onPointerDown={(e) => {
        e.stopPropagation();
      }}
      className="cursor-pointer p-0.5 text-ink-faint hover:text-ink"
    >
      {icon}
    </button>
  );
}

function RowActions({ node, treeTarget }: RowActionProps): ReactNode {
  const { t } = useTranslation();
  return (
    <div className="ml-auto flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
      {node.bindings && Object.keys(node.bindings).length > 0 && (
        <span title={t('layers.binding')} className="text-ink-faint">
          <Link2 size={12} />
        </span>
      )}
      <MetaToggle node={node} treeTarget={treeTarget} field="hidden" />
      <MetaToggle node={node} treeTarget={treeTarget} field="locked" />
    </div>
  );
}

type RenameInputProps = {
  readonly initialName: string;
  readonly onFinish: (newName?: string) => void;
};

function RenameInput({ initialName, onFinish }: RenameInputProps): ReactNode {
  const [value, setValue] = useState(initialName);

  return (
    <input
      ref={(el) => {
        el?.focus();
      }}
      type="text"
      data-testid="layer-rename-input"
      value={value}
      onChange={(e) => {
        setValue(e.target.value);
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter') onFinish(value.trim() || undefined);
        else if (e.key === 'Escape') onFinish(undefined);
      }}
      onBlur={() => {
        onFinish(value.trim() || undefined);
      }}
      className="h-5 flex-1 rounded border border-neutral-300 bg-white px-1 text-xs text-ink focus:border-charcoal focus:outline-none"
    />
  );
}

function ExpandButton({
  nodeId,
  hasChildren,
  isExpanded,
  onToggleExpand,
}: {
  readonly nodeId: string;
  readonly hasChildren: boolean;
  readonly isExpanded: boolean;
  readonly onToggleExpand: (nodeId: string) => void;
}): ReactNode {
  if (!hasChildren) return <span className="w-4 shrink-0" />;
  return (
    <span
      role="button"
      tabIndex={0}
      data-testid={`layer-expand-${nodeId}`}
      onClick={(e) => {
        e.stopPropagation();
        onToggleExpand(nodeId);
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.stopPropagation();
          onToggleExpand(nodeId);
        }
      }}
      className="p-0.5 text-ink-faint hover:text-ink cursor-pointer"
    >
      {isExpanded ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
    </span>
  );
}

export type LayerTreeRowProps = {
  readonly item: LayerRowData;
  readonly node: DesignNode | NodeRecord;
  readonly isSelected: boolean;
  readonly isHovered: boolean;
  readonly isRenaming: boolean;
  readonly onSelect: (nodeId: string) => void;
  readonly onToggleSelect: (nodeId: string) => void;
  readonly onHover: (nodeId: string | undefined) => void;
  readonly onToggleExpand: (nodeId: string) => void;
  readonly onStartRename: (nodeId: string) => void;
  readonly onFinishRename: (nodeId: string, newName?: string) => void;
  readonly onContextMenu: (e: React.MouseEvent, nodeId: string) => void;
};

function useRowSortable(nodeId: string, depth: number) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({
    id: `layer-node:${nodeId}`,
  });
  const { role: _role, ...sortableAttributes } = attributes;
  const style = {
    paddingLeft: 8 + depth * 14,
    transform: CSS.Transform.toString(transform),
    transition,
  };
  return { setNodeRef, sortableAttributes, listeners, style };
}

type RowContentProps = {
  readonly node: DesignNode | NodeRecord;
  readonly isRenaming: boolean;
  readonly onFinishRename: (nodeId: string, newName?: string) => void;
  readonly treeTarget: TreeTarget;
};

function nodeDisplayName(node: DesignNode | NodeRecord): string {
  if (node.name !== undefined && node.name.length > 0) return node.name;
  const content = node.content as { readonly text?: unknown } | undefined;
  if (typeof content?.text === 'string' && content.text.length > 0) return content.text;
  return node.type;
}

function RowContent({ node, isRenaming, onFinishRename, treeTarget }: RowContentProps): ReactNode {
  const displayName = nodeDisplayName(node);
  return (
    <>
      <NodeIcon type={node.type} />
      {isRenaming ? (
        <RenameInput
          initialName={node.name ?? displayName}
          onFinish={(newName) => {
            onFinishRename(node.id, newName);
          }}
        />
      ) : (
        <span className="truncate select-none font-medium">{displayName}</span>
      )}
      <RowActions node={node} treeTarget={treeTarget} />
    </>
  );
}

function useRowEvents(
  nodeId: string,
  onSelect: (id: string) => void,
  onToggleSelect: (id: string) => void,
  onStartRename: (id: string) => void,
  onContextMenu: (e: React.MouseEvent, id: string) => void,
  onHover: (id: string | undefined) => void,
) {
  return {
    onClick: (e: React.MouseEvent) => {
      if (e.shiftKey || e.ctrlKey || e.metaKey) onToggleSelect(nodeId);
      else onSelect(nodeId);
    },
    onDoubleClick: (e: React.MouseEvent) => {
      e.stopPropagation();
      onStartRename(nodeId);
    },
    onContextMenu: (e: React.MouseEvent) => {
      onContextMenu(e, nodeId);
    },
    onPointerEnter: () => {
      onHover(nodeId);
    },
    onPointerLeave: () => {
      onHover(undefined);
    },
  };
}

export function LayerTreeRow(props: LayerTreeRowProps): ReactNode {
  const { item, node, isSelected, isHovered, isRenaming, onToggleExpand, onFinishRename } = props;
  const { setNodeRef, sortableAttributes, listeners, style } = useRowSortable(node.id, item.depth);
  const events = useRowEvents(
    node.id,
    props.onSelect,
    props.onToggleSelect,
    props.onStartRename,
    props.onContextMenu,
    props.onHover,
  );
  const activePageId = useEditorStore((s) => s.activePageId);
  const treeTarget: TreeTarget = { kind: 'page', pageId: activePageId ?? 'p_home000001' };

  const rowClass = `group flex h-[30px] w-full items-center gap-1.5 rounded-md pr-2 text-xs text-left transition-colors cursor-pointer ${
    isSelected
      ? 'bg-charcoal text-on-charcoal'
      : isHovered
        ? 'bg-field text-ink'
        : 'text-ink-soft hover:bg-field hover:text-ink'
  }`;

  return (
    <div
      ref={setNodeRef}
      role="treeitem"
      aria-selected={isSelected}
      style={style}
      data-testid={`layer-row-${node.id}`}
      {...sortableAttributes}
      {...listeners}
      {...events}
      className={rowClass}
    >
      <ExpandButton
        nodeId={node.id}
        hasChildren={item.hasChildren}
        isExpanded={item.isExpanded}
        onToggleExpand={onToggleExpand}
      />
      <RowContent
        node={node}
        isRenaming={isRenaming}
        onFinishRename={onFinishRename}
        treeTarget={treeTarget}
      />
    </div>
  );
}
