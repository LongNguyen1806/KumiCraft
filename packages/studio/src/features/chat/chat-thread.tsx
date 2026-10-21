// Chat thread rendering user prompts, agent messages, tool invocations, and summaries (WP-3.05a, R-CH-03).
import type { TFunction } from 'i18next';
import { FileText, Pencil, Search, Terminal, Wrench } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { cancelJob } from '../../api/jobs-client.ts';
import { errorText } from '../../routes/error-text.ts';
import { ChatMarkdown } from './chat-markdown.tsx';
import type { ChatItem, ChatTurnView } from './chat-store.ts';

function ToolIcon({ name }: { readonly name: string }) {
  const lower = name.toLowerCase();
  if (lower.includes('read') || lower.includes('view') || lower.includes('list')) {
    return <FileText className="size-3.5 shrink-0 text-ink-faint" />;
  }
  if (lower.includes('find') || lower.includes('grep') || lower.includes('search')) {
    return <Search className="size-3.5 shrink-0 text-ink-faint" />;
  }
  if (
    lower.includes('write') ||
    lower.includes('replace') ||
    lower.includes('edit') ||
    lower.includes('sed')
  ) {
    return <Pencil className="size-3.5 shrink-0 text-ink-faint" />;
  }
  if (lower.includes('run_command') || lower.includes('command') || lower.includes('terminal')) {
    return <Terminal className="size-3.5 shrink-0 text-ink-faint" />;
  }
  return <Wrench className="size-3.5 shrink-0 text-ink-faint" />;
}

function ToolItemRow({ item }: { readonly item: Extract<ChatItem, { kind: 'tool' }> }) {
  return (
    <div
      data-testid="chat-tool"
      className="flex items-center gap-1.5 rounded bg-field/60 px-2 py-1 font-mono text-[11px] text-ink-soft overflow-hidden"
    >
      <ToolIcon name={item.name} />
      <span className="font-semibold text-ink">{item.name}</span>
      {item.target !== undefined && <span className="truncate text-ink-faint">{item.target}</span>}
    </div>
  );
}

function ChatItemView({ item }: { readonly item: ChatItem }) {
  if (item.kind === 'user') {
    return (
      <div className="flex justify-end">
        <div className="max-w-[85%] rounded-2xl bg-brand px-3 py-2 text-xs text-white leading-relaxed whitespace-pre-wrap break-words">
          {item.text}
        </div>
      </div>
    );
  }
  if (item.kind === 'message') {
    return (
      <div className="flex flex-col gap-1 max-w-full">
        <ChatMarkdown text={item.text} />
      </div>
    );
  }
  if (item.kind === 'tool') {
    return <ToolItemRow item={item} />;
  }
  return (
    <div className="rounded-lg bg-rose-50 border border-rose-200 p-2 text-xs text-rose-700">
      {item.message}
    </div>
  );
}

function getSummaryText(
  turn: ChatTurnView,
  tChat: TFunction<'chat'>,
  tError: TFunction<'errors'>,
): string {
  if (turn.state === 'completed') {
    return tChat('turnDone', { count: turn.fileCount ?? 0 });
  }
  if (turn.state === 'cancelled') {
    return tChat('turnCancelled');
  }
  if (turn.state === 'failed' && turn.error !== undefined) {
    return errorText(tError, turn.error.code, turn.error.params);
  }
  return '';
}

function TurnSummaryView({ turn }: { readonly turn: ChatTurnView }) {
  const { t } = useTranslation('chat');
  const { t: tError } = useTranslation('errors');

  if (turn.state === 'running') {
    return (
      <div className="flex items-center justify-between pt-1 text-xs text-ink-soft">
        <span className="italic animate-pulse">…</span>
        {turn.jobId && (
          <button
            type="button"
            data-testid="chat-cancel"
            onClick={() => {
              void cancelJob(turn.jobId);
            }}
            className="rounded-full bg-field px-2.5 py-1 text-xs text-ink-soft hover:bg-field-hover hover:text-ink cursor-pointer"
          >
            {t('cancel')}
          </button>
        )}
      </div>
    );
  }

  const summaryText = getSummaryText(turn, t, tError);
  if (!summaryText) return undefined;

  return (
    <div
      data-testid="chat-turn-summary"
      className="pt-1 text-xs font-medium text-ink-soft border-t border-border/50"
    >
      {summaryText}
    </div>
  );
}

export function ChatThread({ turns }: { readonly turns: readonly ChatTurnView[] }) {
  return (
    <div className="flex flex-col gap-4 overflow-y-auto pr-1">
      {turns.map((turn, turnIdx) => (
        <div key={`${turn.jobId}-${String(turnIdx)}`} className="flex flex-col gap-2.5">
          {turn.items.map((item, itemIdx) => (
            <ChatItemView key={`${String(turnIdx)}-${String(itemIdx)}`} item={item} />
          ))}
          <TurnSummaryView turn={turn} />
        </div>
      ))}
    </div>
  );
}
