// Property groups rendering for Inspector (SPEC-04 M-IN, R-IN-10..15).
import type {
  ClassContext,
  ClassToken,
  ClassValue,
  PropertyId,
  Scope,
  ThemeInfo,
} from '@kumicraft/shared';
import { type ReactNode, useState } from 'react';
import { useTranslation } from 'react-i18next';

import {
  groupProperties,
  hasCornerRadii,
  hasSideWidths,
  resolveBorderFields,
} from '../border-fields.ts';
import { PROPERTY_GROUPS, type PropertyFieldDef } from '../property-groups-config.ts';
import type { BatchPropEntry } from '../use-live-edit.ts';
import { ColorField } from './color-field.tsx';
import { InspectorEffectsExtra } from './inspector-effects-extra.tsx';
import { InspectorGroup } from './inspector-group.tsx';
import { PropertyField } from './property-field.tsx';
import { isBoxSide, SpacingBox } from './spacing-box.tsx';

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

export type InspectorPropertyGroupsProps = {
  readonly tokens: readonly ClassToken[];
  readonly currentScope: Scope;
  readonly frameWidth: number;
  readonly ctx: ClassContext;
  readonly isLocked: boolean;
  readonly onPropertyValueChange: (property: PropertyId, value: ClassValue | undefined) => void;
  readonly onBatchProperties?: ((entries: readonly BatchPropEntry[]) => void) | undefined;
  readonly layoutFooter?: ReactNode | undefined;
};

/** What every field of the panel gets. */
type Shared = InspectorPropertyGroupsProps;

function GroupFieldRenderer({
  field,
  shared,
}: {
  readonly field: PropertyFieldDef;
  readonly shared: Shared;
}) {
  const { t } = useTranslation();
  const common = {
    property: field.property,
    label: t(field.labelKey),
    tokens: shared.tokens,
    currentScope: shared.currentScope,
    frameWidth: shared.frameWidth,
    ctx: shared.ctx,
    onValueChange: shared.onPropertyValueChange,
    disabled: shared.isLocked,
  };

  if (isColorProperty(field.property)) {
    return <ColorField {...common} />;
  }
  return (
    <PropertyField
      {...common}
      options={resolveFieldOptions(field.property, field.options, shared.ctx.theme)}
      segments={field.segments}
    />
  );
}

type BorderToggles = ReturnType<typeof useBorderToggles>;

const TOGGLE_LINK =
  'font-medium text-accent hover:underline disabled:cursor-not-allowed disabled:text-ink-faint disabled:no-underline';

/** Borders: switch between one value for all sides or corners and one value each. */
function BorderToggleRow({ toggles }: { readonly toggles: BorderToggles }) {
  const { t } = useTranslation();
  const { showSides, showCorners, toggleSides, toggleCorners } = toggles;
  return (
    <div className="flex items-center gap-1.5 pb-0.5 text-[11px]">
      <button
        type="button"
        data-testid="toggle-border-sides"
        onClick={toggleSides}
        disabled={toggleSides === undefined}
        title={toggleSides === undefined ? t('inspector.borders.mixedSides') : undefined}
        className={TOGGLE_LINK}
      >
        {showSides ? t('inspector.borders.allSides') : t('inspector.borders.individualSides')}
      </button>
      <span className="text-ink-faint">·</span>
      <button
        type="button"
        data-testid="toggle-border-corners"
        onClick={toggleCorners}
        disabled={toggleCorners === undefined}
        title={toggleCorners === undefined ? t('inspector.borders.mixedCorners') : undefined}
        className={TOGGLE_LINK}
      >
        {showCorners ? t('inspector.borders.allCorners') : t('inspector.borders.individualCorners')}
      </button>
    </div>
  );
}

function GroupFieldsGrid({
  fields,
  shared,
}: {
  readonly fields: readonly PropertyFieldDef[];
  readonly shared: Shared;
}) {
  return (
    <div className="grid grid-cols-2 gap-x-2 gap-y-0.5">
      {fields.map((f) => (
        <GroupFieldRenderer key={f.property} field={f} shared={shared} />
      ))}
    </div>
  );
}

