// Safe Markdown renderer for agent messages (WP-3.05a, S-14, S-15, S-114).
import type { ComponentPropsWithoutRef } from 'react';
import Markdown from 'react-markdown';

type SafeLinkProps = ComponentPropsWithoutRef<'a'>;

function SafeLink({ href, children }: SafeLinkProps) {
  if (href !== undefined && (href.startsWith('http://') || href.startsWith('https://'))) {
    return (
      <a
        href={href}
        target="_blank"
        rel="noreferrer"
        className="text-brand-ink underline hover:opacity-80"
      >
        {children}
      </a>
    );
  }
  return <>{children}</>;
}

export type ChatMarkdownProps = {
  readonly text: string;
};

const DISALLOWED = ['img'];

export function ChatMarkdown({ text }: ChatMarkdownProps) {
  return (
    <div className="prose prose-sm max-w-none text-ink text-xs leading-relaxed space-y-2 break-words">
      <Markdown
        skipHtml
        disallowedElements={DISALLOWED}
        unwrapDisallowed
        components={{ a: SafeLink }}
      >
        {text}
      </Markdown>
    </div>
  );
}
