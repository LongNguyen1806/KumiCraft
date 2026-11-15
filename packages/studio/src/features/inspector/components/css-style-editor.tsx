import type {
  ElementRef,
  ProjectInfo,
  StyleReading,
  StyleState,
  StyleSystemId,
} from '@kumicraft/shared';
import { useTranslation } from 'react-i18next';

import { useSelectionStore } from '../../selection/selection-store.ts';
import { useStyleState } from '../../style/style-reading.ts';
import {
  useStyleElementState,
  useStyleTarget,
  useStyleTargetStore,
} from '../../style/style-target-store.ts';
import { useStyleCommit } from '../../style/use-style-commit.ts';
import { useInSession } from '../screen-scope.ts';
import type { InspectorTarget } from '../types.ts';
import { InspectorEffectsExtra } from './inspector-effects-extra.tsx';
import { InspectorGroup } from './inspector-group.tsx';
import { InspectorImageSection } from './inspector-image-section.tsx';
import { InspectorMotionSection } from './inspector-motion-section.tsx';
import { canEnableSelectedState } from './inspector-scope-controls.tsx';
import { InspectorStyleUnsupportedBanner } from './inspector-style-unsupported-banner.tsx';
import { InteractionSection } from './interaction/interaction-section.tsx';
import { StyleSourcesSection } from './style-sources-section.tsx';

/** Systems whose changes the style layer writes so far (plain CSS, CSS Modules, Bootstrap 5, Sass, Less). */
const WRITABLE: readonly StyleSystemId[] = ['css', 'cssModules', 'bootstrap5', 'sass', 'less'];

type CssStyleEditorProps = {
  readonly project?: ProjectInfo | undefined;
  readonly target: Extract<InspectorTarget, { readonly kind: 'element' }>;
};

function CssExtraSections({
  source,
  reading,
  refTarget,
  commit,
  onRefresh,
}: {
  readonly source: NonNullable<CssStyleEditorProps['target']['source']>;
  readonly reading: StyleReading;
  readonly refTarget: ElementRef;
  readonly commit: (property: string, value: string, stateOverride?: StyleState) => Promise<void>;
  readonly onRefresh: () => void;
}) {
  const { t } = useTranslation();
  const disabled = source.readonly !== undefined;
  return (
    <>
      <InspectorImageSection
        tag={source.tag}
        editable={false}
        disabled={disabled}
        cssReading={reading}
        onCssCommit={(prop, val) => {
          void commit(prop, val);
        }}
      />
      <InspectorGroup id="css-effects" title={t('inspector.groups.effects')} defaultOpen={false}>
        <InspectorEffectsExtra
          editable={false}
          disabled={disabled}
          cssReading={reading}
          onCssCommit={commit}
        />
      </InspectorGroup>
      <InspectorMotionSection
        refTarget={refTarget}
        source={source}
        editable={false}
        disabled={disabled}
        cssReading={reading}
        onCssCommit={commit}
        onRefresh={onRefresh}
      />
    </>
  );
}

/** The parent class a "hover on the parent" style hangs on, when that state is on. */
function useGroupHoverSelector(
  inspected: Extract<InspectorTarget, { readonly kind: 'element' }>,
  interactionState: ReturnType<typeof useStyleElementState>,
): string | undefined {
  const selectionInfo = useSelectionStore((s) => s.selectionInfo);
  const groupRef = inspected.groupRef;
  if (interactionState !== 'groupHover' || groupRef === undefined) return undefined;
  const groupInfo = selectionInfo.find(
    (i) => i.ref.loc === groupRef.loc && i.ref.index === groupRef.index,
  );
  const firstGroupClass = groupInfo?.domClass?.trim().split(/\s+/).find(Boolean);
  return firstGroupClass === undefined ? undefined : `.${firstGroupClass}`;
}

