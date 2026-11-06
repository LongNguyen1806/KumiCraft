// Property groups rendering for Inspector (SPEC-04 M-IN, R-IN-10..15).
import type {
  ClassContext,
  ClassToken,
  ClassValue,
  PropertyId,
  Scope,
  ThemeInfo,
} from '@kumicraft/shared';
import type { ParseKeys } from 'i18next';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { PROPERTY_GROUPS, type PropertyFieldDef } from '../property-groups-config.ts';
import { ColorField } from './color-field.tsx';
import { PropertyField } from './property-field.tsx';

function resolveThemeTokens(property: PropertyId, theme: ThemeInfo): readonly string[] | undefined {
  switch (property) {
    case 'fontSize':
      return theme.fontSizes.map((t) => t.name);
    case 'borderRadius':
    case 'borderTopLeftRadius':
    case 'borderTopRightRadius':
    case 'borderBottomRightRadius':
    case 'borderBottomLeftRadius':
      return theme.radii.map((t) => t.name);
    case 'boxShadow':
      return theme.shadows.map((t) => t.name);
    case 'fontFamily':
      return theme.fonts.map((t) => t.name);
    default:
      return undefined;
  }
}

export function resolveFieldOptions(
  property: PropertyId,
  baseOptions: readonly string[] | undefined,
  theme: ThemeInfo,
): readonly string[] | undefined {
  const themeNames = resolveThemeTokens(property, theme);
  if (themeNames === undefined) return baseOptions;
  return Array.from(new Set([...themeNames, ...(baseOptions ?? [])]));
}

export function isColorProperty(p: PropertyId): boolean {
  return p === 'textColor' || p === 'backgroundColor' || p === 'borderColor';
}

const INDIVIDUAL_SIDE_FIELDS: readonly PropertyFieldDef[] = [
  {
    property: 'borderTopWidth',
    labelKey: 'inspector.fields.borderTopWidth',
    options: ['0', '1', '2', '4', '8'],
  },
  {
    property: 'borderRightWidth',
    labelKey: 'inspector.fields.borderRightWidth',
    options: ['0', '1', '2', '4', '8'],
  },
  {
    property: 'borderBottomWidth',
    labelKey: 'inspector.fields.borderBottomWidth',
    options: ['0', '1', '2', '4', '8'],
  },
  {
    property: 'borderLeftWidth',
    labelKey: 'inspector.fields.borderLeftWidth',
    options: ['0', '1', '2', '4', '8'],
  },
  {
    property: 'borderStyle',
    labelKey: 'inspector.fields.borderStyle',
    options: ['solid', 'dashed', 'dotted', 'none'],
  },
];

const INDIVIDUAL_CORNER_FIELDS: readonly PropertyFieldDef[] = [
  {
    property: 'borderTopLeftRadius',
    labelKey: 'inspector.fields.borderTopLeftRadius',
    options: ['none', 'sm', 'DEFAULT', 'md', 'lg', 'xl', '2xl', 'full'],
  },
  {
    property: 'borderTopRightRadius',
    labelKey: 'inspector.fields.borderTopRightRadius',
    options: ['none', 'sm', 'DEFAULT', 'md', 'lg', 'xl', '2xl', 'full'],
  },
  {
    property: 'borderBottomRightRadius',
    labelKey: 'inspector.fields.borderBottomRightRadius',
    options: ['none', 'sm', 'DEFAULT', 'md', 'lg', 'xl', '2xl', 'full'],
  },
  {
    property: 'borderBottomLeftRadius',
    labelKey: 'inspector.fields.borderBottomLeftRadius',
    options: ['none', 'sm', 'DEFAULT', 'md', 'lg', 'xl', '2xl', 'full'],
  },
];

type GroupFieldRendererProps = {
  readonly field: PropertyFieldDef;
  readonly tokens: readonly ClassToken[];
  readonly currentScope: Scope;
  readonly frameWidth: number;
  readonly ctx: ClassContext;
  readonly isLocked: boolean;
  readonly onPropertyValueChange: (property: PropertyId, value: ClassValue | undefined) => void;
};

