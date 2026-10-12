import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import type { NodeRenderProps } from './layout-nodes.tsx';

export function NavbarNode({ node, className, children }: NodeRenderProps) {
  return (
    <nav data-rc-node={node.id} className={className}>
      {children}
    </nav>
  );
}

export function SidebarNode({ node, className, children }: NodeRenderProps) {
  return (
    <aside data-rc-node={node.id} className={className}>
      {children}
    </aside>
  );
}

export function FooterNode({ node, className, children }: NodeRenderProps) {
  return (
    <footer data-rc-node={node.id} className={className}>
      {children}
    </footer>
  );
}

export function ModalNode({ node, className, children }: NodeRenderProps) {
  const content = node.content?.kind === 'modal' ? node.content : undefined;
  const isDefaultOpen = content?.openByDefault ?? true;

  if (!isDefaultOpen) {
    return undefined;
  }

  return (
    <div
      data-rc-node={node.id}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
    >
      <div className={`w-full max-w-lg rounded-lg bg-white p-6 shadow-xl ${className}`}>
        {content?.title !== undefined && (
          <h3 className="mb-4 text-lg font-semibold">{content.title}</h3>
        )}
        {children}
      </div>
    </div>
  );
}

export function TabsNode({ node, className, children }: NodeRenderProps) {
  const content = node.content?.kind === 'tabs' ? node.content : undefined;
  const items = content?.items ?? [{ id: 'tab1', label: 'Tab 1' }];
  const [activeTab, setActiveTab] = useState(items[0]?.id ?? 'tab1');

  return (
    <div data-rc-node={node.id} className={className}>
      <div className="flex border-b border-neutral-200">
        {items.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => {
              setActiveTab(tab.id);
            }}
            className={`px-4 py-2 text-sm font-medium border-b-2 ${
              activeTab === tab.id
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-neutral-500'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>
      <div className="pt-3">{children}</div>
    </div>
  );
}

export function ComponentInstanceNode({ node, className, children }: NodeRenderProps) {
  return (
    <div data-rc-node={node.id} className={`contents ${className}`}>
      {children}
    </div>
  );
}

export function SlotNode({ node, className }: NodeRenderProps) {
  const { t } = useTranslation();
  const content = node.content?.kind === 'slot' ? node.content : undefined;
  return (
    <div
      data-rc-node={node.id}
      className={`min-h-[40px] rounded border-2 border-dashed border-amber-400 bg-amber-50/50 p-3 text-xs font-mono text-amber-700 ${className}`}
    >
      {t('canvas.slot', { name: content?.name ?? 'slot' })}
    </div>
  );
}
