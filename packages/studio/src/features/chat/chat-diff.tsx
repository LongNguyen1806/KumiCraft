// Safe monospace diff viewer for a changed file in a turn (WP-3.05b, R-CH-04, S-16).
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { fetchTurnDiff } from '../../api/agent-client.ts';
import { errorText, toErrorInfo } from '../../routes/error-text.ts';

export type ChatDiffProps = {
  readonly turnId: string;
  readonly path: string;
};

type DiffKind = 'add' | 'del' | 'hunk' | 'ctx';

function getLineKind(line: string): DiffKind {
  if (line.startsWith('@@')) return 'hunk';
  if (line.startsWith('+') && !line.startsWith('+++')) return 'add';
  if (line.startsWith('-') && !line.startsWith('---')) return 'del';
  return 'ctx';
}

function getLineClass(kind: DiffKind): string {
  if (kind === 'add') return 'bg-emerald-500/10 text-emerald-700';
  if (kind === 'del') return 'bg-rose-500/10 text-rose-700';
  if (kind === 'hunk') return 'bg-field text-ink-faint font-semibold';
  return 'text-ink-soft';
}

function useDiffContent(turnId: string, path: string) {
  const { t: tError } = useTranslation('errors');
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string>();
  const [diffText, setDiffText] = useState<string>();

  useEffect(() => {
    let active = true;
    const load = async () => {
      setLoading(true);
      setErrorMsg(undefined);
      try {
        const text = await fetchTurnDiff(turnId, path);
        if (active) setDiffText(text);
      } catch (err) {
        if (active) {
          const info = toErrorInfo(err);
          setErrorMsg(errorText(tError, info.code, info.params));
        }
      } finally {
        if (active) setLoading(false);
      }
    };
    void load();
    return () => {
      active = false;
    };
  }, [turnId, path, tError]);

  return { loading, errorMsg, diffText };
}

export function ChatDiff({ turnId, path }: ChatDiffProps) {
  const { t } = useTranslation('chat');
  const { loading, errorMsg, diffText } = useDiffContent(turnId, path);

  if (loading) {
    return (
      <div data-testid="chat-diff" className="rounded bg-field/50 p-2 text-xs text-ink-faint">
        {t('diffLoading')}
      </div>
    );
  }

  if (errorMsg !== undefined) {
    return (
      <div data-testid="chat-diff" className="rounded bg-rose-50 p-2 text-xs text-rose-600">
        {errorMsg}
      </div>
    );
  }

  const lines = (diffText ?? '').split('\n');

  return (
    <div
      data-testid="chat-diff"
      className="max-h-72 overflow-auto rounded border border-border/70 bg-field/30 p-1 font-mono text-[11px] leading-5"
    >
      {lines.map((line, index) => {
        const kind = getLineKind(line);
        return (
          <div
            key={String(index)}
            data-testid="chat-diff-line"
            data-kind={kind}
            className={`px-1.5 whitespace-pre break-all ${getLineClass(kind)}`}
          >
            {line}
          </div>
        );
      })}
    </div>
  );
}