function GroupFieldRenderer(props: GroupFieldRendererProps) {
  const { field, tokens, currentScope, frameWidth, ctx, isLocked, onPropertyValueChange } = props;
  const { t } = useTranslation();

  if (isColorProperty(field.property)) {
    return (
      <ColorField
        property={field.property}
        label={t(field.labelKey)}
        tokens={tokens}
        currentScope={currentScope}
        frameWidth={frameWidth}
        ctx={ctx}
        onValueChange={onPropertyValueChange}
        disabled={isLocked}
      />
    );
  }

  const options = resolveFieldOptions(field.property, field.options, ctx.theme);
  return (
    <PropertyField
      property={field.property}
      label={t(field.labelKey)}
      tokens={tokens}
      currentScope={currentScope}
      frameWidth={frameWidth}
      ctx={ctx}
      onValueChange={onPropertyValueChange}
      options={options}
      disabled={isLocked}
    />
  );
}

function resolveBorderFields(
  showSides: boolean,
  showCorners: boolean,
  baseFields: readonly PropertyFieldDef[],
): readonly PropertyFieldDef[] {
  const widthFields = showSides
    ? INDIVIDUAL_SIDE_FIELDS
    : baseFields.filter((f) => f.property === 'borderWidth' || f.property === 'borderStyle');
  const radiusFields = showCorners
    ? INDIVIDUAL_CORNER_FIELDS
    : baseFields.filter((f) => f.property === 'borderRadius');
  return [...widthFields, ...radiusFields];
}

type BorderGroupHeaderProps = {
  readonly labelKey: ParseKeys;
  readonly showSides: boolean;
  readonly showCorners: boolean;
  readonly onToggleSides: (() => void) | undefined;
  readonly onToggleCorners: (() => void) | undefined;
};

function BorderGroupHeader({
  labelKey,
  showSides,
  showCorners,
  onToggleSides,
  onToggleCorners,
}: BorderGroupHeaderProps) {
  const { t } = useTranslation();
  return (
    <div className="flex items-center justify-between">
      <h3 className="text-xs font-semibold text-ink-strong tracking-tight">{t(labelKey)}</h3>
      <div className="flex items-center gap-1.5 text-[11px]">
        <button
          type="button"
          data-testid="toggle-border-sides"
          onClick={onToggleSides}
          disabled={onToggleSides === undefined}
          title={onToggleSides === undefined ? t('inspector.borders.mixedSides') : undefined}
          className="text-accent hover:underline font-medium disabled:cursor-not-allowed disabled:text-ink-faint disabled:no-underline"
        >
          {showSides ? t('inspector.borders.allSides') : t('inspector.borders.individualSides')}
        </button>
        <span className="text-border/60">·</span>
        <button
          type="button"
          data-testid="toggle-border-corners"
          onClick={onToggleCorners}
          disabled={onToggleCorners === undefined}
          title={onToggleCorners === undefined ? t('inspector.borders.mixedCorners') : undefined}
          className="text-accent hover:underline font-medium disabled:cursor-not-allowed disabled:text-ink-faint disabled:no-underline"
        >
          {showCorners
            ? t('inspector.borders.allCorners')
            : t('inspector.borders.individualCorners')}
        </button>
      </div>
    </div>
  );
}

type PropertyGroupItemProps = {
  readonly group: (typeof PROPERTY_GROUPS)[number];
  readonly showSides: boolean;
  readonly showCorners: boolean;
  readonly onToggleSides: (() => void) | undefined;
  readonly onToggleCorners: (() => void) | undefined;
  readonly tokens: readonly ClassToken[];
  readonly currentScope: Scope;
  readonly frameWidth: number;
  readonly ctx: ClassContext;
  readonly isLocked: boolean;
  readonly onPropertyValueChange: (property: PropertyId, value: ClassValue | undefined) => void;
};

