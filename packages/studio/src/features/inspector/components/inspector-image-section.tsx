// Dedicated Inspector group for <img> elements: object-fit, object-position, aspect-ratio, border-radius (K9.7-2 TK-9).
import type {
  ClassContext,
  ClassToken,
  ClassValue,
  PropertyId,
  Scope,
  StyleReading,
} from '@kumicraft/shared';
import { useTranslation } from 'react-i18next';

import { readTwTokenStr } from './effects-helpers.ts';
import { InspectorGroup } from './inspector-group.tsx';

const OBJECT_FIT_OPTIONS = ['cover', 'contain', 'fill', 'none', 'scale-down'] as const;
const OBJECT_POSITION_OPTIONS = ['center', 'top', 'bottom', 'left', 'right'] as const;

const ASPECT_OPTIONS = [
  { id: 'auto', tw: 'auto', css: 'auto', labelKey: 'auto' },
  { id: '16-9', tw: 'video', css: '16 / 9', label: '16:9' },
  { id: '4-3', tw: '[4/3]', css: '4 / 3', label: '4:3' },
  { id: '1-1', tw: 'square', css: '1 / 1', label: '1:1' },
] as const;

const RADIUS_OPTIONS = [
  { id: 'none', tw: 'none', css: '0px' },
  { id: 'sm', tw: 'sm', css: '4px' },
  { id: 'md', tw: 'md', css: '6px' },
  { id: 'lg', tw: 'lg', css: '8px' },
  { id: 'xl', tw: 'xl', css: '12px' },
  { id: 'full', tw: 'full', css: '9999px' },
] as const;

function readCssDeclared(reading: StyleReading | undefined, id: string): string {
  return reading?.properties.find((p) => p.id === id)?.value?.css ?? '';
}

function toAspectCss(value: string): string {
  const match = ASPECT_OPTIONS.find((o) => o.tw === value || o.css === value);
  return match?.css ?? '';
}

export type InspectorImageSectionProps = {
  readonly tag: string;
  readonly editable: boolean;
  readonly disabled: boolean;
  readonly tokens?: readonly ClassToken[] | undefined;
  readonly currentScope?: Scope | undefined;
  readonly ctx?: ClassContext | undefined;
  readonly onPropChange?: ((prop: PropertyId, value: ClassValue | undefined) => void) | undefined;
  readonly cssReading?: StyleReading | undefined;
  readonly onCssCommit?: ((property: string, value: string) => void) | undefined;
};

function ImageSelectField({
  testId,
  label,
  disabled,
  value,
  options,
  onChange,
}: {
  readonly testId: string;
  readonly label: string;
  readonly disabled: boolean;
  readonly value: string;
  readonly options: readonly { readonly value: string; readonly label: string }[];
  readonly onChange: (value: string) => void;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[11px] text-ink-faint">{label}</span>
      <select
        data-testid={testId}
        disabled={disabled}
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
        }}
        className="h-7 rounded-md border border-line bg-card-solid px-2 text-xs text-ink"
      >
        <option value="">—</option>
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function commitImageProp(
  prop: PropertyId,
  twVal: string,
  cssVal: string,
  editable: boolean,
  onPropChange?: (prop: PropertyId, value: ClassValue | undefined) => void,
  onCssCommit?: (property: string, value: string) => void,
): void {
  if (editable && onPropChange !== undefined) {
    if (twVal === '') onPropChange(prop, undefined);
    else if (twVal.startsWith('[') && twVal.endsWith(']'))
      onPropChange(prop, { kind: 'arbitrary', css: twVal.slice(1, -1) });
    else
      onPropChange(
        prop,
        prop === 'borderRadius'
          ? { kind: 'scale', token: twVal }
          : { kind: 'keyword', name: twVal },
      );
    return;
  }
  onCssCommit?.(prop, cssVal);
}

function ImageAspectAndRadiusFields({
  editable,
  disabled,
  readField,
  commit,
}: {
  readonly editable: boolean;
  readonly disabled: boolean;
  readonly readField: (prop: PropertyId) => string;
  readonly commit: (prop: PropertyId, twVal: string, cssVal: string) => void;
}) {
  const { t } = useTranslation();
  const aspectVal = readField('aspectRatio');
  return (
    <>
      <ImageSelectField
        testId="image-aspect-ratio"
        label={t('inspector.fields.aspectRatio')}
        disabled={disabled}
        value={editable ? aspectVal : toAspectCss(aspectVal) || aspectVal}
        options={ASPECT_OPTIONS.map((o) => ({
          value: editable ? o.tw : o.css,
          label: 'label' in o ? o.label : o.id,
        }))}
        onChange={(v) => {
          const opt = ASPECT_OPTIONS.find((o) => o.tw === v || o.css === v);
          commit('aspectRatio', opt?.tw ?? '', opt?.css ?? '');
        }}
      />
      <ImageSelectField
        testId="image-border-radius"
        label={t('inspector.fields.borderRadius')}
        disabled={disabled}
        value={readField('borderRadius')}
        options={RADIUS_OPTIONS.map((r) => ({ value: editable ? r.tw : r.css, label: r.id }))}
        onChange={(v) => {
          const match = RADIUS_OPTIONS.find((r) => r.tw === v || r.css === v);
          commit('borderRadius', match?.tw ?? v, match?.css ?? v);
        }}
      />
    </>
  );
}

function ImageFieldsGrid({
  editable,
  disabled,
  readField,
  commit,
}: {
  readonly editable: boolean;
  readonly disabled: boolean;
  readonly readField: (prop: PropertyId) => string;
  readonly commit: (prop: PropertyId, twVal: string, cssVal: string) => void;
}) {
  const { t } = useTranslation();
  return (
    <div className="grid grid-cols-2 gap-2">
      <ImageSelectField
        testId="image-object-fit"
        label={t('inspector.fields.objectFit')}
        disabled={disabled}
        value={readField('objectFit')}
        options={OBJECT_FIT_OPTIONS.map((v) => ({ value: v, label: v }))}
        onChange={(v) => {
          commit('objectFit', v, v);
        }}
      />
      <ImageSelectField
        testId="image-object-position"
        label={t('inspector.fields.objectPosition')}
        disabled={disabled}
        value={readField('objectPosition')}
        options={OBJECT_POSITION_OPTIONS.map((v) => ({ value: v, label: v }))}
        onChange={(v) => {
          commit('objectPosition', v, v);
        }}
      />
      <ImageAspectAndRadiusFields
        editable={editable}
        disabled={disabled}
        readField={readField}
        commit={commit}
      />
    </div>
  );
}

export function InspectorImageSection({
  tag,
  editable,
  disabled,
  tokens = [],
  currentScope = { breakpoint: 'base' },
  ctx,
  onPropChange,
  cssReading,
  onCssCommit,
}: InspectorImageSectionProps) {
  const { t } = useTranslation();
  if (tag.toLowerCase() !== 'img') return undefined;

  const readField = (prop: PropertyId) =>
    editable ? readTwTokenStr(tokens, currentScope, prop, ctx) : readCssDeclared(cssReading, prop);
  const commit = (prop: PropertyId, twVal: string, cssVal: string) => {
    commitImageProp(prop, twVal, cssVal, editable, onPropChange, onCssCommit);
  };

  return (
    <InspectorGroup
      id="image"
      title={t('inspector.groups.image')}
      defaultOpen
      testId="inspector-image"
    >
      <ImageFieldsGrid
        editable={editable}
        disabled={disabled}
        readField={readField}
        commit={commit}
      />
    </InspectorGroup>
  );
}
