import { type DesignNode, walkTree } from '@reactcraft/model';
import { type ReactNode, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { EyeOffIcon } from '../../components/ui/icons.tsx';

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

/** Short text of a node for its row: its name, or its text. */
function preview(node: DesignNode): string {
  if (node.name !== undefined) return node.name;
  const content = node.content as { readonly text?: unknown } | undefined;
  return typeof content?.text === 'string' ? content.text : '';
}

type LayerListProps = {
  readonly rows: readonly Row[];
  readonly selectedNodeId: string | undefined;
  readonly onSelect: (nodeId: string) => void;
};

/** A plain outline of the page; the Layer Tree of WP-1.10 replaces it. */
function LayerList({ rows, selectedNodeId, onSelect }: LayerListProps) {
  return (
    <ul className="grid gap-px" data-testid="layer-list">
      {rows.map(({ node, depth }) => (
        <li key={node.id}>
          <button
            type="button"
            aria-current={node.id === selectedNodeId}
            onClick={() => {
              onSelect(node.id);
            }}
            style={{ paddingLeft: 10 + (depth - 1) * 14 }}
            className="flex h-[30px] w-full items-center gap-2 rounded-full pr-2.5 text-left text-ink-soft hover:bg-field hover:text-ink aria-[current=true]:bg-charcoal aria-[current=true]:text-on-charcoal"
          >
            <span className="font-medium">{node.type}</span>
            <span className="min-w-0 truncate text-ink-faint">{preview(node)}</span>
            {node.hidden === true && (
              <span className="ml-auto text-ink-faint">
                <EyeOffIcon />
              </span>
            )}
          </button>
        </li>
      ))}
    </ul>
  );
}

type LeftPanelProps = {
  readonly root: DesignNode | undefined;
  readonly selectedNodeId: string | undefined;
  readonly onSelect: (nodeId: string) => void;
};

/** Layers of the page and the Library (filled by drag and drop, WP-1.08). */
export function LeftPanel({ root, selectedNodeId, onSelect }: LeftPanelProps) {
  const { t } = useTranslation();
  const [tab, setTab] = useState<'layers' | 'library'>('layers');
  const rows = rowsOf(root);
  const isLayers = tab === 'layers';
  const tabs = (
    <>
      <Tab
        selected={!isLayers}
        onSelect={() => {
          setTab('library');
        }}
      >
        {t('editor.library')}
      </Tab>
      <Tab
        selected={isLayers}
        onSelect={() => {
          setTab('layers');
        }}
      >
        {t('editor.layers')}
      </Tab>
    </>
  );
  return (
    <Panel
      label={t('editor.leftPanel')}
      title={t(isLayers ? 'editor.layers' : 'editor.library')}
      {...(isLayers ? { count: rows.length } : {})}
      tabs={tabs}
    >
      {isLayers ? (
        <LayerList rows={rows} selectedNodeId={selectedNodeId} onSelect={onSelect} />
      ) : (
        <p className="px-1 pt-2 text-ink-faint">{t('editor.libraryLater')}</p>
      )}
    </Panel>
  );
}

/** Properties of the selected node; the Inspector itself comes with WP-1.09. */
export function RightPanel({ selected }: { readonly selected: DesignNode | undefined }) {
  const { t } = useTranslation();
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
  return (
    <Panel
      label={t('editor.rightPanel')}
      title={selected?.type ?? t('editor.properties')}
      tabs={tabs}
    >
      {selected === undefined ? (
        <p className="px-1 pt-2 text-ink-faint">{t('editor.selectHint')}</p>
      ) : (
        <p className="px-1 pt-2 font-mono text-xs text-ink-faint" data-testid="selected-id">
          {selected.id}
        </p>
      )}
    </Panel>
  );
}
