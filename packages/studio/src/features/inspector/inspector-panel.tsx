// Main Inspector Panel component (SPEC-04 section 9 M-IN, R-IN-10..20).
import type {
  ClassContext,
  ClassToken,
  ClassValue,
  EditableAttr,
  ElementSource,
  PropertyId,
  Scope,
  ThemeInfo,
} from '@reactcraft/shared';
import { BREAKPOINT_WIDTHS, parseClasses } from '@reactcraft/shared';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import { errorText } from '../../routes/error-text.ts';
import { useOpenInEditor } from '../editor/use-open-in-editor.ts';
import { InspectorHeader } from './components/inspector-header.tsx';
import { OtherClassesSection } from './components/other-classes-section.tsx';
import { PropertyField } from './components/property-field.tsx';
import { TagAttributesSection } from './components/tag-attributes-section.tsx';
import { PROPERTY_GROUPS } from './property-groups-config.ts';
import type { InspectorTarget } from './types.ts';
import { useAttributeEdit } from './use-attribute-edit.ts';
import type { UseInspectorTargetOptions } from './use-inspector-target.ts';
import { useInspectorTarget } from './use-inspector-target.ts';
import { useLiveEdit } from './use-live-edit.ts';

type InspectorPanelProps = {
  readonly options?: UseInspectorTargetOptions | undefined;
  readonly theme?: ThemeInfo | undefined;
  readonly onClassStringChange?: (newString: string) => void;
};

const DEFAULT_THEME: ThemeInfo = {
  colors: [],
  fontSizes: [],
  radii: [],
  fonts: [],
  shadows: [],
  breakpoints: [],
};

function InspectorPropertyGroups({
  tokens,
  currentScope,
  frameWidth,
  ctx,
  isLocked,
  onPropertyValueChange,
}: {
  readonly tokens: readonly ClassToken[];
  readonly currentScope: Scope;
  readonly frameWidth: number;
  readonly ctx: ClassContext;
  readonly isLocked: boolean;
  readonly onPropertyValueChange: (property: PropertyId, value: ClassValue | undefined) => void;
}) {
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
              <PropertyField
                key={f.property}
                property={f.property}
                label={t(f.labelKey)}
                tokens={tokens}
                currentScope={currentScope}
                frameWidth={frameWidth}
                ctx={ctx}
                onValueChange={onPropertyValueChange}
                options={f.options}
                disabled={isLocked}
              />
            ))}
          </div>
        </div>
      ))}
    </>
  );
}

function ElementSections({
  source,
  tokens,
  currentScope,
  frameWidth,
  ctx,
  isLocked,
  isAttrLocked,
  rawClassString,
  onPropChange,
  onRawChange,
  onAttributeChange,
}: {
  readonly source: ElementSource;
  readonly tokens: readonly ClassToken[];
  readonly currentScope: Scope;
  readonly frameWidth: number;
  readonly ctx: ClassContext;
  readonly isLocked: boolean;
  readonly rawClassString: string;
  readonly onPropChange: (property: PropertyId, value: ClassValue | undefined) => void;
  readonly onRawChange: (raw: string) => void;
  readonly isAttrLocked: boolean;
  readonly onAttributeChange: (name: EditableAttr, value: string | undefined) => void;
}) {
  const { t: tError } = useTranslation('errors');
  const editor = useOpenInEditor();
  return (
    <div className="flex flex-col gap-1">
      <InspectorPropertyGroups
        tokens={tokens}
        currentScope={currentScope}
        frameWidth={frameWidth}
        ctx={ctx}
        isLocked={isLocked}
        onPropertyValueChange={onPropChange}
      />
      <TagAttributesSection
        tag={source.tag}
        attributes={source.attributes}
        disabled={isAttrLocked}
        onAttributeChange={onAttributeChange}
        onOpenInEditor={() => {
          editor.open(source.loc);
        }}
      />
      {editor.errorInfo !== undefined && (
        <p role="alert" className="text-xs text-danger">
          {errorText(tError, editor.errorInfo.code, editor.errorInfo.params)}
        </p>
      )}
      <OtherClassesSection
        tokens={tokens}
        rawClassString={rawClassString}
        onRawClassChange={onRawChange}
        disabled={isLocked}
      />
    </div>
  );
}

function InspectorSingleTargetView({
  target,
  ctx,
  frameWidth,
  onClassStringChange,
}: {
  readonly target: Extract<InspectorTarget, { readonly kind: 'element' }>;
  readonly ctx: ClassContext;
  readonly frameWidth: number;
  readonly onClassStringChange?: ((newString: string) => void) | undefined;
}) {
  const liveEdit = useLiveEdit({ target, ctx });
  const tokens = parseClasses(liveEdit.classString, ctx);
  const attrEdit = useAttributeEdit(target);
  const isLocked = target.lockReason !== undefined || target.source?.readonly !== undefined;
  // Class locks (classExpression, classDuplicate) do not block tag attributes (R-IN-18).
  const isAttrLocked =
    target.source?.readonly !== undefined ||
    target.lockReason === 'outsideSource' ||
    target.lockReason === 'tooLarge' ||
    attrEdit.isSaving;
  const displayedError = liveEdit.error ?? attrEdit.error ?? target.error;

  return (
    <div className="flex flex-col gap-2" data-testid="inspector-panel">
      <InspectorHeader target={target} />
      {target.loading && (
        <div
          data-testid="inspector-loading"
          className="py-2 text-center text-xs text-ink-faint animate-pulse"
        >
          …
        </div>
      )}
      {displayedError && (
        <div data-testid="inspector-error" className="py-2 text-xs text-red-500 font-medium">
          {displayedError}
        </div>
      )}
      {target.source && (
        <ElementSections
          source={target.source}
          tokens={tokens}
          currentScope={target.currentScope}
          frameWidth={frameWidth}
          ctx={ctx}
          isLocked={isLocked}
          isAttrLocked={isAttrLocked}
          onAttributeChange={attrEdit.setAttribute}
          rawClassString={liveEdit.classString}
          onPropChange={(prop, val) => {
            liveEdit.mutateProperty(prop, val);
            onClassStringChange?.(liveEdit.classString);
          }}
          onRawChange={(raw) => {
            liveEdit.mutateRawClass(raw);
            onClassStringChange?.(raw);
          }}
        />
      )}
    </div>
  );
}

export function InspectorPanel({
  options = {},
  theme = DEFAULT_THEME,
  onClassStringChange,
}: InspectorPanelProps) {
  const { t } = useTranslation();
  const target = useInspectorTarget(options);

  const ctx: ClassContext = useMemo(
    () => ({
      theme,
      mode: options.responsiveMode ?? 'desktop-first',
      breakpoints: BREAKPOINT_WIDTHS,
    }),
    [theme, options.responsiveMode],
  );

  const frameWidth = options.frame?.width ?? 1440;

  if (target.kind === 'empty') {
    return <p className="px-1 pt-2 text-xs text-ink-faint">{t('editor.selectHint')}</p>;
  }

  if (target.kind === 'multiple') {
    return (
      <div
        data-testid="selected-multiple-message"
        className="px-1 pt-2 text-xs text-ink-soft font-medium"
      >
        {t('inspector.selectedMultiple', { count: target.count })}
      </div>
    );
  }

  return (
    <InspectorSingleTargetView
      target={target}
      ctx={ctx}
      frameWidth={frameWidth}
      onClassStringChange={onClassStringChange}
    />
  );
}
