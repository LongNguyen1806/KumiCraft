// Property field control in Inspector: value display, inheritance indicator, and override controls (SPEC-04 M-IN, R-IN-11).
import type { ClassContext, ClassToken, ClassValue, PropertyId, Scope } from '@kumicraft/shared';
import { readValue } from '@kumicraft/shared';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { SegmentButtons } from './segment-buttons.tsx';

export type PropertyFieldProps = {
  readonly property: PropertyId;
  readonly label: string;
  readonly tokens: readonly ClassToken[];
  readonly currentScope: Scope;
  readonly frameWidth: number;
  readonly ctx: ClassContext;
  readonly onValueChange: (property: PropertyId, value: ClassValue | undefined) => void;
  readonly options?: readonly string[] | undefined;
  /** The most used values, drawn as joined buttons before the select (P5). */
  readonly segments?: readonly string[] | undefined;
  readonly disabled?: boolean | undefined;
  readonly mixed?: boolean | undefined;
};

const FIELD_BASE =
  'h-7 rounded-md border border-line bg-card-solid px-2 text-xs text-ink hover:bg-field disabled:opacity-50 disabled:hover:bg-card-solid';
export const FIELD_CONTROL = `${FIELD_BASE} w-full`;

/**
 * The choices of a select, with the value read from the code added first when it is not one of
 * them (`w-96`, `w-[420px]`…): otherwise the select would show "—" for a value that is set
 * (spec-log #120).
 */
export function choicesWith(options: readonly string[], current: string): readonly string[] {
  return current === '' || options.includes(current) ? options : [current, ...options];
}

export function formatScopeName(scope: Scope): string {
  if (scope.breakpoint === 'base') {
    return scope.state ? `base:${scope.state}` : 'base';
  }
  return scope.state ? `${scope.breakpoint}:${scope.state}` : scope.breakpoint;
}

export function PropertyHeader({
  property,
  label,
  isInherited,
  canRemoveOverride,
  fromScope,
  disabled,
  onRemoveOverride,
}: {
  readonly property: PropertyId;
  readonly label: string;
  readonly isInherited: boolean;
  readonly canRemoveOverride: boolean;
  readonly fromScope?: Scope | undefined;
  readonly disabled: boolean;
  readonly onRemoveOverride: () => void;
}) {
  const { t } = useTranslation();
  return (
    <div className="flex items-center justify-between gap-1">
      <label htmlFor={`field-${property}`} className="truncate text-[11px] text-ink-faint">
        {label}
      </label>
      <div className="flex items-center gap-1">
        {isInherited && fromScope && (
          <span
            data-testid={`inherited-badge-${property}`}
            className="max-w-[120px] truncate text-[10px] text-ink-faint italic"
          >
            {t('inspector.inheritedFrom', { scope: formatScopeName(fromScope) })}
          </span>
        )}
        {canRemoveOverride && (
          <button
            type="button"
            data-testid={`remove-override-${property}`}
            onClick={onRemoveOverride}
            disabled={disabled}
            className="text-[10px] text-accent hover:underline disabled:opacity-40"
          >
            {t('inspector.removeOverride')}
          </button>
        )}
      </div>
    </div>
  );
}

type InputControlProps = {
  readonly property: PropertyId;
  readonly currentValStr: string;
  readonly disabled: boolean;
  readonly mixed?: boolean | undefined;
  readonly options?: readonly string[] | undefined;
  readonly segments?: readonly string[] | undefined;
  readonly onInput: (raw: string) => void;
};

function OptionSelect({
  property,
  currentValStr,
  disabled,
  mixed,
  options,
  narrow,
  onInput,
}: InputControlProps & { readonly options: readonly string[]; readonly narrow: boolean }) {
  const { t } = useTranslation();
  return (
    <select
      id={`field-${property}`}
      data-testid={`input-${property}`}
      disabled={disabled}
      value={currentValStr}
      onChange={(e) => {
        onInput(e.target.value);
      }}
      className={narrow ? `${FIELD_BASE} w-[5.5rem] shrink-0` : FIELD_CONTROL}
    >
      <option value="">{mixed ? t('inspector.mixed') : '—'}</option>
      {choicesWith(options, currentValStr).map((opt) => (
        <option key={opt} value={opt}>
          {opt}
        </option>
      ))}
    </select>
  );
}

