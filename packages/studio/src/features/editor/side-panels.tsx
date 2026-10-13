import { type DesignNode, type Frame, type ResponsiveMode, walkTree } from '@reactcraft/model';
import { type ReactNode, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { useEditorStore } from '../../store/editor-store.ts';
import { InspectorPanel } from '../inspector/inspector-panel.tsx';
import { LayerTree } from '../layers/layer-tree.tsx';
import { LibraryPanel } from '../library/library-panel.tsx';

type PanelProps = {
  readonly label: string;
  readonly title: string;
  readonly count?: number;
  readonly tabs: ReactNode;
  readonly children: ReactNode;
};

/** A frosted panel: thin title, large thin count, pill tabs (approved mockup). */
function Panel({ label, title, count, tabs, children }: PanelProps) {
  return (
    <aside
      aria-label={label}
      className="flex min-h-0 min-w-0 flex-col overflow-hidden rounded-panel bg-card shadow-soft backdrop-blur-xl"
    >
      <div className="flex items-center gap-2 px-4 pt-4 pb-2.5">
        <h2 className="truncate text-[19px] font-light tracking-tight">{title}</h2>
        {count !== undefined && (
          <span className="ml-auto text-[26px] font-light tracking-tight tabular-nums">
            {count}
          </span>
        )}
      </div>
      <div role="tablist" className="mx-3 flex gap-0.5 rounded-full bg-field p-[3px]">
        {tabs}
      </div>
      <div className="min-h-0 flex-1 overflow-auto px-3 pt-2.5 pb-3.5">{children}</div>
    </aside>
  );
}

type TabProps = {
  readonly selected: boolean;
  readonly disabled?: boolean;
  readonly onSelect?: () => void;
  readonly children: ReactNode;
};

function Tab({ selected, disabled = false, onSelect, children }: TabProps) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={selected}
      disabled={disabled}
      onClick={onSelect}
      className="h-7 flex-1 rounded-full text-ink-soft disabled:opacity-50 aria-selected:bg-card-solid aria-selected:text-ink aria-selected:shadow-[0_1px_3px_rgb(60_52_30/0.12)]"
    >
      {children}
    </button>
  );
}

type Row = { readonly node: DesignNode; readonly depth: number };

export const rowsOf = (root: DesignNode | undefined): Row[] => {
  const rows: Row[] = [];
  if (root !== undefined) walkTree(root, (node, { depth }) => rows.push({ node, depth }));
  return rows;
};

type LeftPanelProps = {
  readonly root: DesignNode | undefined;
  readonly selectedNodeId?: string | undefined;
  readonly selectedNodeIds?: readonly string[];
  readonly hoveredNodeId?: string | undefined;
  readonly onSelect: (nodeId: string) => void;
  readonly onToggleSelect?: (nodeId: string) => void;
  readonly onHover?: (nodeId: string | undefined) => void;
};

/** Layers of the page and the Library (filled by drag and drop, WP-1.08). */
function LeftPanelTabs({
  isLayers,
  onSelectTab,
}: {
  readonly isLayers: boolean;
  readonly onSelectTab: (tab: 'layers' | 'library') => void;
}) {
  const { t } = useTranslation();
  return (
    <>
      <Tab
        selected={!isLayers}
        onSelect={() => {
          onSelectTab('library');
        }}
      >
        {t('editor.library')}
      </Tab>
      <Tab
        selected={isLayers}
        onSelect={() => {
          onSelectTab('layers');
        }}
      >
        {t('editor.layers')}
      </Tab>
    </>
  );
}

/** Layers of the page and the Library (filled by drag and drop, WP-1.08). */
export function LeftPanel({
  root,
  selectedNodeId,
  selectedNodeIds = selectedNodeId !== undefined ? [selectedNodeId] : [],
  hoveredNodeId,
  onSelect,
  onToggleSelect = onSelect,
  onHover = () => {},
}: LeftPanelProps) {
  const { t } = useTranslation();
  const [tab, setTab] = useState<'layers' | 'library'>('layers');
  const rows = rowsOf(root);
  const isLayers = tab === 'layers';

  return (
    <Panel
      label={t('editor.leftPanel')}
      title={t(isLayers ? 'editor.layers' : 'editor.library')}
      {...(isLayers ? { count: rows.length } : {})}
      tabs={<LeftPanelTabs isLayers={isLayers} onSelectTab={setTab} />}
    >
      {isLayers ? (
        <LayerTree
          root={root}
          selectedNodeIds={selectedNodeIds}
          hoveredNodeId={hoveredNodeId}
          onSelect={onSelect}
          onToggleSelect={onToggleSelect}
          onHover={onHover}
        />
      ) : (
        <LibraryPanel />
      )}
    </Panel>
  );
}

type RightPanelProps = {
  readonly selected: DesignNode | undefined;
  readonly frame: Frame;
  readonly primaryFrame: Frame;
  readonly responsiveMode: ResponsiveMode;
};

/** Properties of the selected node; the Inspector itself comes with WP-1.09. */
export function RightPanel({ selected, frame, primaryFrame, responsiveMode }: RightPanelProps) {
  const { t } = useTranslation();
  const selectedNodeIds = useEditorStore((state) => state.selectedNodeIds);
  const tabs = (
    <>
      <Tab selected>{t('editor.properties')}</Tab>
      <Tab selected={false} disabled>
        {t('editor.data')}
      </Tab>
      <Tab selected={false} disabled>
        {t('editor.ai')}
      </Tab>
    </>
  );
  const showInspector = selected !== undefined && selectedNodeIds.length === 1;
  return (
    <Panel
      label={t('editor.rightPanel')}
      title={selected?.type ?? t('editor.properties')}
      tabs={tabs}
    >
      {selected === undefined ? (
        <p className="px-1 pt-2 text-ink-faint">{t('editor.selectHint')}</p>
      ) : (
        <>
          <p className="px-1 pt-2 font-mono text-xs text-ink-faint" data-testid="selected-id">
            {selected.id}
          </p>
          {showInspector && (
            <InspectorPanel
              selectedNode={selected}
              frame={frame}
              primaryFrame={primaryFrame}
              responsiveMode={responsiveMode}
            />
          )}
        </>
      )}
    </Panel>
  );
}
