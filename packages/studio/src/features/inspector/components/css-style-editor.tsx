import type {
  ElementRef,
  ProjectInfo,
  StyleReading,
  StyleState,
  StyleSystemId,
} from '@kumicraft/shared';
import { useTranslation } from 'react-i18next';

import { useStyleState } from '../../style/style-reading.ts';
import {
  useStyleElementState,
  useStyleTarget,
  useStyleTargetStore,
} from '../../style/style-target-store.ts';
import { useStyleCommit } from '../../style/use-style-commit.ts';
import type { InspectorTarget } from '../types.ts';
import { InspectorEffectsExtra } from './inspector-effects-extra.tsx';
import { InspectorGroup } from './inspector-group.tsx';
import { InspectorImageSection } from './inspector-image-section.tsx';
import { InspectorMotionSection } from './inspector-motion-section.tsx';
import { InspectorStyleUnsupportedBanner } from './inspector-style-unsupported-banner.tsx';
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

function useCssStyleEditorController(
  elementKey: string,
  project: ProjectInfo | undefined,
  inspected: Extract<InspectorTarget, { readonly kind: 'element' }>,
) {
  const interactionState = useStyleElementState(elementKey);
  const { state, refresh } = useStyleState(true, interactionState);
  const ref = state?.probe.ref ?? inspected.ref;
  const target = useStyleTarget(elementKey);
  const primary = state?.reading.primary;
  const writable = primary !== undefined && WRITABLE.includes(primary);
  const { commit, error } = useStyleCommit({
    state,
    refresh,
    breakpoint: inspected.currentScope.breakpoint,
    mode: project?.responsiveMode ?? 'desktop-first',
    tag: inspected.source?.tag ?? 'div',
    target,
    interactionState,
  });
  return { interactionState, state, refresh, ref, target, writable, commit, error };
}

function CssStyleEditorBody({
  elementKey,
  project,
  inspected,
}: {
  readonly elementKey: string;
  readonly project: ProjectInfo | undefined;
  readonly inspected: Extract<InspectorTarget, { readonly kind: 'element' }>;
}) {
  const c = useCssStyleEditorController(elementKey, project, inspected);
  return (
    <>
      {!c.writable && <InspectorStyleUnsupportedBanner styling={project?.support.styling} />}
      {c.state !== undefined && (
        <>
          <StyleSourcesSection
            reading={c.state.reading}
            writable={c.writable}
            elementRef={c.ref}
            interactionState={c.interactionState}
            onStateChange={(next) => {
              useStyleTargetStore.getState().setState(elementKey, next);
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
          {c.writable && inspected.source !== undefined && (
            <CssExtraSections
              source={inspected.source}
              reading={c.state.reading}
              refTarget={inspected.ref}
              commit={c.commit}
              onRefresh={() => {
                c.refresh();
                inspected.refresh();
              }}
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
