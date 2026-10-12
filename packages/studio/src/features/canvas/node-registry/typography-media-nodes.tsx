import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import type { NodeRenderProps } from './layout-nodes.tsx';

const HEADING_TAGS = {
  1: 'h1',
  2: 'h2',
  3: 'h3',
  4: 'h4',
  5: 'h5',
  6: 'h6',
} as const;

function resolveImageSrc(src: string): string {
  if (src.startsWith('asset:')) {
    return `/api/v1/workspace/assets/${encodeURIComponent(src.slice(6))}`;
  }
  return src;
}

export function TextNode({ node, className }: NodeRenderProps) {
  const content = node.content?.kind === 'text' ? node.content : undefined;
  const Tag = content?.as ?? 'p';
  return (
    <Tag data-rc-node={node.id} className={className}>
      {content?.text ?? ''}
    </Tag>
  );
}

export function HeadingNode({ node, className }: NodeRenderProps) {
  const content = node.content?.kind === 'heading' ? node.content : undefined;
  const level = content?.level ?? 1;
  const Tag = HEADING_TAGS[level];
  return (
    <Tag data-rc-node={node.id} className={className}>
      {content?.text ?? ''}
    </Tag>
  );
}

export function ImageNode({ node, className }: NodeRenderProps) {
  const { t } = useTranslation();
  const content = node.content?.kind === 'image' ? node.content : undefined;
  const [failed, setFailed] = useState(false);

  if (failed || content === undefined) {
    const placeholder = content?.alt ?? t('canvas.imagePlaceholder');
    return (
      <div
        data-rc-node={node.id}
        className={`flex items-center justify-center bg-neutral-200 text-neutral-500 ${className}`}
        aria-label={placeholder}
      >
        <span className="text-xs font-mono">{placeholder}</span>
      </div>
    );
  }

  return (
    <img
      data-rc-node={node.id}
      src={resolveImageSrc(content.src)}
      alt={content.alt}
      onError={() => {
        setFailed(true);
      }}
      className={className}
    />
  );
}

export function IconNode({ node, className }: NodeRenderProps) {
  const content = node.content?.kind === 'icon' ? node.content : undefined;
  const rawSize = content?.size;
  const size = typeof rawSize === 'number' ? rawSize : (rawSize?.px ?? 24);
  return (
    <svg
      data-rc-node={node.id}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="10" />
      <path d="m12 8 4 4-4 4M8 12h8" />
    </svg>
  );
}

export function DividerNode({ node, className }: NodeRenderProps) {
  return <hr data-rc-node={node.id} className={className} />;
}
