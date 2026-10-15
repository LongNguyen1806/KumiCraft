import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

import { InspectorPanel } from '../inspector/inspector-panel.tsx';
import { LayerTree } from '../layers/layer-tree.tsx';

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
  readonly children: ReactNode;
};

function Tab({ selected, disabled = false, children }: TabProps) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={selected}
      disabled={disabled}
      className="h-7 flex-1 rounded-full text-ink-soft disabled:opacity-50 aria-selected:bg-card-solid aria-selected:text-ink aria-selected:shadow-[0_1px_3px_rgb(60_52_30/0.12)]"
    >
      {children}
    </button>
  );
}

/** Layer Tree of the running page (M-SL, WP-1.05). */
export function LeftPanel() {
  const { t } = useTranslation();
  return (
    <Panel
      label={t('editor.leftPanel')}
      title={t('editor.layers')}
      tabs={<Tab selected>{t('editor.layers')}</Tab>}
    >
      <LayerTree />
    </Panel>
  );
}

/** Inspector of the selected element (M-IN, WP-1.07); the AI chat tab comes in Phase 3. */
export function RightPanel() {
  const { t } = useTranslation();
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
      <InspectorPanel />
    </Panel>
  );
}
