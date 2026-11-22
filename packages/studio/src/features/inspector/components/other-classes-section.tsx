// Other classes section and collapsible raw class string editor (SPEC-04 M-IN, R-IN-17).
import type { ClassToken } from '@kumicraft/style-tailwind';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { InspectorGroup } from './inspector-group.tsx';

type OtherClassesSectionProps = {
  readonly tokens: readonly ClassToken[];
  readonly rawClassString: string;
  readonly onRawClassChange: (newString: string) => void;
  readonly disabled?: boolean | undefined;
  readonly callStaticRest?: string | undefined;
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
  // A change made elsewhere (a property field, Undo, a source refresh) shows here too, so Enter
  // never writes back an older string.
  const [shown, setShown] = useState(rawClassString);
  if (shown !== rawClassString) {
    setShown(rawClassString);
    setDraft(rawClassString);
  }

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
      className="h-7 w-full rounded-md border border-line bg-card-solid px-2 font-mono text-xs text-ink hover:bg-field disabled:opacity-50"
    />
  );
}

function OtherTokensList({ tokens }: { readonly tokens: readonly ClassToken[] }) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex flex-wrap gap-1" data-testid="other-classes-list">
        {tokens.map((tok, idx) => (
          <span
            key={`${tok.raw}-${String(idx)}`}
            data-testid="other-class-chip"
            className="rounded bg-field px-1.5 py-0.5 font-mono text-[11px] text-ink-soft"
          >
            {tok.raw}
          </span>
        ))}
      </div>
    </div>
  );
}

export function OtherClassesSection({
  tokens,
  rawClassString,
  onRawClassChange,
  disabled = false,
  callStaticRest,
}: OtherClassesSectionProps) {
  const { t } = useTranslation();
  const otherTokens = tokens.filter((tok) => tok.property === undefined);

  return (
    <InspectorGroup
      id="otherClasses"
      title={t('inspector.groups.otherClasses')}
      defaultOpen
      testId="other-classes-section"
    >
      <div className="flex flex-col gap-3">
        {otherTokens.length > 0 && <OtherTokensList tokens={otherTokens} />}

        {callStaticRest !== undefined && (
          <p
            data-testid="call-static-rest-note"
            className="text-[11px] text-ink-faint leading-tight font-mono"
          >
            {t('inspector.callStaticRest', { rest: callStaticRest })}
          </p>
        )}

        <details className="group flex flex-col gap-1.5" data-testid="raw-class-details">
          <summary className="cursor-pointer text-[11px] font-medium text-ink-soft select-none hover:text-ink">
            {t('inspector.groups.rawClasses')}
          </summary>
          <div className="pt-1.5 flex flex-col gap-1">
            <RawClassInput
              rawClassString={rawClassString}
              onRawClassChange={onRawClassChange}
              disabled={disabled}
            />
          </div>
        </details>
      </div>
    </InspectorGroup>
  );
}
