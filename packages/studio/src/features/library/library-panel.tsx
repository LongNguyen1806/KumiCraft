// Library panel with categories, search, drag and double-click insert (SPEC-04.1 section 10, M-LB).
import { useDraggable } from '@dnd-kit/core';
import {
  assignIds,
  canInsert,
  CONTAINER_TYPES,
  type DesignOperation,
  instantiatePreset,
  type Preset,
  type PresetCategory,
  PRESETS,
  type TreeTarget,
} from '@reactcraft/model';
import {
  AlignLeft,
  AppWindow,
  Badge,
  Box,
  CheckSquare,
  ChevronDown,
  CircleDot,
  Columns3,
  CreditCard,
  FileSpreadsheet,
  FileText,
  Folder,
  Grid3X3,
  Heading,
  Image,
  Layout,
  LayoutGrid,
  Link,
  List,
  Minus,
  PanelBottom,
  PanelLeft,
  PanelTop,
  Rows3,
  Sparkles,
  Square,
  Star,
  Table,
  TextCursorInput,
  ToggleLeft,
  Type,
  User,
} from 'lucide-react';
import type { ComponentType, ReactNode } from 'react';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { useEditorStore } from '../../store/editor-store.ts';

const CATEGORIES: readonly PresetCategory[] = ['layout', 'content', 'form', 'data', 'composite'];

const ICON_MAP: Record<string, ComponentType<{ size?: number; className?: string }>> = {
  'rows-3': Rows3,
  'columns-3': Columns3,
  'grid-3x3': Grid3X3,
  'layout-grid': LayoutGrid,
  layout: Layout,
  box: Box,
  heading: Heading,
  type: Type,
  image: Image,
  star: Star,
  link: Link,
  minus: Minus,
  badge: Badge,
  user: User,
  'file-text': FileText,
  'text-cursor-input': TextCursorInput,
  'align-left': AlignLeft,
  'chevron-down': ChevronDown,
  'check-square': CheckSquare,
  'circle-dot': CircleDot,
  'toggle-left': ToggleLeft,
  square: Square,
  table: Table,
  list: List,
  'file-spreadsheet': FileSpreadsheet,
  'credit-card': CreditCard,
  'panel-top': PanelTop,
  'panel-left': PanelLeft,
  'panel-bottom': PanelBottom,
  'app-window': AppWindow,
  folder: Folder,
  sparkles: Sparkles,
};

function PresetIcon({ name }: { readonly name: string }): ReactNode {
  const IconComponent = ICON_MAP[name] ?? Box;
  return <IconComponent size={16} className="text-ink-soft shrink-0" />;
}

function resolveInsertTarget(
  selectedId: string | undefined,
  flatNodes: Record<string, { type: string; parentId?: string; childIds: readonly string[] }>,
  rootId: string,
): string {
  if (!selectedId || !flatNodes[selectedId]) return rootId;
  const selNode = flatNodes[selectedId];
  if (CONTAINER_TYPES.has(selNode.type as never)) return selectedId;
  if (selNode.parentId && CONTAINER_TYPES.has(flatNodes[selNode.parentId]?.type as never)) {
    return selNode.parentId;
  }
  return rootId;
}

function handleDoubleClickInsert(preset: Preset): void {
  const store = useEditorStore.getState();
  const doc = store.document;
  if (!doc) return;
  const activePageId = store.activePageId;
  if (!activePageId) return;
  const treeTarget: TreeTarget = { kind: 'page', pageId: activePageId };
  const rootId = doc.pages[activePageId]?.root.id;
  if (!rootId) return;

  const targetContainerId = resolveInsertTarget(store.selectedNodeId, store.flatNodes, rootId);
  // R-LB-02: tokens the workspace no longer has become plain values.
  const { node: rawNode } = instantiatePreset(preset, {
    tokens: doc.tokens,
    contentLocale: doc.workspace.contentLocale,
  });

  const check = canInsert(doc, treeTarget, targetContainerId, { kind: 'new', node: rawNode }, 0);
  const finalContainerId = check.ok ? targetContainerId : rootId;
  const containerNode = store.flatNodes[finalContainerId];
  const index = containerNode?.childIds.length ?? 0;

  const rawOp: DesignOperation = {
    op: 'insert',
    target: treeTarget,
    parentId: finalContainerId,
    index,
    node: rawNode,
  };
  const { ops } = assignIds([rawOp]);
  const [inserted] = ops;
  const res = store.dispatch(ops, { label: 'Insert from Library', source: 'user' });
  if (res.ok && inserted?.op === 'insert') store.selectNode(inserted.node.id);
}

