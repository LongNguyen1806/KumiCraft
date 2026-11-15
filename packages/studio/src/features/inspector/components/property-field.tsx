// Property field control in Inspector: value display, inheritance indicator, and override controls (SPEC-04 M-IN, R-IN-11).
import type { ClassContext, ClassToken, ClassValue, PropertyId, Scope } from '@kumicraft/shared';
import { readValue } from '@kumicraft/shared';
import type { TFunction } from 'i18next';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { isOpenScale } from '../scale-values.ts';
import { useOwnScreen } from '../screen-scope.ts';
import { ScaleInput } from './scale-input.tsx';
import { ScreenOwnButton } from './screen-scope-controls.tsx';
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

/**
 * A field's label. When the active screen has a value of its own (spec-log #141) the label turns
 * blue and a device icon beside it drops that value.
 */
export function PropertyHeader({
  property,
  label,
  ownScreen,
  disabled,
}: {
  readonly property: PropertyId;
  readonly label: string;
  readonly ownScreen: boolean;
  readonly disabled: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-1">
      <label
        htmlFor={`field-${property}`}
        className={`truncate text-[11px] ${ownScreen ? 'font-medium text-accent' : 'text-ink-faint'}`}
      >
        {label}
      </label>
      {ownScreen && <ScreenOwnButton property={property} disabled={disabled} />}
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
  /** Tailwind major version of the project, for which typed values are valid. */
  readonly major: 3 | 4;
};

const SHADOW_KEYS = {
  none: 'inspector.shadowNames.none',
  '2xs': 'inspector.shadowNames.2xs',
  xs: 'inspector.shadowNames.xs',
  sm: 'inspector.shadowNames.sm',
  DEFAULT: 'inspector.shadowNames.DEFAULT',
  md: 'inspector.shadowNames.md',
  lg: 'inspector.shadowNames.lg',
  xl: 'inspector.shadowNames.xl',
  '2xl': 'inspector.shadowNames.2xl',
  inner: 'inspector.shadowNames.inner',
} as const;

const isShadowStep = (value: string): value is keyof typeof SHADOW_KEYS =>
  Object.hasOwn(SHADOW_KEYS, value);

/**
 * What a list shows for an option: the Tailwind shadow steps in words with the class name after
 * them ("Vừa (md)"), as `DEFAULT` or `sm` alone told the owner nothing; a theme name stays as is.
 */
function optionLabel(property: string, opt: string, t: TFunction): string {
  if (property !== 'boxShadow' || !isShadowStep(opt)) return opt;
  return `${t(SHADOW_KEYS[opt])} (${opt === 'DEFAULT' ? 'shadow' : opt})`;
}

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
          {optionLabel(property, opt, t)}
        </option>
      ))}
    </select>
  );
}

function PropertyInputControl(props: InputControlProps) {
  const { property, currentValStr, disabled, options, segments, onInput } = props;
  // Spacing, sizes, borders, z-index…: any value can be typed, the usual ones are suggested.
  if (isOpenScale(property)) {
    return (
      <ScaleInput
        property={property}
        value={currentValStr}
        suggestions={options ?? []}
        major={props.major}
        disabled={disabled}
        mixed={props.mixed}
        className={`${FIELD_CONTROL} font-mono`}
        onInput={onInput}
      />
    );
  }
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

/** What a field shows for the active frame and state. */
export function readField(
  props: Pick<
    PropertyFieldProps,
    'tokens' | 'property' | 'frameWidth' | 'currentScope' | 'ctx' | 'mixed'
  >,
): { readonly currentValStr: string } {
  const { tokens, property, frameWidth, currentScope, ctx, mixed = false } = props;
  const read = readValue(tokens, property, { width: frameWidth, state: currentScope.state }, ctx);
  return { currentValStr: mixed ? '' : formatClassValueString(read.value) };
}

export function PropertyField(props: PropertyFieldProps) {
  const { property, label, onValueChange, options, segments, disabled = false, mixed } = props;
  const read = readField(props);
  const ownScreen = useOwnScreen(
    props.tokens,
    property,
    props.currentScope,
    props.ctx,
    mixed === true,
  );

  return (
    <div
      className={`flex flex-col gap-1 py-1 ${segments === undefined ? '' : 'col-span-2'}`}
      data-testid={`property-field-${property}`}
    >
      <PropertyHeader property={property} label={label} ownScreen={ownScreen} disabled={disabled} />
      <PropertyInputControl
        property={property}
        currentValStr={read.currentValStr}
        disabled={disabled}
        mixed={mixed}
        options={options}
        segments={segments}
        major={props.ctx.major ?? 4}
        onInput={(raw) => {
          onValueChange(property, parseInputToClassValue(raw));
        }}
      />
    </div>
  );
}
