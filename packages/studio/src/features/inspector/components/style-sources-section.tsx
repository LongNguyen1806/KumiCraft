// Style properties of the selected element in a plain CSS project: value, where it is declared,
// and editing through the style layer (SPEC-04 M-ST, R-ST-04 to R-ST-07, R-ST-09, R-ST-10, R-ST-13).
import {
  CSS_LONGHAND_OF,
  CssValueSchema,
  type ElementRef,
  type StyleProperty,
  type StyleReading,
  type StyleState,
  StyleStateSchema,
} from '@kumicraft/shared';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { studioBridgeChannel } from '../../selection/bridge-channel.ts';
import type { StyleTarget } from '../../style/style-target-store.ts';

/** The properties always listed, declared or not; any other declared one is listed too. */
const CORE_PROPERTIES = [
  'paddingTop',
  'paddingRight',
  'paddingBottom',
  'paddingLeft',
  'marginTop',
  'marginBottom',
  'width',
  'height',
  'display',
  'fontSize',
  'fontWeight',
  'textColor',
  'backgroundColor',
  'borderRadius',
];

function SourceText({ property }: { readonly property: StyleProperty }) {
  const { t } = useTranslation();
  const source = property.source;
  if (source?.kind === 'rule') {
    return (
      <span className="font-mono">
        {source.file}:{source.line}
        {source.affects > 1 && (
          <span data-testid={`style-affects-${property.id}`} className="ml-1.5 text-warn">
            {t('inspector.styleSources.affects', { count: source.affects })}
          </span>
        )}
      </span>
    );
  }
  if (source?.kind === 'class') {
    return (
      <span className="font-mono">
        {t('inspector.styleSources.class', { className: source.className })}
      </span>
    );
  }
  if (source?.kind === 'inline') return <span>{t('inspector.styleSources.inline')}</span>;
  if (source?.kind === 'inherited' || source === undefined) return undefined;
  return <span>{t('inspector.styleSources.external')}</span>;
}

type RowProps = {
  readonly property: StyleProperty;
  readonly writable: boolean;
  readonly elementRef?: ElementRef | undefined;
  readonly interactionState?: StyleState | undefined;
  readonly onCommit: (id: string, value: string) => void;
};

function previewDraft(
  elementRef: ElementRef | undefined,
  interactionState: StyleState | undefined,
  longhand: string,
  nextDraft: string,
): void {
  if (interactionState !== undefined || elementRef === undefined) return;
  const trimmed = nextDraft.trim();
  if (trimmed.length > 0 && CssValueSchema.safeParse(trimmed).success) {
    studioBridgeChannel.sendStylePreview(elementRef, longhand, trimmed);
  } else {
    studioBridgeChannel.clearStylePreview();
  }
}

/** How long a saved value is shown before the file's own value takes over again. */
const SENT_HOLD_MS = 2000;

/**
 * The value just saved, shown in the field for SENT_HOLD_MS: a reading of the file that lands
 * late can still hold the previous value and must not put it back (K9.6-0, PB-02 on MarketLink).
 */
function useHeldValue(): [string | undefined, (value: string) => void] {
  const [held, setHeld] = useState<string>();
  useEffect(() => {
    if (held === undefined) return undefined;
    const timer = setTimeout(() => {
      setHeld(undefined);
    }, SENT_HOLD_MS);
    return () => {
      clearTimeout(timer);
    };
  }, [held]);
  return [held, setHeld];
}

function StyleRow({ property, writable, elementRef, interactionState, onCommit }: RowProps) {
  // What the user types, and the value the field showed when they began: a change is saved when
  // it differs from that, whatever reading of the file lands meanwhile (K9.5, PB-02).
  const [draft, setDraft] = useState<{ readonly text: string; readonly from: string }>();
  const read = property.value?.css ?? '';
  const [sent, setSent] = useHeldValue();
  const current = sent ?? read;
  const longhand = CSS_LONGHAND_OF[property.id] ?? property.id;
  const commit = () => {
    const next = draft?.text.trim();
    if (draft !== undefined && next !== undefined && next !== draft.from) {
      onCommit(property.id, next);
      setSent(next);
    } else {
      studioBridgeChannel.clearStylePreview();
    }
    setDraft(undefined);
  };
  return (
    <li
      data-testid={`style-source-${property.id}`}
      className="grid grid-cols-[7rem_1fr] items-center gap-x-2 gap-y-0.5"
    >
      <span className="truncate font-mono text-ink">{longhand}</span>
      <input
        data-testid={`style-input-${property.id}`}
        className="h-7 min-w-0 rounded-md border border-line bg-card-solid px-2 font-mono text-ink hover:bg-field disabled:opacity-60"
        value={draft?.text ?? current}
        disabled={!writable || property.source?.kind === 'inline'}
        onChange={(e) => {
          const next = e.target.value;
          setDraft({ text: next, from: draft?.from ?? current });
          previewDraft(elementRef, interactionState, longhand, next);
        }}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') commit();
          if (e.key === 'Escape') {
            setDraft(undefined);
            studioBridgeChannel.clearStylePreview();
          }
        }}
      />
      <span className="col-start-2 text-[11px] text-ink-soft">
        <SourceText property={property} />
      </span>
    </li>
  );
}

