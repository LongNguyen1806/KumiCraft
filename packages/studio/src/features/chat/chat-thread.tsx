// Chat thread rendering user prompts, agent messages, tools, summaries, files, and revert (WP-3.05a, WP-3.05b).
import type { TFunction } from 'i18next';
import { FileText, Pencil, Search, Terminal, Wrench } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { cancelJob } from '../../api/jobs-client.ts';
import { errorText } from '../../routes/error-text.ts';
import { useAgentsStore } from '../../store/agents-store.ts';
import { ChatFiles } from './chat-files.tsx';
import { ChatMarkdown } from './chat-markdown.tsx';
import { ChatRevert } from './chat-revert.tsx';
import { type ChatItem, type ChatTurnView, useChatStore } from './chat-store.ts';

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
      className="flex items-center gap-1.5 overflow-hidden rounded-md border border-line bg-wash-cool px-2 py-1 font-mono text-[11px] text-ink-soft"
    >
      <ToolIcon name={item.name} />
      <span className="font-semibold text-ink">{item.name}</span>
      {item.target !== undefined && <span className="truncate text-ink-faint">{item.target}</span>}
    </div>
  );
}

function HistoryTimeLabel({ startedAt }: { readonly startedAt: string }) {
  const { i18n } = useTranslation();
  const formatted = new Intl.DateTimeFormat(i18n.language, {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(new Date(startedAt));

  return <span className="text-[10px] text-ink-faint select-none">{formatted}</span>;
}

function UserImagesRow({ images }: { readonly images: readonly string[] }) {
  return (
    <div className="flex flex-wrap gap-1.5 pb-1">
      {images.map((src, idx) => (
        <img
          key={idx}
          src={src}
          alt={`attachment-${String(idx)}`}
          className="size-12 rounded object-cover border border-white/20"
        />
      ))}
    </div>
  );
}

function ChatItemView({ item }: { readonly item: ChatItem }) {
  if (item.kind === 'user') {
    const hasImages = item.images !== undefined && item.images.length > 0;
    return (
      <div className="flex justify-end">
        <div className="max-w-[85%] rounded-lg rounded-br-sm bg-accent-soft px-3 py-2 text-xs leading-relaxed break-words whitespace-pre-wrap text-ink">
          {hasImages && <UserImagesRow images={item.images} />}
          <div>{item.text}</div>
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
    <div className="rounded-md border border-danger/30 bg-danger/10 p-2 text-xs text-danger">
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
    const count = turn.summary?.files.length ?? 0;
    return tChat('turnDone', { count });
  }
  if (turn.state === 'cancelled') {
    return tChat('turnCancelled');
  }
  if (turn.state === 'failed') {
    if (turn.error !== undefined) {
      return errorText(tError, turn.error.code, turn.error.params);
    }
    return tChat('turnFailed');
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
        {Boolean(turn.jobId) && !turn.history && (
          <button
            type="button"
            data-testid="chat-cancel"
            onClick={() => {
              void cancelJob(turn.jobId);
            }}
            className="rounded-md bg-field px-2.5 h-6 text-xs text-ink-soft hover:bg-field-hover hover:text-ink"
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
      className="border-t border-line pt-1 text-xs font-medium text-ink-soft"
    >
      {summaryText}
    </div>
  );
}

function ClaudeLoginHint({ turn }: { readonly turn: ChatTurnView }) {
  const { t } = useTranslation('chat');
  const startLogin = useAgentsStore((s) => s.startLogin);
  const isClaudeFailed =
    turn.state === 'failed' &&
    turn.error?.code === 'E027' &&
    (turn.error.params?.agent === 'claude' || turn.summary?.agent === 'claude');

  if (!isClaudeFailed) return undefined;

  const handleLogin = () => {
    const userItem = turn.items.find((i) => i.kind === 'user');
    const promptText = userItem?.text ?? turn.summary?.prompt;
    if (promptText && !useChatStore.getState().draft) {
      useChatStore.getState().setDraft(promptText);
    }
    void startLogin('claude', true);
  };

  return (
    <div
      data-testid="chat-login-hint"
      className="mt-1 flex items-center justify-between gap-2 rounded-md border border-sun bg-sun-soft p-2 text-xs text-ink"
    >
      <span>{t('loginHintClaude')}</span>
      <button
        type="button"
        onClick={handleLogin}
        className="rounded-md bg-charcoal px-3 h-6 text-xs font-medium text-on-charcoal hover:bg-primary-hover"
      >
        {t('login')}
      </button>
    </div>
  );
}

function TurnRowView({ turn, turnIdx }: { readonly turn: ChatTurnView; readonly turnIdx: number }) {
  return (
    <div className="flex flex-col gap-2.5">
      {turn.history && turn.summary?.startedAt && (
        <div className="flex justify-end">
          <HistoryTimeLabel startedAt={turn.summary.startedAt} />
        </div>
      )}
      {turn.items.map((item, itemIdx) => (
        <ChatItemView key={`${String(turnIdx)}-${String(itemIdx)}`} item={item} />
      ))}
      <TurnSummaryView turn={turn} />
      <ClaudeLoginHint turn={turn} />
      {turn.summary !== undefined && (
        <>
          <ChatFiles turnId={turn.summary.id} files={turn.summary.files} />
          <ChatRevert turnId={turn.summary.id} summary={turn.summary} />
        </>
      )}
    </div>
  );
}

export function ChatThread({ turns }: { readonly turns: readonly ChatTurnView[] }) {
  return (
    <div className="flex flex-col gap-4 overflow-y-auto pr-1">
      {turns.map((turn, turnIdx) => (
        <TurnRowView
          key={`${turn.jobId}-${turn.turnId ?? ''}-${String(turnIdx)}`}
          turn={turn}
          turnIdx={turnIdx}
        />
      ))}
    </div>
  );
}
