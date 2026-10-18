// Property field control in Inspector: value display, inheritance indicator, and override controls (SPEC-04 M-IN, R-IN-11).
import type { ClassContext, ClassToken, ClassValue, PropertyId, Scope } from '@reactcraft/shared';
import { readValue } from '@reactcraft/shared';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

type PropertyFieldProps = {
  readonly property: PropertyId;
  readonly label: string;
  readonly tokens: readonly ClassToken[];
  readonly currentScope: Scope;
  readonly frameWidth: number;
  readonly ctx: ClassContext;
  readonly onValueChange: (property: PropertyId, value: ClassValue | undefined) => void;
  readonly options?: readonly string[] | undefined;
  readonly disabled?: boolean | undefined;
  readonly mixed?: boolean | undefined;
};

function formatScopeName(scope: Scope): string {
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
      <label htmlFor={`field-${property}`} className="text-xs text-ink-soft truncate font-normal">
        {label}
      </label>
      <div className="flex items-center gap-1">
        {isInherited && fromScope && (
          <span
            data-testid={`inherited-badge-${property}`}
            className="text-[10px] text-ink-faint italic truncate max-w-[120px]"
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

function PropertyInputControl({
  property,
  currentValStr,
  disabled,
  mixed,
  options,
  onChange,
}: {
  readonly property: PropertyId;
  readonly currentValStr: string;
  readonly disabled: boolean;
  readonly mixed?: boolean | undefined;
  readonly options?: readonly string[] | undefined;
  readonly onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => void;
}) {
  const { t } = useTranslation();
  if (options && options.length > 0) {
    return (
      <select
        id={`field-${property}`}
        data-testid={`input-${property}`}
        disabled={disabled}
        value={currentValStr}
        onChange={onChange}
        className="h-7 w-full rounded border border-border/60 bg-field px-2 text-xs text-ink focus:outline-none focus:ring-1 focus:ring-accent disabled:opacity-50"
      >
        <option value="">{mixed ? t('inspector.mixed') : '—'}</option>
        {options.map((opt) => (
          <option key={opt} value={opt}>
            {opt}
          </option>
        ))}
      </select>
    );
  }

  return (
    <TextValueInput
      property={property}
      currentValStr={currentValStr}
      disabled={disabled}
      mixed={mixed}
      onChange={onChange}
    />
  );
}

/**
 * R-IN-20: while the field has focus it shows what the user types; a refreshed source does not
 * overwrite it until focus leaves. Every change is still sent at once (R-IN-13, R-IN-14).
 */
function TextValueInput({
  property,
  currentValStr,
  disabled,
  mixed,
  onChange,
}: {
  readonly property: PropertyId;
  readonly currentValStr: string;
  readonly disabled: boolean;
  readonly mixed?: boolean | undefined;
  readonly onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
}) {
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
        onChange(e);
      }}
      className="h-7 w-full rounded border border-border/60 bg-field px-2 font-mono text-xs text-ink focus:outline-none focus:ring-1 focus:ring-accent disabled:opacity-50"
    />
  );
}

function formatClassValueString(value: ClassValue | undefined): string {
  if (value === undefined) return '';
  if (value.kind === 'scale') return value.token;
  if (value.kind === 'arbitrary') return `[${value.css}]`;
  return value.name;
}

function parseInputToClassValue(rawVal: string): ClassValue | undefined {
  const val = rawVal.trim();
  if (!val) return undefined;
  if (val.startsWith('[') && val.endsWith(']')) {
    return { kind: 'arbitrary', css: val.slice(1, -1) };
  }
  return { kind: 'scale', token: val };
}

export function PropertyField({
  property,
  label,
  tokens,
  currentScope,
  frameWidth,
  ctx,
  onValueChange,
  options,
  disabled = false,
  mixed = false,
}: PropertyFieldProps) {
  const read = readValue(tokens, property, { width: frameWidth, state: currentScope.state }, ctx);

  const isInherited =
    !mixed &&
    read.from !== undefined &&
    (read.from.breakpoint !== currentScope.breakpoint || read.from.state !== currentScope.state);

  const canRemoveOverride =
    !mixed && !isInherited && currentScope.breakpoint !== 'base' && read.value !== undefined;

  const currentValStr = mixed ? '' : formatClassValueString(read.value);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    onValueChange(property, parseInputToClassValue(e.target.value));
  };

  return (
    <div className="flex flex-col gap-1 py-1" data-testid={`property-field-${property}`}>
      <PropertyHeader
        property={property}
        label={label}
        isInherited={isInherited}
        canRemoveOverride={canRemoveOverride}
        fromScope={mixed ? undefined : read.from}
        disabled={disabled}
        onRemoveOverride={() => {
          onValueChange(property, undefined);
        }}
      />
      <PropertyInputControl
        property={property}
        currentValStr={currentValStr}
        disabled={disabled}
        mixed={mixed}
        options={options}
        onChange={handleChange}
      />
    </div>
  );
}
