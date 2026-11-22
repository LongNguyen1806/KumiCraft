// Inspector editor for mixed text elements containing icons, inline tags, or expressions (K9.8-1 TK-78).
import type { ElementSource, TextRunNode } from '@kumicraft/shared';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { sendEdit } from '../../../core/edits.ts';
import { errorText, toErrorInfo } from '../../../routes/error-text.ts';

async function saveTextRunChange(
  source: ElementSource,
  run: Extract<TextRunNode, { readonly kind: 'text' }>,
  draft: string,
  tError: ReturnType<typeof useTranslation<'errors'>>['t'],
  onSaved: () => void,
  onError: (msg: string | undefined) => void,
) {
  if (draft === run.value) return;
  onError(undefined);
  try {
    await sendEdit({
      edit: {
        kind: 'setTextRun',
        loc: source.loc,
        tag: source.tag,
        index: run.runIndex,
        before: run.value,
        after: draft,
      },
    });
    onSaved();
  } catch (cause) {
    const info = toErrorInfo(cause);
    onError(errorText(tError, info.code, info.params));
  }
}

function TextRunInput({
  source,
  run,
  disabled,
  onSaved,
  onError,
}: {
  readonly source: ElementSource;
  readonly run: Extract<TextRunNode, { readonly kind: 'text' }>;
  readonly disabled: boolean;
  readonly onSaved: () => void;
  readonly onError: (msg: string | undefined) => void;
}) {
  const { t } = useTranslation();
  const { t: tError } = useTranslation('errors');
  const [draft, setDraft] = useState(run.value);
  const [prevValue, setPrevValue] = useState(run.value);
  if (run.value !== prevValue) {
    setPrevValue(run.value);
    setDraft(run.value);
  }
  const commit = () => saveTextRunChange(source, run, draft, tError, onSaved, onError);

  return (
    <input
      type="text"
      data-testid={`text-run-input-${String(run.runIndex)}`}
      aria-label={t('inspector.textRunInputLabel', { index: run.runIndex + 1 })}
      disabled={disabled}
      value={draft}
      onChange={(e) => {
        setDraft(e.target.value);
      }}
      onBlur={() => {
        void commit();
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          void commit();
        }
      }}
      className="h-[26px] min-w-[72px] flex-1 rounded border border-line bg-card-solid px-2 text-xs text-ink focus:border-accent focus:outline-none disabled:opacity-50"
    />
  );
}

function ReadonlyRunChip({
  run,
}: {
  readonly run: Exclude<TextRunNode, { readonly kind: 'text' }>;
}) {
  const { t } = useTranslation();
  if (run.kind === 'element') {
    const label = run.iconName !== undefined ? `[icon ${run.iconName}]` : `[${run.tag}]`;
    return (
      <span
        data-testid="text-run-element-chip"
        title={t('inspector.textRunElementReadonly')}
        className="inline-flex h-[24px] items-center rounded border border-line bg-field px-1.5 font-mono text-[11px] text-ink-soft"
      >
        {label}
      </span>
    );
  }
  return (
    <span
      data-testid="text-run-expression-chip"
      title={t('inspector.textRunExpressionReadonly')}
      className="inline-flex h-[24px] items-center rounded border border-line bg-sun-soft px-1.5 font-mono text-[11px] text-warn"
    >
      {`{${run.code}}`}
    </span>
  );
}

export function MixedTextEditor({
  source,
  disabled,
  onSaved,
}: {
  readonly source: ElementSource;
  readonly disabled: boolean;
  readonly onSaved: () => void;
}) {
  const { t } = useTranslation();
  const [error, setError] = useState<string>();
  if (source.text.kind !== 'mixed') return undefined;
  const runs = source.text.runs ?? [];
  if (runs.length === 0) return undefined;

  return (
    <section
      data-testid="mixed-text-editor"
      className="-mx-3 flex flex-col gap-1.5 border-b border-line px-3 py-2 text-xs"
    >
      <div className="font-semibold text-ink">{t('inspector.mixedTextTitle')}</div>
      <div className="flex flex-wrap items-center gap-1.5">
        {runs.map((run, idx) =>
          run.kind === 'text' ? (
            <TextRunInput
              key={`run-${String(run.runIndex)}`}
              source={source}
              run={run}
              disabled={disabled}
              onSaved={onSaved}
              onError={setError}
            />
          ) : (
            <ReadonlyRunChip key={`chip-${String(idx)}`} run={run} />
          ),
        )}
      </div>
      {error !== undefined && (
        <p role="alert" className="text-[11px] text-danger">
          {error}
        </p>
      )}
    </section>
  );
}
