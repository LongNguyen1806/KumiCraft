import type { TFunction } from 'i18next';
import { type ReactNode, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { BrandPanel } from '../brand/brand-panel.tsx';
import { ChatPanel } from '../chat/chat-panel.tsx';
import { ComponentsPanel } from '../components-panel/components-panel.tsx';
import { DraftsPanel } from '../drafts/drafts-panel.tsx';
import { FilesPanel } from '../files/files-panel.tsx';
import { InspectorPanel } from '../inspector/inspector-panel.tsx';
import { useProjectTheme } from '../inspector/use-project-theme.ts';
import { LayerTree } from '../layers/layer-tree.tsx';
import { LibraryPanel } from '../library/library-panel.tsx';
import { PagesPanel } from '../pages/pages-panel.tsx';
import { studioBridgeChannel } from '../selection/bridge-channel.ts';
import { useShownActivity } from '../shell/activity-store.ts';
import { PanelHeaderContext } from './panel-header-context.ts';
import { type RightPanelTab, useRightPanelTab } from './right-panel-store.ts';

export type { RightPanelTab };

type PanelProps = {
  readonly label: string;
  readonly title: string;
  readonly tabs?: ReactNode | undefined;
  readonly onHeaderSlotRef?: ((el: HTMLDivElement | undefined) => void) | undefined;
  readonly children: ReactNode;
};

/** A frosted panel: thin title and optional pill tabs (approved mockup). */
function Panel({ label, title, tabs, onHeaderSlotRef, children }: PanelProps) {
  return (
    <aside
      aria-label={label}
      className="flex min-h-0 min-w-0 flex-col overflow-hidden rounded-panel bg-card shadow-soft backdrop-blur-xl"
    >
      <div className="flex items-center justify-between gap-2 px-4 pt-4 pb-2.5">
        <h2 className="truncate text-[19px] font-light tracking-tight">{title}</h2>
        {onHeaderSlotRef !== undefined && (
          <div
            ref={(el) => {
              onHeaderSlotRef(el ?? undefined);
            }}
            data-testid="panel-header-actions"
            className="flex items-center gap-1"
          />
        )}
      </div>
      {tabs !== undefined && (
        <div role="tablist" className="mx-3 flex gap-0.5 rounded-full bg-field p-[3px]">
          {tabs}
        </div>
      )}
      <div className="min-h-0 flex-1 overflow-auto px-3 pt-2.5 pb-3.5">{children}</div>
    </aside>
  );
}

type TabProps = {
  readonly selected: boolean;
  readonly disabled?: boolean;
  readonly testId?: string | undefined;
  readonly onClick?: (() => void) | undefined;
  readonly children: ReactNode;
};

function Tab({ selected, disabled = false, testId, onClick, children }: TabProps) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={selected}
      disabled={disabled}
      onClick={onClick}
      data-testid={testId}
      className="h-7 flex-1 rounded-full text-ink-soft disabled:opacity-50 aria-selected:bg-card-solid aria-selected:text-ink aria-selected:shadow-[0_1px_3px_rgb(60_52_30/0.12)] cursor-pointer"
    >
      {children}
    </button>
  );
}

function resolveLeftPanelTitle(active: string, t: TFunction): string {
  switch (active) {
    case 'files':
      return t('activity.files');
    case 'layers':
      return t('editor.layers');
    case 'library':
      return t('editor.library');
    case 'components':
      return t('editor.components');
    case 'pages':
      return t('pages.title');
    case 'drafts':
      return t('drafts.title');
    case 'brand':
      return t('brand.tab');
    default:
      return t('editor.layers');
  }
}

/** Left panel content: Files, LayerTree, Library, Components, Pages, Drafts, or Brand. */
export function LeftPanel() {
  const { t } = useTranslation();
  const active = useShownActivity();
  const title = resolveLeftPanelTitle(active, t);

  return (
    <Panel label={title} title={title}>
      {active === 'files' && <FilesPanel />}
      {active === 'layers' && <LayerTree />}
      {active === 'library' && <LibraryPanel />}
      {active === 'components' && <ComponentsPanel />}
      {active === 'pages' && (
        <PagesPanel
          onPageAdded={(pagePath) => {
            studioBridgeChannel.navigate(pagePath);
          }}
        />
      )}
      {active === 'drafts' && <DraftsPanel />}
      {active === 'brand' && <BrandPanel />}
    </Panel>
  );
}

type RightPanelTabsProps = {
  readonly tab: RightPanelTab;
  readonly onSelectTab: (tab: RightPanelTab) => void;
};

function RightPanelTabs({ tab, onSelectTab }: RightPanelTabsProps) {
  const { t } = useTranslation();
  return (
    <>
      <Tab
        selected={tab === 'properties'}
        onClick={() => {
          onSelectTab('properties');
        }}
      >
        {t('editor.properties')}
      </Tab>
      <Tab
        selected={tab === 'chat'}
        testId="right-tab-chat"
        onClick={() => {
          onSelectTab('chat');
        }}
      >
        {t('editor.ai')}
      </Tab>
    </>
  );
}

export type RightPanelProps = {
  readonly trusted?: boolean;
};

/** Inspector of the selected element, or AI chat (M-IN, WP-1.07, WP-2.10, WP-3.05a). */
export function RightPanel({ trusted = false }: RightPanelProps) {
  const { t } = useTranslation();
  const theme = useProjectTheme();
  const [tab, setTab] = useRightPanelTab();
  const [headerSlot, setHeaderSlot] = useState<HTMLDivElement | undefined>(undefined);

  const title = tab === 'chat' ? t('editor.ai') : t('editor.properties');

  return (
    <PanelHeaderContext.Provider value={tab === 'chat' ? headerSlot : undefined}>
      <Panel
        label={t('editor.rightPanel')}
        title={title}
        tabs={<RightPanelTabs tab={tab} onSelectTab={setTab} />}
        onHeaderSlotRef={setHeaderSlot}
      >
        {tab === 'properties' && <InspectorPanel theme={theme} />}
        {tab === 'chat' && <ChatPanel trusted={trusted} />}
      </Panel>
    </PanelHeaderContext.Provider>
  );
}
