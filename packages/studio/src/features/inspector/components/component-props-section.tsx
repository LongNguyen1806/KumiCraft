// Typed props editor for React components (<Button variant="..." disabled={...} />) (TK-49).
import {
  type ComponentPropSpec,
  isValidSettablePropName,
  type SetPropValue,
} from '@kumicraft/shared';
import { ExternalLink } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { fetchComponentProps } from '../../../api/project-client.ts';
import { editSource } from '../../../api/source-client.ts';
import { useOpenInEditor } from '../../editor/use-open-in-editor.ts';
import { useSelectionStore } from '../../selection/selection-store.ts';
import { InspectorGroup } from './inspector-group.tsx';

type PropControlProps = {
  readonly spec: ComponentPropSpec;
  readonly disabled: boolean;
  readonly onChange: (val: SetPropValue | undefined) => void;
  readonly onOpenEditor: () => void;
};

function PropReadonlyControl({ spec, onOpenEditor }: PropControlProps) {
  const { t } = useTranslation();
  return (
    <div className="flex items-center justify-between gap-1 text-[11px] text-ink-soft">
      <span data-testid={`prop-readonly-${spec.name}`}>{t('componentProps.editInEditor')}</span>
      <button
        type="button"
        aria-label={t('componentProps.openEditor')}
        title={t('componentProps.openEditor')}
        onClick={onOpenEditor}
        className="inline-flex items-center gap-0.5 rounded border border-line px-1.5 py-0.5 text-[10px] text-ink hover:bg-field"
      >
        <ExternalLink className="size-2.5" aria-hidden />
        <span>{t('componentProps.openEditor')}</span>
      </button>
    </div>
  );
}

function PropSelectControl({ spec, disabled, onChange }: PropControlProps) {
  const { t } = useTranslation();
  return (
    <select
      data-testid={`prop-input-${spec.name}`}
      aria-label={spec.name}
      value={typeof spec.value === 'string' ? spec.value : ''}
      disabled={disabled}
      onChange={(e) => {
        onChange(e.target.value === '' ? undefined : e.target.value);
      }}
      className="h-7 w-full rounded border border-line bg-field px-1.5 text-xs text-ink"
    >
      {!spec.required && <option value="">{t('componentProps.unset')}</option>}
      {(spec.options ?? []).map((opt) => (
        <option key={opt} value={opt}>
          {opt}
        </option>
      ))}
    </select>
  );
}

function PropPrimitiveControl({ spec, disabled, onChange }: PropControlProps) {
  if (spec.kind === 'boolean') {
    return (
      <input
        type="checkbox"
        data-testid={`prop-input-${spec.name}`}
        aria-label={spec.name}
        checked={spec.value === true}
        disabled={disabled}
        onChange={(e) => {
          onChange(e.target.checked);
        }}
      />
    );
  }
  if (spec.kind === 'number') {
    return (
      <input
        type="number"
        data-testid={`prop-input-${spec.name}`}
        aria-label={spec.name}
        value={typeof spec.value === 'number' ? String(spec.value) : ''}
        disabled={disabled}
        onChange={(e) => {
          const raw = e.target.value.trim();
          const num = Number(raw);
          if (raw === '') onChange(undefined);
          else if (Number.isFinite(num)) onChange(num);
        }}
        className="h-7 w-full rounded border border-line bg-field px-2 text-xs text-ink"
      />
    );
  }
  return (
    <input
      type="text"
      data-testid={`prop-input-${spec.name}`}
      aria-label={spec.name}
      value={typeof spec.value === 'string' ? spec.value : ''}
      disabled={disabled}
      onChange={(e) => {
        onChange(e.target.value === '' ? undefined : e.target.value);
      }}
      className="h-7 w-full rounded border border-line bg-field px-2 text-xs text-ink"
    />
  );
}

