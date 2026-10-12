// CanvasNode dispatcher (SPEC-04.1 section 7, ADR-FE-10).
import {
  CONTAINER_TYPES,
  createDefaultTokens,
  type DesignNode,
  type DesignTokens,
  type NodeRecord,
  type ResponsiveMode,
  toTailwindClasses,
} from '@reactcraft/model';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

import { useEditorStore } from '../../store/editor-store.ts';
import { NODE_RENDERERS } from './node-registry/index.ts';

const DEFAULT_TOKENS = createDefaultTokens();

function EmptyContainerPlaceholder() {
  const { t } = useTranslation();
  return (
    <div className="flex h-12 min-h-[48px] w-full items-center justify-center rounded border-2 border-dashed border-neutral-300 bg-neutral-50/50 text-xs font-mono text-neutral-400">
      {t('canvas.emptyPlaceholder')}
    </div>
  );
}

function renderChildren(childIds: readonly string[]): ReactNode {
  return childIds.map((id) => <CanvasNode key={id} nodeId={id} />);
}

function resolvePropRef(
  node: DesignNode,
  propValues?: Readonly<Record<string, unknown>>,
): DesignNode {
  if (node.propRef === undefined || propValues === undefined) return node;
  const propVal = propValues[node.propRef.prop];
  if (propVal === undefined || node.content === undefined) return node;
  return {
    ...node,
    content: {
      ...node.content,
      [node.propRef.target]: propVal,
    },
  };
}

function SlotInnerNode({
  node,
  slotChildIds,
}: {
  readonly node: DesignNode;
  readonly slotChildIds?: Readonly<Record<string, readonly string[]>> | undefined;
}) {
  const slotName = node.content?.kind === 'slot' ? node.content.name : node.id;
  const childrenInSlot = slotChildIds?.[slotName] ?? [];
  if (childrenInSlot.length === 0) {
    return <EmptyContainerPlaceholder />;
  }
  return (
    <>
      {childrenInSlot.map((childId) => (
        <CanvasNode key={childId} nodeId={childId} />
      ))}
    </>
  );
}

function ComponentInnerTreeNode({
  node,
  propValues,
  slotChildIds,
  responsiveMode,
  tokens,
}: {
  readonly node: DesignNode;
  readonly propValues?: Readonly<Record<string, unknown>> | undefined;
  readonly slotChildIds?: Readonly<Record<string, readonly string[]>> | undefined;
  readonly responsiveMode: ResponsiveMode;
  readonly tokens: DesignTokens;
}) {
  if (node.type === 'Slot') {
    return <SlotInnerNode node={node} slotChildIds={slotChildIds} />;
  }

  const resolvedNode = resolvePropRef(node, propValues);
  const Renderer = NODE_RENDERERS[resolvedNode.type];
  const classes = toTailwindClasses(resolvedNode, {
    responsiveMode,
    tailwind: 'v4',
    tokens,
  }).join(' ');

  const children = resolvedNode.children?.map((child) => (
    <ComponentInnerTreeNode
      key={child.id}
      node={child}
      propValues={propValues}
      slotChildIds={slotChildIds}
      responsiveMode={responsiveMode}
      tokens={tokens}
    />
  ));

  const recordLike: NodeRecord = {
    ...resolvedNode,
    childIds: resolvedNode.children?.map((c) => c.id) ?? [],
  };

  return (
    <Renderer node={recordLike} className={classes} isInner={true}>
      {children}
    </Renderer>
  );
}

type InstanceContent = Extract<NonNullable<NodeRecord['content']>, { kind: 'instance' }>;

/** Reads only its own component from the store, so other edits never re-render it (R-CV-05). */
function ComponentInstanceView({
  node,
  content,
  classes,
  responsiveMode,
  tokens,
}: {
  readonly node: NodeRecord;
  readonly content: InstanceContent;
  readonly classes: string;
  readonly responsiveMode: ResponsiveMode;
  readonly tokens: DesignTokens;
}) {
  const component = useEditorStore((s) => s.document?.components[content.componentId]);
  if (component === undefined) {
    return <EmptyContainerPlaceholder />;
  }
  return (
    <div data-rc-node={node.id} className={classes}>
      <ComponentInnerTreeNode
        node={component.root}
        propValues={content.propValues}
        slotChildIds={node.slotChildIds}
        responsiveMode={responsiveMode}
        tokens={tokens}
      />
    </div>
  );
}

function renderNodeContent(
  node: NodeRecord,
  classes: string,
  responsiveMode: ResponsiveMode,
  tokens: DesignTokens,
): ReactNode {
  if (node.type === 'ComponentInstance' && node.content?.kind === 'instance') {
    return (
      <ComponentInstanceView
        node={node}
        content={node.content}
        classes={classes}
        responsiveMode={responsiveMode}
        tokens={tokens}
      />
    );
  }

  const Renderer = NODE_RENDERERS[node.type];
  const isEmpty = CONTAINER_TYPES.has(node.type) && node.childIds.length === 0;
  return (
    <Renderer node={node} className={classes}>
      {isEmpty ? <EmptyContainerPlaceholder /> : renderChildren(node.childIds)}
    </Renderer>
  );
}

export function CanvasNode({ nodeId }: { readonly nodeId: string }) {
  const { t } = useTranslation();
  const node = useEditorStore((s) => s.flatNodes[nodeId]);
  const responsiveMode = useEditorStore(
    (s) => s.document?.workspace.responsiveMode ?? 'desktop-first',
  );
  const tokens = useEditorStore((s) => s.document?.tokens ?? DEFAULT_TOKENS);

  if (node === undefined || node.hidden === true) {
    return undefined;
  }

  const isInitiallyHidden = node.runtime?.initiallyHidden === true;
  const classes = toTailwindClasses(node, {
    responsiveMode,
    tailwind: 'v4',
    tokens,
  }).join(' ');

  const rendered = renderNodeContent(node, classes, responsiveMode, tokens);

  if (isInitiallyHidden) {
    return (
      <div className="relative opacity-50">
        <span
          data-rc-badge="initially-hidden"
          className="pointer-events-none absolute right-1 top-1 z-30 rounded bg-neutral-900/80 px-1.5 py-0.5 text-[10px] font-medium text-white shadow-sm"
        >
          {t('canvas.initiallyHidden')}
        </span>
        {rendered}
      </div>
    );
  }

  return rendered;
}
