// A single property field in the Inspector panel (SPEC-04.1 section 11.2, 11.3, R-IN-01 to R-IN-05).
import {
  type Breakpoint,
  type DesignNode,
  type DesignTokens,
  effectiveStyleValue,
  type Frame,
  type InteractionState,
  type NodeRecord,
  type OperationOf,
  type ResponsiveMode,
  type Spacing,
  type StyleScope,
} from '@reactcraft/model';
import { ArrowLeftRight } from 'lucide-react';
import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { useEditorStore } from '../../store/editor-store.ts';
import { FieldControl, FieldOverridePopover } from './field-controls.tsx';
import type { FieldDescriptor, PaddingEdge } from './field-descriptors.ts';
import { buildClearOverride, buildSetPaddingEdge, buildSetStyleProperty } from './style-edit.ts';

type StyleFieldProps = {
  readonly descriptor: FieldDescriptor;
  readonly node: DesignNode | NodeRecord;
  readonly breakpoint: Breakpoint;
  readonly state: InteractionState | undefined;
  readonly scope: StyleScope;
  readonly frame: Frame;
  readonly primaryFrame: Frame;
  readonly responsiveMode: ResponsiveMode;
  readonly tokens: DesignTokens | undefined;
  readonly pageId: string;
  readonly onDispatch: (
    op: OperationOf<'setStyle'>,
    meta: { source: 'user'; label: string },
  ) => void;
};

function resolveNumeric(val: unknown, tokens?: DesignTokens): number | undefined {
  if (typeof val === 'number') return val;
  if (val instanceof Object && 'px' in val) {
    return (val as { px: number }).px;
  }
  if (typeof val === 'string' && val.startsWith('token:spacing.')) {
    const name = val.slice('token:spacing.'.length);
    return tokens?.spacing[name]?.value.px;
  }
  return undefined;
}

function extractCurrentValue(
  node: DesignNode | NodeRecord,
  descriptor: FieldDescriptor,
  frame: Frame,
  mode: ResponsiveMode,
  state: InteractionState | undefined,
): { value: unknown; from: Breakpoint | undefined } {
  if (state !== undefined) {
    const stateStyle = node.states?.[state];
    if (stateStyle !== undefined && descriptor.property in stateStyle) {
      const val = (stateStyle as Record<string, unknown>)[descriptor.property];
      if (val !== undefined) return { value: val, from: 'base' };
    }
  }
  const effective = effectiveStyleValue(node, descriptor.property, frame.width, mode);
  if (descriptor.kind === 'spacing-edge' && descriptor.edge !== undefined) {
    const sides = effective.value as Record<PaddingEdge, unknown> | undefined;
    return { value: sides?.[descriptor.edge], from: effective.from };
  }
  return { value: effective.value, from: effective.from };
}

function extractBaseValue(
  node: DesignNode | NodeRecord,
  descriptor: FieldDescriptor,
  tokens?: DesignTokens,
): string {
  const baseStyle = node.style;
  if (descriptor.kind === 'spacing-edge' && descriptor.edge !== undefined) {
    const raw = baseStyle?.padding?.[descriptor.edge];
    const num = resolveNumeric(raw, tokens);
    return num !== undefined ? String(num) : '';
  }
  const raw = baseStyle?.[descriptor.property];
  const num = resolveNumeric(raw, tokens);
  return num !== undefined ? String(num) : typeof raw === 'string' ? raw : '';
}

/** Scrubbable label for numeric and spacing fields (R-IN-04). */
function FieldLabel({
  descriptor,
  numVal,
  onScrub,
}: {
  readonly descriptor: FieldDescriptor;
  readonly numVal: number | undefined;
  readonly onScrub: (val: number) => void;
}) {
  const { t } = useTranslation();
  const isDraggingRef = useRef(false);
  const startXRef = useRef(0);
  const startValRef = useRef(0);

  const onPointerDown = (e: React.PointerEvent<HTMLLabelElement>) => {
    if (e.button !== 0 || descriptor.kind === 'enum') return;
    e.currentTarget.setPointerCapture(e.pointerId);
    isDraggingRef.current = true;
    startXRef.current = e.clientX;
    startValRef.current = numVal ?? 0;
  };

  const onPointerMove = (e: React.PointerEvent<HTMLLabelElement>) => {
    if (!isDraggingRef.current) return;
    const dx = e.clientX - startXRef.current;
    const nextVal =
      descriptor.kind === 'number'
        ? Math.max(0, Math.min(100, Math.round((startValRef.current + Math.round(dx / 2)) / 5) * 5))
        : Math.max(0, startValRef.current + Math.round(dx / 2));
    onScrub(nextVal);
  };

  const onPointerUp = (e: React.PointerEvent<HTMLLabelElement>) => {
    if (isDraggingRef.current) {
      isDraggingRef.current = false;
      if (e.currentTarget.hasPointerCapture(e.pointerId)) {
        e.currentTarget.releasePointerCapture(e.pointerId);
      }
    }
  };

  return (
    <label
      data-testid={`field-${descriptor.id}-label`}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      className="select-none font-medium cursor-ew-resize hover:text-ink"
    >
      {t(descriptor.labelKey)}
    </label>
  );
}

