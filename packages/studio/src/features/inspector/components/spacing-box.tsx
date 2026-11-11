// The margin / padding box (P5): the four sides of each drawn around the element, one small
// select per side. The "all sides" fields stay as ordinary fields above the box.
import type { PropertyId } from '@kumicraft/shared';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

import type { PropertyFieldDef } from '../property-groups-config.ts';
import type { PropertyFieldProps } from './property-field.tsx';
import {
  choicesWith,
  formatScopeName,
  parseInputToClassValue,
  readField,
} from './property-field.tsx';

export type SpacingShared = Pick<
  PropertyFieldProps,
  'tokens' | 'currentScope' | 'frameWidth' | 'ctx' | 'onValueChange' | 'disabled'
>;

const BOX_SIDES: readonly PropertyId[] = [
  'marginTop',
  'marginRight',
  'marginBottom',
  'marginLeft',
  'paddingTop',
  'paddingRight',
  'paddingBottom',
  'paddingLeft',
];

export function isBoxSide(property: PropertyId): boolean {
  return BOX_SIDES.includes(property);
}

/** One side: a bare select; the label and where the value comes from are in its tooltip. */
function SideSelect({
  field,
  shared,
}: {
  readonly field: PropertyFieldDef;
  readonly shared: SpacingShared;
}) {
  const { t } = useTranslation();
  const { property } = field;
  const read = readField({ ...shared, property });
  const label = t(field.labelKey);
  const from =
    read.isInherited && read.fromScope !== undefined
      ? ` · ${t('inspector.inheritedFrom', { scope: formatScopeName(read.fromScope) })}`
      : '';
  const tone =
    read.currentValStr === ''
      ? 'text-ink-faint'
      : read.isInherited
        ? 'text-ink italic'
        : 'font-semibold text-accent';

  return (
    <span data-testid={`property-field-${property}`} className="grid place-items-center">
      <select
        id={`field-${property}`}
        data-testid={`input-${property}`}
        aria-label={label}
        title={`${label}${from}`}
        disabled={shared.disabled}
        value={read.currentValStr}
        onChange={(e) => {
          shared.onValueChange(property, parseInputToClassValue(e.target.value));
        }}
        className={`h-[22px] w-10 rounded bg-transparent bg-none px-0 text-center font-mono text-[11px] [text-align-last:center] hover:bg-field-hover disabled:opacity-50 ${tone}`}
      >
        <option value="">—</option>
        {choicesWith(field.options ?? [], read.currentValStr).map((opt) => (
          <option key={opt} value={opt}>
            {opt}
          </option>
        ))}
      </select>
    </span>
  );
}

function Ring({
  name,
  sides,
  shared,
  className,
  children,
}: {
  readonly name: string;
  /** Top, right, bottom, left. */
  readonly sides: readonly PropertyFieldDef[];
  readonly shared: SpacingShared;
  readonly className: string;
  readonly children: ReactNode;
}) {
  const [top, right, bottom, left] = sides;
  if (top === undefined || right === undefined || bottom === undefined || left === undefined) {
    return undefined;
  }
  return (
    <div className={`relative grid gap-0.5 rounded-md p-1 ${className}`}>
      <span className="pointer-events-none absolute top-1 left-1.5 text-[9.5px] text-ink-faint">
        {name}
      </span>
      <SideSelect field={top} shared={shared} />
      <div className="grid grid-cols-[2.5rem_minmax(0,1fr)_2.5rem] items-center gap-0.5">
        <SideSelect field={left} shared={shared} />
        {children}
        <SideSelect field={right} shared={shared} />
      </div>
      <SideSelect field={bottom} shared={shared} />
    </div>
  );
}

const pick = (fields: readonly PropertyFieldDef[], prefix: 'margin' | 'padding') =>
  (['Top', 'Right', 'Bottom', 'Left'] as const)
    .map((side) => fields.find((f) => f.property === `${prefix}${side}`))
    .filter((f): f is PropertyFieldDef => f !== undefined);

export function SpacingBox({
  fields,
  shared,
}: {
  readonly fields: readonly PropertyFieldDef[];
  readonly shared: SpacingShared;
}) {
  return (
    <div data-testid="spacing-box" className="mt-1.5">
      <Ring
        name="margin"
        sides={pick(fields, 'margin')}
        shared={shared}
        className="border border-dashed border-border"
      >
        <Ring
          name="padding"
          sides={pick(fields, 'padding')}
          shared={shared}
          className="border border-line bg-field"
        >
          <span aria-hidden className="h-[22px] rounded border border-line bg-card-solid" />
        </Ring>
      </Ring>
    </div>
  );
}