function GroupFieldsGrid({
  fields,
  tokens,
  currentScope,
  frameWidth,
  ctx,
  isLocked,
  onPropertyValueChange,
}: {
  readonly fields: readonly PropertyFieldDef[];
  readonly tokens: readonly ClassToken[];
  readonly currentScope: Scope;
  readonly frameWidth: number;
  readonly ctx: ClassContext;
  readonly isLocked: boolean;
  readonly onPropertyValueChange: (property: PropertyId, value: ClassValue | undefined) => void;
}) {
  return (
    <div className="grid grid-cols-2 gap-x-2 gap-y-0.5">
      {fields.map((f) => (
        <GroupFieldRenderer
          key={f.property}
          field={f}
          tokens={tokens}
          currentScope={currentScope}
          frameWidth={frameWidth}
          ctx={ctx}
          isLocked={isLocked}
          onPropertyValueChange={onPropertyValueChange}
        />
      ))}
    </div>
  );
}

function PropertyGroupItem({
  group,
  showSides,
  showCorners,
  onToggleSides,
  onToggleCorners,
  tokens,
  currentScope,
  frameWidth,
  ctx,
  isLocked,
  onPropertyValueChange,
}: PropertyGroupItemProps) {
  const { t } = useTranslation();
  const fields =
    group.id === 'borders'
      ? resolveBorderFields(showSides, showCorners, group.fields)
      : group.fields;

  return (
    <div className="flex flex-col gap-1 py-1.5 border-t border-border/30">
      {group.id === 'borders' ? (
        <BorderGroupHeader
          labelKey={group.labelKey}
          showSides={showSides}
          showCorners={showCorners}
          onToggleSides={onToggleSides}
          onToggleCorners={onToggleCorners}
        />
      ) : (
        <h3 className="text-xs font-semibold text-ink-strong tracking-tight">
          {t(group.labelKey)}
        </h3>
      )}
      <GroupFieldsGrid
        fields={fields}
        tokens={tokens}
        currentScope={currentScope}
        frameWidth={frameWidth}
        ctx={ctx}
        isLocked={isLocked}
        onPropertyValueChange={onPropertyValueChange}
      />
    </div>
  );
}

export type InspectorPropertyGroupsProps = {
  readonly tokens: readonly ClassToken[];
  readonly currentScope: Scope;
  readonly frameWidth: number;
  readonly ctx: ClassContext;
  readonly isLocked: boolean;
  readonly onPropertyValueChange: (property: PropertyId, value: ClassValue | undefined) => void;
};

function useBorderToggles(tokens: readonly ClassToken[]) {
  const hasSides = tokens.some((t) =>
    ['borderTopWidth', 'borderRightWidth', 'borderBottomWidth', 'borderLeftWidth'].includes(
      t.property ?? '',
    ),
  );
  const hasCorners = tokens.some((t) =>
    [
      'borderTopLeftRadius',
      'borderTopRightRadius',
      'borderBottomRightRadius',
      'borderBottomLeftRadius',
    ].includes(t.property ?? ''),
  );
  const [individualSides, setIndividualSides] = useState(false);
  const [individualCorners, setIndividualCorners] = useState(false);
  const showSides = individualSides || hasSides;
  const showCorners = individualCorners || hasCorners;
  return {
    showSides,
    showCorners,
    toggleSides: hasSides
      ? undefined
      : () => {
          setIndividualSides(!showSides);
        },
    toggleCorners: hasCorners
      ? undefined
      : () => {
          setIndividualCorners(!showCorners);
        },
  };
}

export function InspectorPropertyGroups({
  tokens,
  currentScope,
  frameWidth,
  ctx,
  isLocked,
  onPropertyValueChange,
}: InspectorPropertyGroupsProps) {
  const { showSides, showCorners, toggleSides, toggleCorners } = useBorderToggles(tokens);

  return (
    <>
      {PROPERTY_GROUPS.map((group) => (
        <PropertyGroupItem
          key={group.id}
          group={group}
          showSides={showSides}
          showCorners={showCorners}
          onToggleSides={toggleSides}
          onToggleCorners={toggleCorners}
          tokens={tokens}
          currentScope={currentScope}
          frameWidth={frameWidth}
          ctx={ctx}
          isLocked={isLocked}
          onPropertyValueChange={onPropertyValueChange}
        />
      ))}
    </>
  );
}
