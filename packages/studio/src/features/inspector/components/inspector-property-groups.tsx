// Property groups rendering for Inspector (SPEC-04 M-IN, R-IN-10..15).
import type {
  ClassContext,
  ClassToken,
  ClassValue,
  PropertyId,
  Scope,
  ThemeInfo,
} from '@kumicraft/shared';
import { useTranslation } from 'react-i18next';

import { PROPERTY_GROUPS } from '../property-groups-config.ts';
import { ColorField } from './color-field.tsx';
import { PropertyField } from './property-field.tsx';

function resolveThemeTokens(property: PropertyId, theme: ThemeInfo): readonly string[] | undefined {
  switch (property) {
    case 'fontSize':
      return theme.fontSizes.map((t) => t.name);
    case 'borderRadius':
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

type GroupFieldRendererProps = {
  readonly field: (typeof PROPERTY_GROUPS)[number]['fields'][number];
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

export type InspectorPropertyGroupsProps = {
  readonly tokens: readonly ClassToken[];
  readonly currentScope: Scope;
  readonly frameWidth: number;
  readonly ctx: ClassContext;
  readonly isLocked: boolean;
  readonly onPropertyValueChange: (property: PropertyId, value: ClassValue | undefined) => void;
};

export function InspectorPropertyGroups({
  tokens,
  currentScope,
  frameWidth,
  ctx,
  isLocked,
  onPropertyValueChange,
}: InspectorPropertyGroupsProps) {
  const { t } = useTranslation();
  return (
    <>
      {PROPERTY_GROUPS.map((group) => (
        <div key={group.id} className="flex flex-col gap-1 py-1.5 border-t border-border/30">
          <h3 className="text-xs font-semibold text-ink-strong tracking-tight">
            {t(group.labelKey)}
          </h3>
          <div className="grid grid-cols-2 gap-x-2 gap-y-0.5">
            {group.fields.map((f) => (
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
        </div>
      ))}
    </>
  );
}