function translateLibraryKey(t: unknown, key: string): string {
  const translator = t as (k: string) => string;
  return translator(key);
}

function LibraryItem({ preset }: { readonly preset: Preset }): ReactNode {
  const { t } = useTranslation();
  const { attributes, listeners, setNodeRef } = useDraggable({ id: `preset:${preset.id}` });
  const shortId = preset.id.includes('.') ? (preset.id.split('.').pop() ?? preset.id) : preset.id;
  const label = translateLibraryKey(t, `library.${preset.labelKey}`);

  return (
    <button
      ref={setNodeRef}
      type="button"
      data-testid={`library-item-${shortId}`}
      data-preset-id={preset.id}
      {...attributes}
      {...listeners}
      onDoubleClick={() => {
        handleDoubleClickInsert(preset);
      }}
      className="flex h-9 w-full items-center gap-2 rounded-lg px-2 text-left text-sm text-ink-soft transition-colors hover:bg-field hover:text-ink cursor-grab active:cursor-grabbing"
    >
      <PresetIcon name={preset.icon} />
      <span className="truncate">{label}</span>
    </button>
  );
}

function CategorySection({
  category,
  presets,
}: {
  readonly category: PresetCategory;
  readonly presets: readonly Preset[];
}): ReactNode {
  const { t } = useTranslation();
  if (presets.length === 0) return undefined;
  const catLabel = translateLibraryKey(t, `library.category.${category}`);
  return (
    <div className="flex flex-col gap-1">
      <h3 className="px-2 text-[11px] font-semibold uppercase tracking-wider text-ink-faint">
        {catLabel}
      </h3>
      <div className="grid gap-0.5">
        {presets.map((preset) => (
          <LibraryItem key={preset.id} preset={preset} />
        ))}
      </div>
    </div>
  );
}

export function LibraryPanel(): ReactNode {
  const { t, i18n } = useTranslation();
  const [query, setQuery] = useState('');

  const filteredPresets = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return PRESETS;
    return PRESETS.filter((p) => {
      const viVal: unknown = i18n.getResource('vi', 'common', `library.${p.labelKey}`);
      const enVal: unknown = i18n.getResource('en', 'common', `library.${p.labelKey}`);
      const viLabel = typeof viVal === 'string' ? viVal : '';
      const enLabel = typeof enVal === 'string' ? enVal : '';
      const current = translateLibraryKey(t, `library.${p.labelKey}`);
      return (
        p.id.toLowerCase().includes(q) ||
        current.toLowerCase().includes(q) ||
        viLabel.toLowerCase().includes(q) ||
        enLabel.toLowerCase().includes(q)
      );
    });
  }, [query, t, i18n]);

  return (
    <div className="flex flex-col gap-3" data-testid="library-panel">
      <div className="px-1">
        <input
          type="search"
          data-testid="library-search"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
          }}
          placeholder={t('library.searchPlaceholder')}
          className="h-8 w-full rounded-md border border-neutral-200 bg-white px-2.5 text-xs text-ink placeholder:text-ink-faint focus:border-charcoal focus:outline-none"
        />
      </div>

      <div className="flex flex-col gap-4 overflow-y-auto">
        {CATEGORIES.map((cat) => (
          <CategorySection
            key={cat}
            category={cat}
            presets={filteredPresets.filter((p) => p.category === cat)}
          />
        ))}
      </div>
    </div>
  );
}