function PropertyInputControl(props: InputControlProps) {
  const { property, currentValStr, disabled, options, segments, onInput } = props;
  if (options === undefined || options.length === 0) {
    return <TextValueInput {...props} />;
  }
  if (segments === undefined) {
    return <OptionSelect {...props} options={options} narrow={false} />;
  }
  return (
    <div className="flex items-center gap-1.5">
      <SegmentButtons
        property={property}
        segments={segments}
        current={currentValStr}
        disabled={disabled}
        onPick={onInput}
      />
      <OptionSelect {...props} options={options} narrow />
    </div>
  );
}

/**
 * R-IN-20: while the field has focus it shows what the user types; a refreshed source does not
 * overwrite it until focus leaves. Every change is still sent at once (R-IN-13, R-IN-14).
 */
function TextValueInput({ property, currentValStr, disabled, mixed, onInput }: InputControlProps) {
  const { t } = useTranslation();
  const [draft, setDraft] = useState<string>();
  return (
    <input
      id={`field-${property}`}
      data-testid={`input-${property}`}
      type="text"
      disabled={disabled}
      value={draft ?? currentValStr}
      placeholder={mixed ? t('inspector.mixed') : '—'}
      onFocus={() => {
        setDraft(currentValStr);
      }}
      onBlur={() => {
        setDraft(undefined);
      }}
      onChange={(e) => {
        setDraft(e.target.value);
        onInput(e.target.value);
      }}
      className={`${FIELD_CONTROL} font-mono`}
    />
  );
}

function formatClassValueString(value: ClassValue | undefined): string {
  if (value === undefined) return '';
  if (value.kind === 'scale') return value.token;
  if (value.kind === 'arbitrary') return `[${value.css}]`;
  return value.name;
}

export function parseInputToClassValue(rawVal: string): ClassValue | undefined {
  const val = rawVal.trim();
  if (!val) return undefined;
  if (val.startsWith('[') && val.endsWith(']')) {
    return { kind: 'arbitrary', css: val.slice(1, -1) };
  }
  return { kind: 'scale', token: val };
}

type FieldRead = {
  readonly isInherited: boolean;
  readonly canRemoveOverride: boolean;
  readonly currentValStr: string;
  readonly fromScope: Scope | undefined;
};

/** What a field shows for the active frame and state, and where the value comes from. */
export function readField(
  props: Pick<
    PropertyFieldProps,
    'tokens' | 'property' | 'frameWidth' | 'currentScope' | 'ctx' | 'mixed'
  >,
): FieldRead {
  const { tokens, property, frameWidth, currentScope, ctx, mixed = false } = props;
  const read = readValue(tokens, property, { width: frameWidth, state: currentScope.state }, ctx);
  const isInherited =
    !mixed &&
    read.from !== undefined &&
    (read.from.breakpoint !== currentScope.breakpoint || read.from.state !== currentScope.state);
  return {
    isInherited,
    canRemoveOverride:
      !mixed && !isInherited && currentScope.breakpoint !== 'base' && read.value !== undefined,
    currentValStr: mixed ? '' : formatClassValueString(read.value),
    fromScope: mixed ? undefined : read.from,
  };
}

export function PropertyField(props: PropertyFieldProps) {
  const { property, label, onValueChange, options, segments, disabled = false, mixed } = props;
  const read = readField(props);

  return (
    <div
      className={`flex flex-col gap-1 py-1 ${segments === undefined ? '' : 'col-span-2'}`}
      data-testid={`property-field-${property}`}
    >
      <PropertyHeader
        property={property}
        label={label}
        isInherited={read.isInherited}
        canRemoveOverride={read.canRemoveOverride}
        fromScope={read.fromScope}
        disabled={disabled}
        onRemoveOverride={() => {
          onValueChange(property, undefined);
        }}
      />
      <PropertyInputControl
        property={property}
        currentValStr={read.currentValStr}
        disabled={disabled}
        mixed={mixed}
        options={options}
        segments={segments}
        onInput={(raw) => {
          onValueChange(property, parseInputToClassValue(raw));
        }}
      />
    </div>
  );
}
