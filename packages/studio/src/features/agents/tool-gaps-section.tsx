// Settings → Missing tools (R-AG-20): what external AI agents needed and ReactCraft lacks, with the
// command that connects Claude Code and a Markdown export for planning.
import type { ToolGap } from '@reactcraft/shared';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { fetchToolGaps } from '../../api/tool-gaps-client.ts';
import { errorText, toErrorInfo } from '../../routes/error-text.ts';
import { toolGapsMarkdown } from './tool-gaps-markdown.ts';

type LoadState =
  | { readonly status: 'loading' }
  | { readonly status: 'ready'; readonly gaps: readonly ToolGap[] }
  | { readonly status: 'failed'; readonly message: string };

function useToolGaps(open: boolean) {
  const { t: tError } = useTranslation('errors');
  const [state, setState] = useState<LoadState>({ status: 'loading' });
  const [version, setVersion] = useState(0);

  useEffect(() => {
    if (!open) return undefined;
    let active = true;
    const load = async () => {
      try {
        const gaps = await fetchToolGaps();
        if (active) setState({ status: 'ready', gaps });
      } catch (error) {
        const info = toErrorInfo(error);
        if (active)
          setState({ status: 'failed', message: errorText(tError, info.code, info.params) });
      }
    };
    void load();
    return () => {
      active = false;
    };
  }, [open, version, tError]);

  return {
    state,
    reload: () => {
      setVersion((value) => value + 1);
    },
  };
}

function GapRow({ gap, index }: { readonly gap: ToolGap; readonly index: number }) {
  const { t, i18n } = useTranslation('chat');
  const [expanded, setExpanded] = useState(false);
  const when = new Intl.DateTimeFormat(i18n.language, {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(new Date(gap.lastAt));
  return (
    <li data-testid={`tool-gap-${String(index)}`} className="grid gap-1 border-t border-line py-2">
      <div className="flex items-baseline justify-between gap-2">
        <span className="font-medium text-ink">{gap.need}</span>
        <span className="shrink-0 text-xs text-ink-faint">
          {t('toolGaps.count', { count: gap.count })} · {when}
        </span>
      </div>
      <p className="text-xs text-ink-soft">{gap.why}</p>
      {gap.example.trim() !== '' && (
        <button
          type="button"
          onClick={() => {
            setExpanded((value) => !value);
          }}
          title={t(expanded ? 'toolGaps.showLess' : 'toolGaps.showMore')}
          className={`cursor-pointer whitespace-pre-wrap rounded bg-field px-2 py-1 text-left font-mono text-[11px] text-ink ${expanded ? '' : 'line-clamp-3'}`}
        >
          {gap.example}
        </button>
      )}
    </li>
  );
}

function ConnectHint({ projectRoot }: { readonly projectRoot: string }) {
  const { t } = useTranslation('chat');
  const [copied, setCopied] = useState(false);
  const command = `claude mcp add reactcraft -- npx reactcraft mcp "${projectRoot}"`;
  return (
    <div className="grid gap-1 py-2 text-xs text-ink-soft">
      <span>{t('toolGaps.connect')}</span>
      <div className="flex items-center gap-2">
        <code className="min-w-0 flex-1 truncate rounded bg-field px-2 py-1 font-mono text-[11px] text-ink">
          {command}
        </code>
        <button
          type="button"
          onClick={() => {
            const copy = async () => {
              await navigator.clipboard.writeText(command);
              setCopied(true);
            };
            void copy();
          }}
          className="shrink-0 cursor-pointer rounded-full bg-field px-2.5 py-1 hover:bg-field-hover"
        >
          {t(copied ? 'toolGaps.copied' : 'toolGaps.copy')}
        </button>
      </div>
    </div>
  );
}

function exportMarkdown(gaps: readonly ToolGap[], labels: Parameters<typeof toolGapsMarkdown>[1]) {
  const blob = new Blob([toolGapsMarkdown(gaps, labels, new Date())], { type: 'text/markdown' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'tool-gaps.md';
  link.click();
  URL.revokeObjectURL(url);
}

function GapsList({ gaps }: { readonly gaps: readonly ToolGap[] }) {
  if (gaps.length === 0) return undefined;
  return (
    <ul className="grid">
      {gaps.map((gap, index) => (
        <GapRow key={gap.need} gap={gap} index={index} />
      ))}
    </ul>
  );
}

function GapsActions({
  gaps,
  onReload,
}: {
  readonly gaps: readonly ToolGap[];
  readonly onReload: () => void;
}) {
  const { t } = useTranslation('chat');
  const labels = {
    title: t('toolGaps.markdownTitle'),
    why: t('toolGaps.markdownWhy'),
    example: t('toolGaps.markdownExample'),
    last: t('toolGaps.markdownLast'),
  };
  return (
    <div className="flex shrink-0 gap-1">
      <button
        type="button"
        data-testid="tool-gaps-refresh"
        onClick={onReload}
        className="cursor-pointer rounded-full bg-field px-2.5 py-1 text-xs hover:bg-field-hover"
      >
        {t('toolGaps.refresh')}
      </button>
      <button
        type="button"
        data-testid="tool-gaps-export"
        disabled={gaps.length === 0}
        onClick={() => {
          exportMarkdown(gaps, labels);
        }}
        className="cursor-pointer rounded-full bg-primary px-2.5 py-1 text-xs text-on-charcoal hover:bg-primary-hover disabled:opacity-40"
      >
        {t('toolGaps.export')}
      </button>
    </div>
  );
}

/** The gaps of the open project; the Settings dialog shows it for a trusted project only. */
export function ToolGapsSection({
  open,
  projectRoot,
}: {
  readonly open: boolean;
  readonly projectRoot: string;
}) {
  const { t } = useTranslation('chat');
  const { state, reload } = useToolGaps(open);
  const gaps = state.status === 'ready' ? state.gaps : [];
  return (
    <div data-testid="tool-gaps" className="grid min-w-0 gap-1 py-2.5">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs text-ink-soft">{t('toolGaps.help')}</span>
        <GapsActions gaps={gaps} onReload={reload} />
      </div>
      {state.status === 'failed' && <p className="text-xs text-danger">{state.message}</p>}
      {state.status === 'ready' && gaps.length === 0 && (
        <p data-testid="tool-gaps-empty" className="text-xs text-ink-faint">
          {t('toolGaps.empty')}
        </p>
      )}
      <GapsList gaps={gaps} />
      <ConnectHint projectRoot={projectRoot} />
    </div>
  );
}
