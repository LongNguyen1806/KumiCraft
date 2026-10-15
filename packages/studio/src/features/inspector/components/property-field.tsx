// Property field control in Inspector: value display, inheritance indicator, and override controls (SPEC-04 M-IN, R-IN-11).
import type { ClassContext, ClassToken, ClassValue, PropertyId, Scope } from '@reactcraft/shared';
import { readValue } from '@reactcraft/shared';
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
};

function formatScopeName(scope: Scope): string {
  if (scope.breakpoint === 'base') {
    return scope.state ? `base:${scope.state}` : 'base';
  }
  return scope.state ? `${scope.breakpoint}:${scope.state}` : scope.breakpoint;
}

function PropertyHeader({
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
  options,
  onChange,
}: {
  readonly property: PropertyId;
  readonly currentValStr: string;
  readonly disabled: boolean;
  readonly options?: readonly string[] | undefined;
  readonly onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => void;
}) {
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
        <option value="">—</option>
        {options.map((opt) => (
          <option key={opt} value={opt}>
            {opt}
          </option>
        ))}
      </select>
    );
  }

  return (
    <input
      id={`field-${property}`}
      data-testid={`input-${property}`}
      type="text"
      disabled={disabled}
      value={currentValStr}
      placeholder="—"
      onChange={onChange}
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
}: PropertyFieldProps) {
  const read = readValue(tokens, property, { width: frameWidth, state: currentScope.state }, ctx);

  const isInherited =
    read.from !== undefined &&
    (read.from.breakpoint !== currentScope.breakpoint || read.from.state !== currentScope.state);

  const canRemoveOverride =
    !isInherited && currentScope.breakpoint !== 'base' && read.value !== undefined;

  const currentValStr = formatClassValueString(read.value);

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
        fromScope={read.from}
        disabled={disabled}
        onRemoveOverride={() => {
          onValueChange(property, undefined);
        }}
      />
      <PropertyInputControl
        property={property}
        currentValStr={currentValStr}
        disabled={disabled}
        options={options}
        onChange={handleChange}
      />
    </div>
  );
}
