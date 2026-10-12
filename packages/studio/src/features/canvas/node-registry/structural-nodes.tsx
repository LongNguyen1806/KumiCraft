import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { useEditorStore } from '../../../store/editor-store.ts';
import { nodeAttrs, type NodeRenderProps } from './layout-nodes.tsx';

export function NavbarNode({ node, className, children, isInner }: NodeRenderProps) {
  return (
    <nav {...nodeAttrs(node.id, isInner)} className={className}>
      {children}
    </nav>
  );
}

export function SidebarNode({ node, className, children, isInner }: NodeRenderProps) {
  return (
    <aside {...nodeAttrs(node.id, isInner)} className={className}>
      {children}
    </aside>
  );
}

export function FooterNode({ node, className, children, isInner }: NodeRenderProps) {
  return (
    <footer {...nodeAttrs(node.id, isInner)} className={className}>
      {children}
    </footer>
  );
}

export function ModalNode({ node, className, children, isInner }: NodeRenderProps) {
  const selectedNodeId = useEditorStore((s) => s.selectedNodeId);
  const content = node.content?.kind === 'modal' ? node.content : undefined;
  const isDefaultOpen = content?.openByDefault ?? true;
  const isSelected = selectedNodeId === node.id;

  if (!isDefaultOpen && !isSelected) {
    return undefined;
  }

  return (
    <div
      {...nodeAttrs(node.id, isInner)}
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

export function TabsNode({ node, className, children, isInner }: NodeRenderProps) {
  const content = node.content?.kind === 'tabs' ? node.content : undefined;
  const items = content?.items ?? [{ id: 'tab1', label: 'Tab 1' }];
  const [activeTab, setActiveTab] = useState(items[0]?.id ?? 'tab1');

  return (
    <div {...nodeAttrs(node.id, isInner)} className={className}>
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

export function ComponentInstanceNode({ node, className, children, isInner }: NodeRenderProps) {
  return (
    <div {...nodeAttrs(node.id, isInner)} className={`contents ${className}`}>
      {children}
    </div>
  );
}

export function SlotNode({ node, className, isInner }: NodeRenderProps) {
  const { t } = useTranslation();
  const content = node.content?.kind === 'slot' ? node.content : undefined;
  return (
    <div
      {...nodeAttrs(node.id, isInner)}
      className={`min-h-[40px] rounded border-2 border-dashed border-amber-400 bg-amber-50/50 p-3 text-xs font-mono text-amber-700 ${className}`}
    >
      {t('canvas.slot', { name: content?.name ?? 'slot' })}
    </div>
  );
}