function useCssStyleEditorController(
  elementKey: string,
  project: ProjectInfo | undefined,
  inspected: Extract<InspectorTarget, { readonly kind: 'element' }>,
) {
  const styleState = useStyleElementState(elementKey);
  const interactionState = inspected.interactionState ?? styleState;
  const selectionInfo = useSelectionStore((s) => s.selectionInfo);
  const treeNodes = useSelectionStore((s) => s.treeNodes);
  const groupSelector = useGroupHoverSelector(inspected, interactionState);
  const onlyThisScreen = useInSession(inspected.ref.loc);

  const { state, refresh } = useStyleState(true, interactionState, undefined, groupSelector);
  const ref = state?.probe.ref ?? inspected.ref;
  const target = useStyleTarget(elementKey);
  const primary = state?.reading.primary;
  const writable = primary !== undefined && WRITABLE.includes(primary);
  const canSelectState = canEnableSelectedState(
    inspected.source,
    inspected.ref,
    selectionInfo,
    treeNodes,
  );
  const { commit, error } = useStyleCommit({
    state,
    refresh,
    // Every screen unless "only this screen" is on: then a media query for the active frame.
    breakpoint: onlyThisScreen ? (inspected.frameBreakpoint ?? 'base') : 'base',
    mode: project?.responsiveMode ?? 'desktop-first',
    tag: inspected.source?.tag ?? 'div',
    target,
    interactionState,
    groupSelector,
  });
  return {
    interactionState,
    canSelectState,
    state,
    refresh,
    ref,
    target,
    writable,
    commit,
    error,
  };
}

type CssController = ReturnType<typeof useCssStyleEditorController>;

function CssStyleSources({
  c,
  reading,
  elementKey,
  inspected,
}: {
  readonly c: CssController;
  readonly reading: NonNullable<CssController['state']>['reading'];
  readonly elementKey: string;
  readonly inspected: Extract<InspectorTarget, { readonly kind: 'element' }>;
}) {
  return (
    <StyleSourcesSection
      reading={reading}
      writable={c.writable}
      canSelectState={c.canSelectState}
      elementRef={c.ref}
      interactionState={c.interactionState}
      onStateChange={(next) => {
        useStyleTargetStore.getState().setState(elementKey, next);
        inspected.setInteractionState(next);
      }}
      target={c.target}
      onTargetChange={(next) => {
        useStyleTargetStore.getState().setTarget(elementKey, next);
      }}
      onCommit={(prop, val) => {
        void c.commit(prop, val);
      }}
      error={c.error}
    />
  );
}

type CssStyleEditorBodyProps = {
  readonly elementKey: string;
  readonly project: ProjectInfo | undefined;
  readonly inspected: Extract<InspectorTarget, { readonly kind: 'element' }>;
};

function CssStyleEditorBody({ elementKey, project, inspected }: CssStyleEditorBodyProps) {
  const c = useCssStyleEditorController(elementKey, project, inspected);
  const refreshAll = () => {
    c.refresh();
    inspected.refresh();
  };
  return (
    <>
      {!c.writable && <InspectorStyleUnsupportedBanner styling={project?.support.styling} />}
      {c.state !== undefined && (
        <>
          <CssStyleSources
            c={c}
            reading={c.state.reading}
            elementKey={elementKey}
            inspected={inspected}
          />
          {inspected.source !== undefined && (
            <InteractionSection
              source={inspected.source}
              refTarget={inspected.ref}
              onDone={refreshAll}
            />
          )}
          {c.writable && inspected.source !== undefined && (
            <CssExtraSections
              source={inspected.source}
              reading={c.state.reading}
              refTarget={inspected.ref}
              commit={c.commit}
              onRefresh={refreshAll}
            />
          )}
        </>
      )}
    </>
  );
}

/** The style layer in the Inspector for projects without the Tailwind editor (M-ST). */
export function CssStyleEditor({ project, target: inspected }: CssStyleEditorProps) {
  const elementKey = `${inspected.ref.loc}#${String(inspected.ref.index)}`;
  return <CssStyleEditorBody elementKey={elementKey} project={project} inspected={inspected} />;
}
