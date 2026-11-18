// The "Customize" group of a component use (TK-49, thiet-ke-component.md §3–§5): the knobs its
// author opened, grouped by what they do on screen, under a card naming the component.
import {
  type ComponentPropSpec,
  isValidSettablePropName,
  type SetPropValue,
} from '@kumicraft/shared';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { fetchComponentProps } from '../../../api/project-client.ts';
import { editSource } from '../../../api/source-client.ts';
import { useOpenInEditor } from '../../editor/use-open-in-editor.ts';
import { useSelectionStore } from '../../selection/selection-store.ts';
import { ComponentCard } from './component-card.tsx';
import { InspectorGroup } from './inspector-group.tsx';
import { PropControl, PropName } from './prop-controls.tsx';
import { groupSpecs } from './prop-labels.ts';

type LoadedComponentProps = {
  readonly key: string;
  readonly props: readonly ComponentPropSpec[];
  readonly resolvedLoc?: string | undefined;
  readonly resolvedTag?: string | undefined;
  readonly componentFile?: string | undefined;
  readonly packageName?: string | undefined;
};

async function loadComponentProps(
  loc: string,
  tag: string,
  parentLoc: string | undefined,
  componentName: string | undefined,
): Promise<Omit<LoadedComponentProps, 'key'>> {
  try {
    const res = await fetchComponentProps({
      loc,
      tag,
      ...(parentLoc !== undefined && componentName !== undefined
        ? { parentLoc, componentName }
        : {}),
    });
    return {
      props: res.props,
      resolvedLoc: res.loc,
      resolvedTag: res.tag,
      componentFile: res.componentFile,
      packageName: res.packageName,
    };
  } catch {
    return { props: [] };
  }
}

