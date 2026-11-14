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
} from '@kumicraft/shared';
import { parseClasses, primarySystem, projectBreakpoints } from '@kumicraft/shared';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import { errorText } from '../../routes/error-text.ts';
import { useOpenInEditor } from '../editor/use-open-in-editor.ts';
import { FreeFramePageWarning } from '../free-frame/free-frame-page-warning.tsx';
import { FreeFrameSection } from '../free-frame/free-frame-section.tsx';
import { FreeFrameToggle } from '../free-frame/free-frame-toggle.tsx';
import { useProjectInfo } from '../project/project-store.ts';
import { useEditMode } from '../project/use-edit-mode.ts';
import { useStyleEditable } from '../project/use-style-edit.ts';
import { AttributesEditorSection } from './components/attributes-editor.tsx';
import { ElementPath } from './components/element-path.tsx';
import { InspectorHeader } from './components/inspector-header.tsx';
import { InspectorIconSection } from './components/inspector-icon-section.tsx';
import { isColorProperty, resolveFieldOptions } from './components/inspector-property-groups.tsx';
import { OtherClassesSection } from './components/other-classes-section.tsx';
import { CssStyleEditor } from './components/style-sources-section.tsx';
import { TagAttributesSection } from './components/tag-attributes-section.tsx';
import { ViewOnlyInspector } from './components/view-only-inspector.tsx';
import {
  EditablePropertySections,
  useSingleTargetLiveCallbacks,
} from './inspector-editable-sections.tsx';
import { MultiInspectorView } from './multi-inspector-view.tsx';
import type { InspectorTarget } from './types.ts';
import { useAttributeEdit } from './use-attribute-edit.ts';
import type { UseInspectorTargetOptions } from './use-inspector-target.ts';
import { useInspectorTarget } from './use-inspector-target.ts';
import { type BatchPropEntry, useLiveEdit } from './use-live-edit.ts';
import { DEFAULT_THEME } from './use-project-theme.ts';

export { isColorProperty, resolveFieldOptions };

type InspectorPanelProps = {
  readonly options?: UseInspectorTargetOptions | undefined;
  readonly theme?: ThemeInfo | undefined;
  readonly onClassStringChange?: (newString: string) => void;
};

type ElementSectionsProps = {
  readonly editable: boolean;
  readonly source: ElementSource;
  readonly tokens: readonly ClassToken[];
  readonly currentScope: Scope;
  readonly frameWidth: number;
  readonly ctx: ClassContext;
  readonly isLocked: boolean;
  readonly rawClassString: string;
  readonly onPropChange: (property: PropertyId, value: ClassValue | undefined) => void;
  readonly onBatchProps: (entries: readonly BatchPropEntry[]) => void;
  readonly onRawChange: (raw: string) => void;
  readonly isAttrLocked: boolean;
  readonly onAttributeChange: (name: EditableAttr, value: string | undefined) => void;
  readonly onRefresh: () => void;
};

function EditorAlert({
  errorInfo,
}: {
  readonly errorInfo?: ReturnType<typeof useOpenInEditor>['errorInfo'] | undefined;
}) {
  const { t: tError } = useTranslation('errors');
  if (errorInfo === undefined) return undefined;
  return (
    <p role="alert" className="text-xs text-danger">
      {errorText(tError, errorInfo.code, errorInfo.params)}
    </p>
  );
}

function TagAttributesBlock({
  source,
  disabled,
  onAttributeChange,
}: {
  readonly source: ElementSource;
  readonly disabled: boolean;
  readonly onAttributeChange: (name: EditableAttr, value: string | undefined) => void;
}) {
  const editor = useOpenInEditor();
  return (
    <>
      <TagAttributesSection
        tag={source.tag}
        attributes={source.attributes}
        disabled={disabled}
        onAttributeChange={onAttributeChange}
        onOpenInEditor={() => {
          editor.open(source.loc);
        }}
      />
      <AttributesEditorSection
        tag={source.tag}
        attributes={source.attributes}
        disabled={disabled}
        onAttributeChange={onAttributeChange}
        onOpenInEditor={() => {
          editor.open(source.loc);
        }}
      />
      <EditorAlert errorInfo={editor.errorInfo} />
    </>
  );
}

function ElementSections(props: ElementSectionsProps) {
  const {
    editable,
    source,
    tokens,
    isLocked,
    isAttrLocked,
    rawClassString,
    onPropChange,
    onRawChange,
    onAttributeChange,
    onRefresh,
  } = props;
  const callStaticRest =
    source.className.kind === 'callStatic' || source.className.kind === 'templateStatic'
      ? source.className.rest
      : undefined;

  return (
    <div className="flex flex-col">
      <InspectorIconSection
        source={source}
        disabled={isAttrLocked}
        editable={editable}
        onTextColorChange={(hex) => {
          onPropChange('textColor', { kind: 'arbitrary', css: hex });
        }}
        onRefresh={onRefresh}
      />
      {editable && <EditablePropertySections {...props} />}
      <TagAttributesBlock
        source={source}
        disabled={isAttrLocked}
        onAttributeChange={onAttributeChange}
      />
      {editable && (
        <OtherClassesSection
          tokens={tokens}
          rawClassString={rawClassString}
          onRawClassChange={onRawChange}
          disabled={isLocked}
          callStaticRest={callStaticRest}
        />
      )}
    </div>
  );
}

