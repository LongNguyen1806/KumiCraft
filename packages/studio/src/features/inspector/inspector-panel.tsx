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
import { parseClasses, parseLocString, primarySystem, projectBreakpoints } from '@kumicraft/shared';
import { type ReactNode, useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import { errorText } from '../../routes/error-text.ts';
import { useCanvasViewStore } from '../editor/canvas-view-store.ts';
import { useOpenInEditor } from '../editor/use-open-in-editor.ts';
import { FreeFramePageWarning, isDraftFile } from '../free-frame/free-frame-page-warning.tsx';
import { FreeFrameSection } from '../free-frame/free-frame-section.tsx';
import { FreeFrameToggle } from '../free-frame/free-frame-toggle.tsx';
import { useProjectInfo } from '../project/project-store.ts';
import { useEditMode } from '../project/use-edit-mode.ts';
import { useStyleEditable } from '../project/use-style-edit.ts';
import { A11yHintsSection } from './components/a11y-hints-section.tsx';
import { AttributesEditorSection } from './components/attributes-editor.tsx';
import { ComponentPropsSection } from './components/component-props-section.tsx';
import { DataGridSection } from './components/data-grid-section.tsx';
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
  readonly layoutFooter?: ReactNode | undefined;
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

function readCallStaticRest(source: ElementSectionsProps['source']): string | undefined {
  return source.className.kind === 'callStatic' || source.className.kind === 'templateStatic'
    ? source.className.rest
    : undefined;
}

function ElementSections(props: ElementSectionsProps) {
  const { editable, source, tokens, isLocked, isAttrLocked, rawClassString } = props;
  const { onPropChange, onRawChange, onAttributeChange, onRefresh, layoutFooter } = props;

  return (
    <div className="flex flex-col">
      <ComponentPropsSection
        loc={source.loc}
        tag={source.tag}
        fileHash={source.fileHash}
        componentName={source.component?.name}
        disabled={isAttrLocked}
        onSaved={onRefresh}
      />
      <DataGridSection dataContext={source.dataContext} onSaved={onRefresh} />
      <InspectorIconSection
        source={source}
        disabled={isAttrLocked}
        editable={editable}
        onTextColorChange={(hex) => {
          onPropChange('textColor', { kind: 'arbitrary', css: hex });
        }}
        onRefresh={onRefresh}
      />
      {editable && <EditablePropertySections {...props} layoutFooter={layoutFooter} />}
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
          callStaticRest={readCallStaticRest(source)}
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

function FreeFrameGroup({
  source,
  showToggleInline,
}: {
  readonly source: ElementSource;
  readonly showToggleInline: boolean;
}) {
  return (
    <>
      <FreeFramePageWarning source={source} />
      {showToggleInline && <FreeFrameToggle source={source} />}
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

function isDraftSource(
  source: Extract<InspectorTarget, { readonly kind: 'element' }>['source'],
  draftsDir: string,
): boolean {
  return source !== undefined && isDraftFile(parseLocString(source.loc)?.file ?? '', draftsDir);
}

type InspectorSourceBodyProps = {
  readonly target: SingleTargetEditableBodyProps['target'];
  readonly source: NonNullable<SingleTargetEditableBodyProps['target']['source']>;
  readonly ctx: SingleTargetEditableBodyProps['ctx'];
  readonly frameWidth: number;
  readonly editable: boolean;
  readonly isDraft: boolean;
  readonly isLocked: boolean;
  readonly isAttrLocked: boolean;
  readonly classString: string;
  readonly onAttributeChange: ReturnType<typeof useAttributeEdit>['setAttribute'];
  readonly callbacks: ReturnType<typeof useSingleTargetLiveCallbacks>;
};

function InspectorSourceBody({
  target,
  source,
  ctx,
  frameWidth,
  editable,
  isDraft,
  isLocked,
  isAttrLocked,
  classString,
  onAttributeChange,
  callbacks,
}: InspectorSourceBodyProps) {
  return (
    <>
      <A11yHintsSection
        target={target}
        disabled={isAttrLocked}
        onFixAltEmpty={() => {
          onAttributeChange('alt', '');
        }}
      />
      {editable && <FreeFrameGroup source={source} showToggleInline={isDraft} />}
      <ElementSections
        editable={editable}
        source={source}
        tokens={parseClasses(classString, ctx)}
        currentScope={target.currentScope}
        frameWidth={frameWidth}
        ctx={ctx}
        isLocked={isLocked}
        isAttrLocked={isAttrLocked}
        onAttributeChange={onAttributeChange}
        onRefresh={target.refresh}
        rawClassString={classString}
        layoutFooter={editable && !isDraft ? <FreeFrameToggle source={source} /> : undefined}
        {...callbacks}
      />
    </>
  );
}

function SingleTargetEditableBody({
  target,
  ctx,
  frameWidth,
  onClassStringChange,
  editable,
}: SingleTargetEditableBodyProps) {
  const project = useProjectInfo();
  const liveEdit = useLiveEdit({ target, ctx });
  const attrEdit = useAttributeEdit(target);
  const { isLocked, isAttrLocked } = computeTargetLocks(target, attrEdit.isSaving);
  const callbacks = useSingleTargetLiveCallbacks(liveEdit, onClassStringChange);
  const isDraft = isDraftSource(
    target.source,
    useCanvasViewStore((s) => s.draftsDir),
  );
  const source = target.source;

  return (
    <>
      <InspectorHeader target={target} />
      {!editable && <CssStyleEditor project={project} target={target} />}
      <InspectorStatusFeedback
        loading={target.loading && source === undefined}
        error={liveEdit.error ?? attrEdit.error ?? target.error}
      />
      {source && (
        <InspectorSourceBody
          target={target}
          source={source}
          ctx={ctx}
          frameWidth={frameWidth}
          editable={editable}
          isDraft={isDraft}
          isLocked={isLocked}
          isAttrLocked={isAttrLocked}
          classString={liveEdit.classString}
          onAttributeChange={attrEdit.setAttribute}
          callbacks={callbacks}
        />
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