type StateSelectProps = {
  readonly value: StyleState | undefined;
  readonly onChange?: ((next: StyleState | undefined) => void) | undefined;
};

function StateSelect({ value, onChange }: StateSelectProps) {
  const { t } = useTranslation();
  return (
    <label className="flex items-center gap-2 text-ink-soft">
      <span>{t('inspector.state')}</span>
      <select
        data-testid="style-state"
        className="h-[26px] rounded-md border border-line bg-card-solid px-2 text-ink hover:bg-field"
        value={value ?? ''}
        onChange={(e) => {
          const parsed = StyleStateSchema.safeParse(e.target.value);
          onChange?.(parsed.success ? parsed.data : undefined);
        }}
      >
        <option value="">{t('inspector.stateNone')}</option>
        <option value="hover">{t('inspector.stateHover')}</option>
        <option value="focus">{t('inspector.stateFocus')}</option>
        <option value="disabled">{t('inspector.stateDisabled')}</option>
      </select>
    </label>
  );
}

type TargetSwitchProps = {
  readonly count: number;
  readonly value: StyleTarget;
  readonly onChange: (t: StyleTarget) => void;
};

function TargetSwitch({ count, value, onChange }: TargetSwitchProps) {
  const { t } = useTranslation();
  const option = (target: StyleTarget, label: string) => (
    <label className="flex items-center gap-1">
      <input
        type="radio"
        name="style-target"
        data-testid={`style-target-${target}`}
        checked={value === target}
        onChange={() => {
          onChange(target);
        }}
      />
      {label}
    </label>
  );
  return (
    <div className="flex flex-wrap items-center gap-3 text-ink-soft">
      <span>{t('inspector.styleSources.target.label')}</span>
      {option('rule', t('inspector.styleSources.target.rule', { count }))}
      {option('element', t('inspector.styleSources.target.element'))}
    </div>
  );
}

type StyleSourcesSectionProps = {
  readonly reading: StyleReading;
  readonly writable?: boolean;
  readonly elementRef?: ElementRef | undefined;
  readonly interactionState?: StyleState | undefined;
  readonly onStateChange?: (state: StyleState | undefined) => void;
  readonly target?: StyleTarget;
  readonly onTargetChange?: (target: StyleTarget) => void;
  readonly onCommit?: (id: string, value: string) => void;
  readonly error?: string | undefined;
};

export function StyleSourcesSection({
  reading,
  writable = false,
  elementRef,
  interactionState,
  onStateChange,
  target = 'rule',
  onTargetChange,
  onCommit,
  error,
}: StyleSourcesSectionProps) {
  const { t } = useTranslation();
  const rows = reading.properties.filter(
    (p) =>
      CORE_PROPERTIES.includes(p.id) || (p.source !== undefined && p.source.kind !== 'inherited'),
  );
  const shared = Math.max(
    0,
    ...rows.map((p) => (p.source?.kind === 'rule' ? p.source.affects : 0)),
  );
  return (
    <section data-testid="style-sources" className="space-y-2 pt-2.5 text-xs">
      <h3 className="font-semibold text-ink">{t('inspector.styleSources.title')}</h3>
      {writable && <StateSelect value={interactionState} onChange={onStateChange} />}
      {writable && shared > 1 && onTargetChange !== undefined && (
        <TargetSwitch count={shared} value={target} onChange={onTargetChange} />
      )}
      <ul className="space-y-1.5">
        {rows.map((p) => (
          <StyleRow
            key={p.id}
            property={p}
            writable={writable}
            elementRef={elementRef}
            interactionState={interactionState}
            onCommit={onCommit ?? (() => undefined)}
          />
        ))}
      </ul>
      {error !== undefined && (
        <p role="alert" data-testid="style-error" className="text-danger">
          {error}
        </p>
      )}
    </section>
  );
}

export { CssStyleEditor } from './css-style-editor.tsx';
