import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { nodeAttrs, type NodeRenderProps } from './layout-nodes.tsx';

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

export function TextNode({ node, className, isInner }: NodeRenderProps) {
  const content = node.content?.kind === 'text' ? node.content : undefined;
  const Tag = content?.as ?? 'p';
  return (
    <Tag {...nodeAttrs(node.id, isInner)} className={className}>
      {content?.text ?? ''}
    </Tag>
  );
}

export function HeadingNode({ node, className, isInner }: NodeRenderProps) {
  const content = node.content?.kind === 'heading' ? node.content : undefined;
  const level = content?.level ?? 1;
  const Tag = HEADING_TAGS[level];
  return (
    <Tag {...nodeAttrs(node.id, isInner)} className={className}>
      {content?.text ?? ''}
    </Tag>
  );
}

export function ImageNode({ node, className, isInner }: NodeRenderProps) {
  const { t } = useTranslation();
  const content = node.content?.kind === 'image' ? node.content : undefined;
  const [failed, setFailed] = useState(false);

  if (failed || content === undefined) {
    const placeholder = content?.alt ?? t('canvas.imagePlaceholder');
    return (
      <div
        {...nodeAttrs(node.id, isInner)}
        className={`flex items-center justify-center gap-2 bg-neutral-200 text-neutral-500 ${className}`}
        aria-label={placeholder}
      >
        <svg
          className="size-4 shrink-0 text-neutral-400"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          aria-hidden="true"
        >
          <rect width="18" height="18" x="3" y="3" rx="2" ry="2" />
          <circle cx="9" cy="9" r="2" />
          <path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21" />
        </svg>
        <span className="text-xs font-mono">{placeholder}</span>
      </div>
    );
  }

  return (
    <img
      {...nodeAttrs(node.id, isInner)}
      src={resolveImageSrc(content.src)}
      alt={content.alt}
      onError={() => {
        setFailed(true);
      }}
      className={className}
    />
  );
}

export function IconNode({ node, className, isInner }: NodeRenderProps) {
  const content = node.content?.kind === 'icon' ? node.content : undefined;
  const rawSize = content?.size;
  const size = typeof rawSize === 'number' ? rawSize : (rawSize?.px ?? 24);
  return (
    <svg
      {...nodeAttrs(node.id, isInner)}
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

export function DividerNode({ node, className, isInner }: NodeRenderProps) {
  return <hr {...nodeAttrs(node.id, isInner)} className={className} />;
}
