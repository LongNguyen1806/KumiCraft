// Other classes section and collapsible raw class string editor (SPEC-04 M-IN, R-IN-17).
import type { ClassToken } from '@reactcraft/shared';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

type OtherClassesSectionProps = {
  readonly tokens: readonly ClassToken[];
  readonly rawClassString: string;
  readonly onRawClassChange: (newString: string) => void;
  readonly disabled?: boolean | undefined;
};

function RawClassInput({
  rawClassString,
  onRawClassChange,
  disabled,
}: {
  readonly rawClassString: string;
  readonly onRawClassChange: (newString: string) => void;
  readonly disabled: boolean;
}) {
  const [draft, setDraft] = useState<string>(rawClassString);

  return (
    <input
      data-testid="raw-class-input"
      type="text"
      disabled={disabled}
      value={draft}
      onChange={(e) => {
        setDraft(e.target.value);
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          onRawClassChange(draft);
        }
      }}
      onBlur={() => {
        if (draft !== rawClassString) {
          onRawClassChange(draft);
        }
      }}
      placeholder="—"
      className="h-8 w-full rounded border border-border/60 bg-field px-2 font-mono text-xs text-ink focus:outline-none focus:ring-1 focus:ring-accent disabled:opacity-50"
    />
  );
}

export function OtherClassesSection({
  tokens,
  rawClassString,
  onRawClassChange,
  disabled = false,
}: OtherClassesSectionProps) {
  const { t } = useTranslation();
  const otherTokens = tokens.filter((tok) => tok.property === undefined);

  return (
    <div
      className="flex flex-col gap-3 py-2 border-t border-border/40"
      data-testid="other-classes-section"
    >
      {otherTokens.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <h3 className="text-xs font-semibold text-ink-strong tracking-tight">
            {t('inspector.groups.otherClasses')}
          </h3>
          <div className="flex flex-wrap gap-1" data-testid="other-classes-list">
            {otherTokens.map((tok, idx) => (
              <span
                key={`${tok.raw}-${String(idx)}`}
                data-testid="other-class-chip"
                className="rounded bg-field px-1.5 py-0.5 font-mono text-[11px] text-ink-soft border border-border/40"
              >
                {tok.raw}
              </span>
            ))}
          </div>
        </div>
      )}

      <details className="group flex flex-col gap-1.5" data-testid="raw-class-details">
        <summary className="cursor-pointer text-xs font-semibold text-ink-soft hover:text-ink select-none">
          {t('inspector.groups.rawClasses')}
        </summary>
        <div className="pt-1.5">
          <RawClassInput
            rawClassString={rawClassString}
            onRawClassChange={onRawClassChange}
            disabled={disabled}
          />
        </div>
      </details>
    </div>
  );
}