function useComponentPropsLoader(
  enabled: boolean,
  loc: string,
  tag: string,
  fileHash: string,
  parentLoc: string | undefined,
  componentName: string | undefined,
  reloadTick: number,
) {
  const queryKey = enabled
    ? `${loc}:${tag}:${fileHash}:${parentLoc ?? ''}:${componentName ?? ''}:${String(reloadTick)}`
    : '';
  const [loaded, setLoaded] = useState<LoadedComponentProps>({ key: '', props: [] });

  useEffect(() => {
    if (!queryKey) return undefined;
    let cancelled = false;
    const run = async () => {
      const res = await loadComponentProps(loc, tag, parentLoc, componentName);
      if (!cancelled) setLoaded({ key: queryKey, ...res });
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, [queryKey, loc, tag, parentLoc, componentName]);

  const current = loaded.key === queryKey ? loaded : undefined;
  return {
    loading: Boolean(queryKey) && current === undefined,
    specs: current?.props ?? [],
    resolvedLoc: current?.resolvedLoc ?? loc,
    resolvedTag: current?.resolvedTag ?? tag,
    componentFile: current?.componentFile,
    packageName: current?.packageName,
  };
}

function ComponentPropRow({
  spec,
  disabled,
  onSave,
  onOpenEditor,
}: {
  readonly spec: ComponentPropSpec;
  readonly disabled: boolean;
  readonly onSave: (val: SetPropValue | undefined) => void;
  readonly onOpenEditor: () => void;
}) {
  const control =
    spec.unused === true ? (
      <UnusedPropNote spec={spec} />
    ) : (
      <PropControl spec={spec} disabled={disabled} onChange={onSave} onOpenEditor={onOpenEditor} />
    );
  const inline = spec.kind === 'boolean' && !spec.readonlyExpression;
  return (
    <div
      data-testid={`prop-row-${spec.name}`}
      className={
        inline
          ? 'flex items-center justify-between gap-2'
          : 'grid grid-cols-[96px_minmax(0,1fr)] items-center gap-2'
      }
    >
      <PropName spec={spec} />
      {control}
    </div>
  );
}

/**
 * A prop the page sets but the component never shows (owner, 2026-11-18: an image picked for
 * ProductCard changed nothing): no control that does nothing, the value and why instead.
 */
function UnusedPropNote({ spec }: { readonly spec: ComponentPropSpec }) {
  const { t } = useTranslation();
  const shown = spec.readonlyExpression ? spec.expression : spec.value;
  return (
    <span className="flex min-w-0 flex-col gap-0.5" data-testid={`prop-unused-${spec.name}`}>
      {shown !== undefined && (
        <span className="truncate font-mono text-[10px] text-ink-faint" title={String(shown)}>
          {String(shown)}
        </span>
      )}
      <span className="text-[11px] leading-snug text-ink-soft">{t('componentProps.unused')}</span>
    </span>
  );
}

async function persistComponentProp(
  loc: string,
  tag: string,
  spec: ComponentPropSpec,
  value: SetPropValue | undefined,
): Promise<void> {
  await editSource({
    edit: {
      kind: 'setProp',
      loc,
      tag,
      name: spec.name,
      ...(value !== undefined ? { value } : {}),
      required: spec.required,
      // Picking a value for a knob written as code replaces that code (Undo brings it back).
      ...(spec.readonlyExpression ? { replaceExpression: true as const } : {}),
    },
  });
}

type BodyProps = {
  readonly loading: boolean;
  readonly specs: readonly ComponentPropSpec[];
  readonly fromPackage: boolean;
  readonly disabled: boolean;
  readonly onSave: (spec: ComponentPropSpec, val: SetPropValue | undefined) => void;
  readonly onOpenEditor: () => void;
};

function PropRows({
  list,
  props,
}: {
  readonly list: readonly ComponentPropSpec[];
  readonly props: BodyProps;
}) {
  return list.map((spec) => (
    <ComponentPropRow
      key={spec.name}
      spec={spec}
      disabled={props.disabled}
      onSave={(val) => {
        props.onSave(spec, val);
      }}
      onOpenEditor={props.onOpenEditor}
    />
  ));
}

function ComponentPropsBody(props: BodyProps) {
  const { t } = useTranslation();
  if (props.loading) {
    return <p className="text-[11px] text-ink-faint">{t('componentProps.loading')}</p>;
  }
  if (props.specs.length === 0) {
    return (
      <p data-testid="component-props-empty" className="text-[11px] text-ink-soft">
        {t(props.fromPackage ? 'componentProps.emptyPackage' : 'componentProps.empty')}
      </p>
    );
  }
  const { groups, advanced } = groupSpecs(props.specs);
  return (
    <div className="flex flex-col gap-3">
      {groups.map(([group, list]) => (
        <div key={group} className="flex flex-col gap-2" data-testid={`prop-group-${group}`}>
          <span className="text-[10px] font-semibold tracking-wider text-ink-faint uppercase">
            {t(`componentProps.groups.${group}`)}
          </span>
          <PropRows list={list} props={props} />
        </div>
      ))}
      {advanced.length > 0 && (
        <details data-testid="prop-group-advanced">
          <summary className="cursor-pointer text-[11px] text-ink-soft">
            {t('componentProps.advanced', { count: advanced.length })}
          </summary>
          <div className="mt-2 flex flex-col gap-2">
            <PropRows list={advanced} props={props} />
          </div>
        </details>
      )}
    </div>
  );
}

function useSaveComponentProp(loc: string, tag: string, onSaved: () => void) {
  const [saving, setSaving] = useState(false);
  const saveProp = async (spec: ComponentPropSpec, val: SetPropValue | undefined) => {
    setSaving(true);
    try {
      await persistComponentProp(loc, tag, spec, val);
      onSaved();
    } finally {
      setSaving(false);
    }
  };
  return { saving, saveProp };
}

function useBoundaryLoader(
  loc: string,
  tag: string,
  fileHash: string,
  componentName: string | undefined,
  reloadTick: number,
) {
  const selectionInfo = useSelectionStore((s) => s.selectionInfo);
  const info = selectionInfo.find((i) => i.ref.loc === loc);
  // The use the Canvas read from React: its props are read and written right there.
  const use = info?.use;
  const parentLoc = info?.ancestors?.[0]?.loc;
  const isBoundary =
    use === undefined &&
    componentName !== undefined &&
    parentLoc !== undefined &&
    parentLoc.split(':')[0] !== loc.split(':')[0];
  const isComponentTag = use !== undefined || /^[A-Z]/.test(tag) || isBoundary;
  const loader = useComponentPropsLoader(
    isComponentTag,
    use?.loc ?? loc,
    use?.tag ?? tag,
    fileHash,
    isBoundary ? parentLoc : undefined,
    isBoundary ? componentName : undefined,
    reloadTick,
  );
  return { isComponentTag, ...loader };
}

type SectionProps = {
  readonly loc: string;
  readonly tag: string;
  readonly fileHash: string;
  readonly componentName?: string | undefined;
  readonly disabled: boolean;
  readonly onSaved: () => void;
};

export function ComponentPropsSection(props: SectionProps) {
  const { loc, tag, fileHash, componentName, disabled, onSaved } = props;
  const { t } = useTranslation();
  const editor = useOpenInEditor();
  const [reloadTick, setReloadTick] = useState(0);
  const state = useBoundaryLoader(loc, tag, fileHash, componentName, reloadTick);
  const { saving, saveProp } = useSaveComponentProp(state.resolvedLoc, state.resolvedTag, () => {
    setReloadTick((n) => n + 1);
    onSaved();
  });

  if (!state.isComponentTag) return undefined;
  // A plain element (`<img>`) has no knobs: its attributes have their own sections.
  if (!/^[A-Z]/.test(state.resolvedTag)) return undefined;
  const specs = state.specs.filter((s) => isValidSettablePropName(s.name));
  const fromPackage = state.packageName !== undefined;

  return (
    <>
      <div className="-mx-3 border-b border-line px-3 py-2.5">
        <ComponentCard {...state} tag={state.resolvedTag} />
      </div>
      <InspectorGroup
        id="component-props"
        title={t(fromPackage ? 'componentProps.titlePackage' : 'componentProps.title')}
        setCount={specs.filter((s) => s.hasValue).length}
        defaultOpen={true}
        testId="component-props"
      >
        <ComponentPropsBody
          loading={state.loading}
          specs={specs}
          fromPackage={fromPackage}
          disabled={disabled || saving}
          onSave={(spec, val) => {
            void saveProp(spec, val);
          }}
          onOpenEditor={() => {
            editor.open(state.resolvedLoc);
          }}
        />
      </InspectorGroup>
    </>
  );
}
