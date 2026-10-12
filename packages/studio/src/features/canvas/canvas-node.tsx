// CanvasNode dispatcher (SPEC-04.1 section 7, ADR-FE-10).
import { CONTAINER_TYPES, createDefaultTokens, toTailwindClasses } from '@reactcraft/model';
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

export function CanvasNode({ nodeId }: { readonly nodeId: string }) {
  const node = useEditorStore((s) => s.flatNodes[nodeId]);
  const responsiveMode = useEditorStore(
    (s) => s.document?.workspace.responsiveMode ?? 'desktop-first',
  );
  const tokens = useEditorStore((s) => s.document?.tokens ?? DEFAULT_TOKENS);

  if (node === undefined || node.hidden === true) {
    return undefined;
  }

  const Renderer = NODE_RENDERERS[node.type];

  const classes = toTailwindClasses(node, {
    responsiveMode,
    tailwind: 'v4',
    tokens,
  }).join(' ');

  const isContainer = CONTAINER_TYPES.has(node.type);
  const isEmpty = isContainer && node.childIds.length === 0;

  return (
    <Renderer node={node} className={classes}>
      {isEmpty ? <EmptyContainerPlaceholder /> : renderChildren(node.childIds)}
    </Renderer>
  );
}