function countSet(tokens: readonly ClassToken[], properties: readonly PropertyId[]): number {
  const used = new Set<PropertyId>();
  for (const token of tokens) {
    if (token.property !== undefined && properties.includes(token.property)) {
      used.add(token.property);
    }
  }
  return used.size;
}

function SpacingGroupBody({
  fields,
  shared,
}: {
  readonly fields: (typeof PROPERTY_GROUPS)[number]['fields'];
  readonly shared: Shared;
}) {
  const boxShared = {
    tokens: shared.tokens,
    currentScope: shared.currentScope,
    frameWidth: shared.frameWidth,
    ctx: shared.ctx,
    onValueChange: shared.onPropertyValueChange,
    disabled: shared.isLocked,
  };
  return (
    <>
      <GroupFieldsGrid fields={fields.filter((f) => !isBoxSide(f.property))} shared={shared} />
      <SpacingBox fields={fields} shared={boxShared} />
    </>
  );
}

function EffectsGroupBody({
  fields,
  shared,
}: {
  readonly fields: (typeof PROPERTY_GROUPS)[number]['fields'];
  readonly shared: Shared;
}) {
  return (
    <>
      <GroupFieldsGrid fields={fields} shared={shared} />
      <InspectorEffectsExtra
        editable={true}
        disabled={shared.isLocked}
        tokens={shared.tokens}
        currentScope={shared.currentScope}
        onPropChange={shared.onPropertyValueChange}
        onBatchProps={shared.onBatchProperties}
      />
    </>
  );
}

function LayoutGroupBody({
  fields,
  shared,
}: {
  readonly fields: (typeof PROPERTY_GROUPS)[number]['fields'];
  readonly shared: Shared;
}) {
  const { t } = useTranslation();
  return (
    <>
      <GroupFieldsGrid fields={fields} shared={shared} />
      {shared.layoutFooter !== undefined && (
        <details data-testid="free-frame-advanced" className="mt-2 border-t border-line pt-2">
          <summary className="cursor-pointer select-none text-[11px] font-medium text-ink-soft hover:text-ink">
            {t('freeFrame.advanced')}
          </summary>
          <div className="pt-1.5">{shared.layoutFooter}</div>
        </details>
      )}
    </>
  );
}

function GroupBody({
  group,
  toggles,
  shared,
}: {
  readonly group: (typeof PROPERTY_GROUPS)[number];
  readonly toggles: BorderToggles;
  readonly shared: Shared;
}) {
  if (group.id === 'borders') {
    return (
      <>
        <BorderToggleRow toggles={toggles} />
        <GroupFieldsGrid
          fields={resolveBorderFields(toggles.showSides, toggles.showCorners, group.fields)}
          shared={shared}
        />
      </>
    );
  }
  if (group.id === 'layout') return <LayoutGroupBody fields={group.fields} shared={shared} />;
  if (group.id === 'spacing') return <SpacingGroupBody fields={group.fields} shared={shared} />;
  if (group.id === 'effects') return <EffectsGroupBody fields={group.fields} shared={shared} />;
  return <GroupFieldsGrid fields={group.fields} shared={shared} />;
}

function useBorderToggles(tokens: readonly ClassToken[]) {
  const hasSides = hasSideWidths(tokens);
  const hasCorners = hasCornerRadii(tokens);
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

export function InspectorPropertyGroups(props: InspectorPropertyGroupsProps) {
  const { t } = useTranslation();
  const toggles = useBorderToggles(props.tokens);

  return (
    <>
      {PROPERTY_GROUPS.map((group) => {
        const setCount = countSet(props.tokens, groupProperties(group.id, group.fields));
        return (
          <InspectorGroup
            key={group.id}
            id={group.id}
            title={t(group.labelKey)}
            setCount={setCount}
            defaultOpen={setCount > 0}
          >
            <GroupBody group={group} toggles={toggles} shared={props} />
          </InspectorGroup>
        );
      })}
    </>
  );
}