function PropControl(props: PropControlProps) {
  if (props.spec.kind === 'complex' || props.spec.readonlyExpression) {
    return <PropReadonlyControl {...props} />;
  }
  if (props.spec.kind === 'union' && props.spec.options !== undefined) {
    return <PropSelectControl {...props} />;
  }
  return <PropPrimitiveControl {...props} />;
}

type LoadedComponentProps = {
  readonly key: string;
  readonly props: readonly ComponentPropSpec[];
  readonly resolvedLoc?: string | undefined;
  readonly resolvedTag?: string | undefined;
};

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
    async function load() {
      try {
        const res = await fetchComponentProps({
          loc,
          tag,
          ...(parentLoc !== undefined && componentName !== undefined
            ? { parentLoc, componentName }
            : {}),
        });
        if (!cancelled) {
          setLoaded({
            key: queryKey,
            props: res.props,
            resolvedLoc: res.loc,
            resolvedTag: res.tag,
          });
        }
      } catch {
        if (!cancelled) setLoaded({ key: queryKey, props: [] });
      }
    }
    void load();
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
  const { t } = useTranslation();
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center justify-between text-[11px]">
        <span className="font-mono font-medium text-ink">{spec.name}</span>
        {spec.required && (
          <span className="text-[10px] text-warn">{t('componentProps.required')}</span>
        )}
      </div>
      <PropControl spec={spec} disabled={disabled} onChange={onSave} onOpenEditor={onOpenEditor} />
    </div>
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
    },
  });
}

function ComponentPropsBody({
  loading,
  editableSpecs,
  disabled,
  onSave,
  onOpenEditor,
}: {
  readonly loading: boolean;
  readonly editableSpecs: readonly ComponentPropSpec[];
  readonly disabled: boolean;
  readonly onSave: (spec: ComponentPropSpec, val: SetPropValue | undefined) => void;
  readonly onOpenEditor: () => void;
}) {
  const { t } = useTranslation();
  if (loading) return <p className="text-[11px] text-ink-faint">{t('componentProps.loading')}</p>;
  if (editableSpecs.length === 0)
    return <p className="text-[11px] text-ink-faint">{t('componentProps.empty')}</p>;
  return (
    <div className="flex flex-col gap-2">
      {editableSpecs.map((spec) => (
        <ComponentPropRow
          key={spec.name}
          spec={spec}
          disabled={disabled}
          onSave={(val) => {
            onSave(spec, val);
          }}
          onOpenEditor={onOpenEditor}
        />
      ))}
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

export function ComponentPropsSection({
  loc,
  tag,
  fileHash,
  componentName,
  disabled,
  onSaved,
}: {
  readonly loc: string;
  readonly tag: string;
  readonly fileHash: string;
  readonly componentName?: string | undefined;
  readonly disabled: boolean;
  readonly onSaved: () => void;
}) {
  const { t } = useTranslation();
  const editor = useOpenInEditor();
  const [reloadTick, setReloadTick] = useState(0);
  const state = useBoundaryLoader(loc, tag, fileHash, componentName, reloadTick);
  const { saving, saveProp } = useSaveComponentProp(state.resolvedLoc, state.resolvedTag, () => {
    setReloadTick((n) => n + 1);
    onSaved();
  });

  if (!state.isComponentTag) return undefined;
  const editableSpecs = state.specs.filter((s) => isValidSettablePropName(s.name));

  return (
    <InspectorGroup
      id="component-props"
      title={t('componentProps.title', { tag: state.resolvedTag })}
      setCount={editableSpecs.filter((s) => s.hasValue).length}
      defaultOpen={true}
      testId="component-props"
    >
      <ComponentPropsBody
        loading={state.loading}
        editableSpecs={editableSpecs}
        disabled={disabled || saving}
        onSave={(spec, val) => {
          void saveProp(spec, val);
        }}
        onOpenEditor={() => {
          editor.open(state.resolvedLoc);
        }}
      />
    </InspectorGroup>
  );
}
