import { type ReactNode, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { ComponentsPanel } from '../components-panel/components-panel.tsx';
import { InspectorPanel } from '../inspector/inspector-panel.tsx';
import { useProjectTheme } from '../inspector/use-project-theme.ts';
import { LayerTree } from '../layers/layer-tree.tsx';
import { LibraryPanel } from '../library/library-panel.tsx';

type PanelProps = {
  readonly label: string;
  readonly title: string;
  readonly tabs: ReactNode;
  readonly children: ReactNode;
};

/** A frosted panel: thin title and pill tabs (approved mockup). */
function Panel({ label, title, tabs, children }: PanelProps) {
  return (
    <aside
      aria-label={label}
      className="flex min-h-0 min-w-0 flex-col overflow-hidden rounded-panel bg-card shadow-soft backdrop-blur-xl"
    >
      <div className="flex items-center gap-2 px-4 pt-4 pb-2.5">
        <h2 className="truncate text-[19px] font-light tracking-tight">{title}</h2>
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
  readonly onClick?: (() => void) | undefined;
  readonly children: ReactNode;
};

function Tab({ selected, disabled = false, onClick, children }: TabProps) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={selected}
      disabled={disabled}
      onClick={onClick}
      className="h-7 flex-1 rounded-full text-ink-soft disabled:opacity-50 aria-selected:bg-card-solid aria-selected:text-ink aria-selected:shadow-[0_1px_3px_rgb(60_52_30/0.12)] cursor-pointer"
    >
      {children}
    </button>
  );
}

const LEFT_PANEL_KEY = 'reactcraft.leftPanelTab';

export type LeftPanelTab = 'layers' | 'library' | 'components';

function readLeftPanelTab(): LeftPanelTab {
  try {
    const saved = localStorage.getItem(LEFT_PANEL_KEY);
    if (saved === 'library' || saved === 'components') return saved;
    return 'layers';
  } catch {
    return 'layers';
  }
}

function saveLeftPanelTab(tab: LeftPanelTab): void {
  try {
    localStorage.setItem(LEFT_PANEL_KEY, tab);
  } catch {
    // Private windows may refuse storage: the layout then lasts for this visit only.
  }
}

type LeftPanelTabsProps = {
  readonly tab: LeftPanelTab;
  readonly onSelectTab: (tab: LeftPanelTab) => void;
};

function LeftPanelTabs({ tab, onSelectTab }: LeftPanelTabsProps) {
  const { t } = useTranslation();
  return (
    <>
      <Tab
        selected={tab === 'layers'}
        onClick={() => {
          onSelectTab('layers');
        }}
      >
        {t('editor.layers')}
      </Tab>
      <Tab
        selected={tab === 'library'}
        onClick={() => {
          onSelectTab('library');
        }}
      >
        {t('editor.library')}
      </Tab>
      <Tab
        selected={tab === 'components'}
        onClick={() => {
          onSelectTab('components');
        }}
      >
        {t('editor.components')}
      </Tab>
    </>
  );
}

/** Layer Tree, Library, or Components of the running page (M-SL, M-LB, WP-1.05, WP-2.03, WP-2.08a). */
export function LeftPanel() {
  const { t } = useTranslation();
  const [tab, setTab] = useState<LeftPanelTab>(readLeftPanelTab);

  const handleSetTab = (nextTab: LeftPanelTab) => {
    setTab(nextTab);
    saveLeftPanelTab(nextTab);
  };

  const title =
    tab === 'layers'
      ? t('editor.layers')
      : tab === 'library'
        ? t('editor.library')
        : t('editor.components');

  return (
    <Panel
      label={t('editor.leftPanel')}
      title={title}
      tabs={<LeftPanelTabs tab={tab} onSelectTab={handleSetTab} />}
    >
      {tab === 'layers' && <LayerTree />}
      {tab === 'library' && <LibraryPanel />}
      {tab === 'components' && <ComponentsPanel />}
    </Panel>
  );
}

/** Inspector of the selected element (M-IN, WP-1.07); the AI chat tab comes in Phase 3. */
export function RightPanel() {
  const { t } = useTranslation();
  const theme = useProjectTheme();
  const tabs = (
    <>
      <Tab selected>{t('editor.properties')}</Tab>
      <Tab selected={false} disabled>
        {t('editor.ai')}
      </Tab>
    </>
  );
  return (
    <Panel label={t('editor.rightPanel')} title={t('editor.properties')} tabs={tabs}>
      <InspectorPanel theme={theme} />
    </Panel>
  );
}