type InspectorSingleTargetViewProps = {
  readonly target: Extract<InspectorTarget, { readonly kind: 'element' }>;
  readonly ctx: ClassContext;
  readonly frameWidth: number;
  readonly onClassStringChange?: ((newString: string) => void) | undefined;
};

function computeTargetLocks(
  target: Extract<InspectorTarget, { readonly kind: 'element' }>,
  isSaving: boolean,
): { readonly isLocked: boolean; readonly isAttrLocked: boolean } {
  const isLocked = target.lockReason !== undefined || target.source?.readonly !== undefined;
  // Class locks (classExpression, classDuplicate) do not block tag attributes (R-IN-18).
  const isAttrLocked =
    target.source?.readonly !== undefined ||
    target.lockReason === 'outsideSource' ||
    target.lockReason === 'tooLarge' ||
    isSaving;
  return { isLocked, isAttrLocked };
}

function InspectorStatusFeedback({
  loading,
  error,
}: {
  readonly loading?: boolean | undefined;
  readonly error?: string | undefined;
}) {
  return (
    <>
      {loading && (
        <div
          data-testid="inspector-loading"
          className="animate-pulse py-2 text-center text-xs text-ink-faint"
        >
          …
        </div>
      )}
      {error && (
        <div data-testid="inspector-error" className="py-2 text-xs font-medium text-danger">
          {error}
        </div>
      )}
    </>
  );
}

function FreeFrameGroup({ source }: { readonly source: ElementSource }) {
  return (
    <>
      <FreeFramePageWarning source={source} />
      <FreeFrameToggle source={source} />
      <FreeFrameSection source={source} />
    </>
  );
}

type SingleTargetEditableBodyProps = {
  readonly target: Extract<InspectorTarget, { readonly kind: 'element' }>;
  readonly ctx: ClassContext;
  readonly frameWidth: number;
  readonly onClassStringChange?: ((newString: string) => void) | undefined;
  readonly editable: boolean;
};

function SingleTargetEditableBody({
  target,
  ctx,
  frameWidth,
  onClassStringChange,
  editable,
}: SingleTargetEditableBodyProps) {
  const liveEdit = useLiveEdit({ target, ctx });
  const tokens = parseClasses(liveEdit.classString, ctx);
  const attrEdit = useAttributeEdit(target);
  const { isLocked, isAttrLocked } = computeTargetLocks(target, attrEdit.isSaving);
  const displayedError = liveEdit.error ?? attrEdit.error ?? target.error;
  const project = useProjectInfo();
  const callbacks = useSingleTargetLiveCallbacks(liveEdit, onClassStringChange);

  return (
    <>
      <InspectorHeader target={target} />
      {!editable && <CssStyleEditor project={project} target={target} />}
      <InspectorStatusFeedback
        loading={target.loading && target.source === undefined}
        error={displayedError}
      />
      {target.source && (
        <>
          {editable && <FreeFrameGroup source={target.source} />}
          <ElementSections
            editable={editable}
            source={target.source}
            tokens={tokens}
            currentScope={target.currentScope}
            frameWidth={frameWidth}
            ctx={ctx}
            isLocked={isLocked}
            isAttrLocked={isAttrLocked}
            onAttributeChange={attrEdit.setAttribute}
            onRefresh={target.refresh}
            rawClassString={liveEdit.classString}
            {...callbacks}
          />
        </>
      )}
    </>
  );
}

function InspectorSingleTargetView({
  target,
  ctx,
  frameWidth,
  onClassStringChange,
}: InspectorSingleTargetViewProps) {
  const editable = useStyleEditable();
  const editMode = useEditMode();

  return (
    <div className="flex flex-col" data-testid="inspector-panel">
      <ElementPath />
      {editMode === 'viewOnly' ? (
        <ViewOnlyInspector target={target} />
      ) : (
        <SingleTargetEditableBody
          target={target}
          ctx={ctx}
          frameWidth={frameWidth}
          onClassStringChange={onClassStringChange}
          editable={editable}
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
  const project = useProjectInfo();
  const major: 3 | 4 = primarySystem(project?.support.styling) === 'tailwind3' ? 3 : 4;

  const ctx: ClassContext = useMemo(
    () => ({
      theme,
      mode: options.responsiveMode ?? 'desktop-first',
      // The project's own breakpoints (K9 B): a frame in `3xl` reads `3xl:` classes.
      breakpoints: Object.fromEntries(projectBreakpoints(theme).map((b) => [b.key, b.min])),
      major,
    }),
    [theme, options.responsiveMode, major],
  );

  const frameWidth = options.frame?.width ?? 1440;

  if (target.kind === 'empty') {
    return <p className="px-1 pt-2 text-xs text-ink-faint">{t('editor.selectHint')}</p>;
  }

  if (target.kind === 'multi') {
    return <MultiInspectorView target={target} ctx={ctx} frameWidth={frameWidth} />;
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