function ModeButton({
  id,
  activeMode,
  onToggle,
}: {
  readonly id: string;
  readonly activeMode: 'px' | 'token';
  readonly onToggle: () => void;
}) {
  const { t } = useTranslation();
  return (
    <button
      type="button"
      data-testid={`field-${id}-mode`}
      onClick={onToggle}
      className="rounded p-0.5 text-ink-faint hover:text-ink"
      title={activeMode === 'px' ? t('inspector.tokenMode') : t('inspector.customMode')}
    >
      <ArrowLeftRight className="h-3 w-3" />
    </button>
  );
}

function FieldHeader({
  descriptor,
  numVal,
  isInherited,
  inheritedSource,
  isOverridden,
  baseValue,
  activeMode,
  onScrub,
  onClear,
  onToggleMode,
}: {
  readonly descriptor: FieldDescriptor;
  readonly numVal: number | undefined;
  readonly isInherited: boolean;
  readonly inheritedSource: string;
  readonly isOverridden: boolean;
  readonly baseValue: string;
  readonly activeMode: 'px' | 'token';
  readonly onScrub: (val: number) => void;
  readonly onClear: () => void;
  readonly onToggleMode: () => void;
}) {
  const { t } = useTranslation();
  return (
    <div className="flex items-center justify-between text-xs text-ink-soft">
      <FieldLabel descriptor={descriptor} numVal={numVal} onScrub={onScrub} />
      <div className="flex items-center gap-1.5">
        {isInherited && (
          <span
            data-testid={`field-${descriptor.id}-inherited`}
            className="text-[11px] text-ink-faint"
          >
            {t('inspector.inherited', { source: inheritedSource })}
          </span>
        )}
        {isOverridden && (
          <FieldOverridePopover id={descriptor.id} baseValue={baseValue} onClear={onClear} />
        )}
        {descriptor.hasToken && (
          <ModeButton id={descriptor.id} activeMode={activeMode} onToggle={onToggleMode} />
        )}
      </div>
    </div>
  );
}

const checkOverridden = (
  node: DesignNode | NodeRecord,
  descriptor: FieldDescriptor,
  breakpoint: Breakpoint,
): boolean =>
  breakpoint !== 'base' &&
  (descriptor.kind === 'spacing-edge' && descriptor.edge !== undefined
    ? node.responsive?.[breakpoint]?.padding?.[descriptor.edge] !== undefined
    : node.responsive?.[breakpoint]?.[descriptor.property] !== undefined);

function useStyleFieldCommit(props: StyleFieldProps, node: DesignNode | NodeRecord) {
  const { descriptor, frame, responsiveMode, scope, pageId, onDispatch } = props;
  return (val: Spacing | number | 'row' | 'column') => {
    const op =
      descriptor.kind === 'spacing-edge' && descriptor.edge !== undefined
        ? buildSetPaddingEdge(
            node,
            descriptor.edge,
            val as Spacing,
            frame.width,
            responsiveMode,
            scope,
            pageId,
          )
        : buildSetStyleProperty(node.id, descriptor.property, val, scope, pageId);
    onDispatch(op, { source: 'user', label: `Change ${descriptor.property}` });
  };
}

function useFieldMode(rawVal: unknown): readonly ['px' | 'token', () => void] {
  const [override, setOverride] = useState<'px' | 'token'>();
  const isToken = typeof rawVal === 'string' && rawVal.startsWith('token:');
  const active = override ?? (isToken ? 'token' : 'px');
  const toggle = () => {
    setOverride(active === 'px' ? 'token' : 'px');
  };
  return [active, toggle] as const;
}

const clearOverrideAction =
  (props: StyleFieldProps, nodeId: string, property: string, breakpoint: Breakpoint) => () => {
    props.onDispatch(buildClearOverride(nodeId, property, breakpoint, props.pageId), {
      source: 'user',
      label: `Clear override ${property}`,
    });
  };

export function StyleField(props: StyleFieldProps) {
  const { descriptor, node, breakpoint, state, frame, primaryFrame, responsiveMode, tokens } =
    props;
  const flatRecord = useEditorStore((s) => s.flatNodes[node.id]);
  const isRoot = flatRecord?.parentId === undefined;
  const { value: rawVal, from } = extractCurrentValue(
    node,
    descriptor,
    frame,
    responsiveMode,
    state,
  );
  const numVal = resolveNumeric(rawVal, tokens);
  const [activeMode, toggleMode] = useFieldMode(rawVal);
  const initialDraft = numVal !== undefined ? String(numVal) : '';
  const commitValue = useStyleFieldCommit(props, node);
  const onClear = clearOverrideAction(props, node.id, descriptor.property, breakpoint);

  return (
    <div data-testid={`field-${descriptor.id}`} className="flex flex-col gap-1 py-1.5">
      <FieldHeader
        descriptor={descriptor}
        numVal={numVal}
        isInherited={from !== breakpoint && from !== undefined}
        inheritedSource={from === 'base' ? primaryFrame.label : (from ?? '')}
        isOverridden={checkOverridden(node, descriptor, breakpoint)}
        baseValue={extractBaseValue(node, descriptor, tokens)}
        activeMode={activeMode}
        onScrub={(v) => {
          commitValue(descriptor.kind === 'number' ? v : { px: v });
        }}
        onClear={onClear}
        onToggleMode={toggleMode}
      />
      <FieldControl
        key={`${node.id}-${breakpoint}-${state ?? 'normal'}-${activeMode}-${initialDraft}`}
        descriptor={descriptor}
        activeMode={activeMode}
        rawVal={rawVal}
        initialDraft={initialDraft}
        tokens={tokens}
        disabled={descriptor.id === 'direction' && isRoot}
        onCommit={commitValue}
      />
    </div>
  );
}
