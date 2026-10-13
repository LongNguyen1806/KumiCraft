// Inspector panel containing scope bar, state selector and property groups (SPEC-04.1 section 11, WP-1.09 part B).
import {
  CONTAINER_TYPES,
  type DesignNode,
  type Frame,
  type InteractionState,
  type OperationOf,
  type ResponsiveMode,
} from '@reactcraft/model';
import { useTranslation } from 'react-i18next';

import { useEditorStore } from '../../store/editor-store.ts';
import { FIELD_DESCRIPTORS, type FieldDescriptor } from './field-descriptors.ts';
import { StyleField } from './style-field.tsx';
import { type InspectorScopeResult, useInspectorScope } from './use-inspector-scope.ts';

type InspectorPanelProps = {
  readonly selectedNode: DesignNode;
  readonly frame: Frame;
  readonly primaryFrame: Frame;
  readonly responsiveMode: ResponsiveMode;
};

/** State dropdown for selecting normal, hover, focus or disabled (V-28). */
function StateSelector({
  breakpoint,
  state,
  onChange,
}: {
  readonly breakpoint: string;
  readonly state: InteractionState | undefined;
  readonly onChange: (s: InteractionState | undefined) => void;
}) {
  const { t } = useTranslation();
  return (
    <div className="flex items-center justify-between gap-2">
      <label htmlFor="inspector-state-select" className="text-xs text-ink-soft">
        {t('inspector.stateLabel')}
      </label>
      <select
        id="inspector-state-select"
        data-testid="inspector-state"
        disabled={breakpoint !== 'base'}
        value={state ?? 'normal'}
        onChange={(e) => {
          const val = e.target.value;
          onChange(val === 'normal' ? undefined : (val as InteractionState));
        }}
        className="h-7 rounded border border-edge bg-field px-2 text-xs text-ink disabled:opacity-50 focus:outline-none focus:ring-1 focus:ring-accent"
      >
        <option value="normal">{t('inspector.states.normal')}</option>
        <option value="hover">{t('inspector.states.hover')}</option>
        <option value="focus">{t('inspector.states.focus')}</option>
        <option value="disabled">{t('inspector.states.disabled')}</option>
      </select>
    </div>
  );
}

type GroupProps = {
  readonly testId: string;
  readonly titleKey:
    'inspector.groups.layout' | 'inspector.groups.spacing' | 'inspector.groups.effects';
  readonly fields: readonly FieldDescriptor[];
  readonly node: DesignNode;
  readonly scopeResult: InspectorScopeResult;
  readonly frame: Frame;
  readonly primaryFrame: Frame;
  readonly responsiveMode: ResponsiveMode;
  readonly pageId: string;
  readonly onDispatch: (
    op: OperationOf<'setStyle'>,
    meta: { source: 'user'; label: string },
  ) => void;
};

function PropertyGroup(props: GroupProps) {
  const {
    testId,
    titleKey,
    fields,
    node,
    scopeResult,
    frame,
    primaryFrame,
    responsiveMode,
    pageId,
    onDispatch,
  } = props;
  const { t } = useTranslation();
  const tokens = useEditorStore((s) => s.document?.tokens);

  return (
    <div data-testid={testId} className="flex flex-col gap-1 border-t border-edge/60 pt-2">
      <h3 className="text-[11px] font-semibold uppercase tracking-wider text-ink-faint">
        {t(titleKey)}
      </h3>
      {fields.map((descriptor) => (
        <StyleField
          key={descriptor.id}
          descriptor={descriptor}
          node={node}
          breakpoint={scopeResult.breakpoint}
          state={scopeResult.state}
          scope={scopeResult.scope}
          frame={frame}
          primaryFrame={primaryFrame}
          responsiveMode={responsiveMode}
          tokens={tokens}
          pageId={pageId}
          onDispatch={onDispatch}
        />
      ))}
    </div>
  );
}

function InspectorGroups({
  commonProps,
  showLayout,
  showSpacing,
}: {
  readonly commonProps: Omit<GroupProps, 'testId' | 'titleKey' | 'fields'>;
  readonly showLayout: boolean;
  readonly showSpacing: boolean;
}) {
  return (
    <>
      {showLayout && (
        <PropertyGroup
          testId="inspector-group-layout"
          titleKey="inspector.groups.layout"
          fields={FIELD_DESCRIPTORS.filter((f) => f.group === 'layout')}
          {...commonProps}
        />
      )}
      {showSpacing && (
        <PropertyGroup
          testId="inspector-group-spacing"
          titleKey="inspector.groups.spacing"
          fields={FIELD_DESCRIPTORS.filter((f) => f.group === 'spacing')}
          {...commonProps}
        />
      )}
      <PropertyGroup
        testId="inspector-group-effects"
        titleKey="inspector.groups.effects"
        fields={FIELD_DESCRIPTORS.filter((f) => f.group === 'effects')}
        {...commonProps}
      />
    </>
  );
}

export function InspectorPanel({
  selectedNode,
  frame,
  primaryFrame,
  responsiveMode,
}: InspectorPanelProps) {
  const pageId = useEditorStore((state) => state.activePageId) ?? '';
  const node = useEditorStore((state) => state.flatNodes[selectedNode.id]) ?? selectedNode;
  const dispatch = useEditorStore((state) => state.dispatch);
  const scopeResult = useInspectorScope({ frame, primaryFrame, responsiveMode });

  const showLayout = CONTAINER_TYPES.has(selectedNode.type) && scopeResult.state === undefined;
  const showSpacing = scopeResult.state === undefined;

  const commonProps = {
    node,
    scopeResult,
    frame,
    primaryFrame,
    responsiveMode,
    pageId,
    onDispatch: (op: OperationOf<'setStyle'>, meta: { source: 'user'; label: string }) => {
      dispatch([op], meta);
    },
  };

  return (
    <div data-testid="inspector" className="flex flex-col gap-3 py-2">
      <div
        data-testid="inspector-scope"
        className="rounded border border-edge bg-field px-2.5 py-1.5 text-xs font-medium text-ink"
      >
        {scopeResult.scopeText}
      </div>
      <StateSelector
        breakpoint={scopeResult.breakpoint}
        state={scopeResult.state}
        onChange={scopeResult.setState}
      />
      <InspectorGroups
        commonProps={commonProps}
        showLayout={showLayout}
        showSpacing={showSpacing}
      />
    </div>
  );
}
