import type { NodeRecord } from '@reactcraft/model';
import type { ReactNode } from 'react';

export type NodeRenderProps = {
  readonly node: NodeRecord;
  readonly className: string;
  readonly children?: ReactNode;
};

const CONTAINER_MAX_WIDTH: Record<string, string> = {
  sm: 'max-w-[640px]',
  md: 'max-w-[768px]',
  lg: 'max-w-[1024px]',
  xl: 'max-w-[1280px]',
  '2xl': 'max-w-[1536px]',
  full: 'max-w-full',
};

export function StackNode({ node, className, children }: NodeRenderProps) {
  return (
    <div data-rc-node={node.id} className={className}>
      {children}
    </div>
  );
}

export function CardNode({ node, className, children }: NodeRenderProps) {
  return (
    <div data-rc-node={node.id} className={className}>
      {children}
    </div>
  );
}

export function GridNode({ node, className, children }: NodeRenderProps) {
  return (
    <div data-rc-node={node.id} className={className}>
      {children}
    </div>
  );
}

export function SectionNode({ node, className, children }: NodeRenderProps) {
  const content = node.content?.kind === 'section' ? node.content : undefined;
  const Tag = content?.as ?? 'section';
  return (
    <Tag data-rc-node={node.id} className={className}>
      {children}
    </Tag>
  );
}

export function ContainerNode({ node, className, children }: NodeRenderProps) {
  const content = node.content?.kind === 'container' ? node.content : undefined;
  const maxW = content !== undefined ? CONTAINER_MAX_WIDTH[content.maxWidth] : 'max-w-full';
  const combined = `mx-auto w-full ${maxW ?? 'max-w-full'} ${className}`.trim();
  return (
    <div data-rc-node={node.id} className={combined}>
      {children}
    </div>
  );
}
