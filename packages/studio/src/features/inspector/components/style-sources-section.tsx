// Style properties of the selected element in a plain CSS project: value, where it is declared,
// and editing through the style layer (SPEC-04 M-ST, R-ST-04 to R-ST-07, R-ST-09).
import {
  CSS_LONGHAND_OF,
  type ProjectInfo,
  type StyleProperty,
  type StyleReading,
  type StyleSystemId,
} from '@reactcraft/shared';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { useStyleState } from '../../style/style-reading.ts';
import {
  type StyleTarget,
  useStyleTarget,
  useStyleTargetStore,
} from '../../style/style-target-store.ts';
import { useStyleCommit } from '../../style/use-style-commit.ts';
import type { InspectorTarget } from '../types.ts';
import { InspectorStyleUnsupportedBanner } from './inspector-style-unsupported-banner.tsx';

/** The properties always listed, declared or not; any other declared one is listed too. */
const CORE_PROPERTIES = [
  'paddingTop',
  'paddingRight',
  'paddingBottom',
  'paddingLeft',
  'marginTop',
  'marginBottom',
  'width',
  'height',
  'display',
  'fontSize',
  'fontWeight',
  'textColor',
  'backgroundColor',
  'borderRadius',
];
/** Systems whose changes the style layer writes so far (K2b: plain CSS). */
const WRITABLE: readonly StyleSystemId[] = ['css'];

function SourceText({ property }: { readonly property: StyleProperty }) {
  const { t } = useTranslation();
  const source = property.source;
  if (source?.kind === 'rule') {
    return (
      <span className="font-mono">
        {source.file}:{source.line}
        {source.affects > 1 && (
          <span data-testid={`style-affects-${property.id}`} className="ml-1.5 text-amber-600">
            {t('inspector.styleSources.affects', { count: source.affects })}
          </span>
        )}
      </span>
    );
  }
  if (source?.kind === 'inline') return <span>{t('inspector.styleSources.inline')}</span>;
  if (source?.kind === 'inherited' || source === undefined) return undefined;
  return <span>{t('inspector.styleSources.external')}</span>;
}

type RowProps = {
  readonly property: StyleProperty;
  readonly writable: boolean;
  readonly onCommit: (id: string, value: string) => void;
};

function StyleRow({ property, writable, onCommit }: RowProps) {
  const [draft, setDraft] = useState<string>();
  const current = property.value?.css ?? '';
  const commit = () => {
    if (draft !== undefined && draft.trim() !== current) onCommit(property.id, draft.trim());
    setDraft(undefined);
  };
  return (
    <li
      data-testid={`style-source-${property.id}`}
      className="grid grid-cols-[7rem_1fr] items-center gap-x-2 gap-y-0.5"
    >
      <span className="truncate font-mono text-ink">
        {CSS_LONGHAND_OF[property.id] ?? property.id}
      </span>
      <input
        data-testid={`style-input-${property.id}`}
        className="rounded border border-border bg-field px-1.5 py-0.5 font-mono text-ink disabled:opacity-60"
        value={draft ?? current}
        disabled={!writable || property.source?.kind === 'inline'}
        onChange={(e) => {
          setDraft(e.target.value);
        }}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') commit();
          if (e.key === 'Escape') setDraft(undefined);
        }}
      />
      <span className="col-start-2 text-[11px] text-ink-soft">
        <SourceText property={property} />
      </span>
    </li>
  );
}

type TargetSwitchProps = {
  readonly count: number;
  readonly value: StyleTarget;
  readonly onChange: (t: StyleTarget) => void;
};

function TargetSwitch({ count, value, onChange }: TargetSwitchProps) {
  const { t } = useTranslation();
  const option = (target: StyleTarget, label: string) => (
    <label className="flex items-center gap-1">
      <input
        type="radio"
        name="style-target"
        data-testid={`style-target-${target}`}
        checked={value === target}
        onChange={() => {
          onChange(target);
        }}
      />
      {label}
    </label>
  );
  return (
    <div className="flex flex-wrap items-center gap-3 text-ink-soft">
      <span>{t('inspector.styleSources.target.label')}</span>
      {option('rule', t('inspector.styleSources.target.rule', { count }))}
      {option('element', t('inspector.styleSources.target.element'))}
    </div>
  );
}

type StyleSourcesSectionProps = {
  readonly reading: StyleReading;
  readonly writable?: boolean;
  readonly target?: StyleTarget;
  readonly onTargetChange?: (target: StyleTarget) => void;
  readonly onCommit?: (id: string, value: string) => void;
  readonly error?: string | undefined;
};

export function StyleSourcesSection({
  reading,
  writable = false,
  target = 'rule',
  onTargetChange,
  onCommit,
  error,
}: StyleSourcesSectionProps) {
  const { t } = useTranslation();
  const rows = reading.properties.filter(
    (p) =>
      CORE_PROPERTIES.includes(p.id) || (p.source !== undefined && p.source.kind !== 'inherited'),
  );
  const shared = Math.max(
    0,
    ...rows.map((p) => (p.source?.kind === 'rule' ? p.source.affects : 0)),
  );
  return (
    <section data-testid="style-sources" className="space-y-2 text-xs">
      <h3 className="font-medium text-ink">{t('inspector.styleSources.title')}</h3>
      {writable && shared > 1 && onTargetChange !== undefined && (
        <TargetSwitch count={shared} value={target} onChange={onTargetChange} />
      )}
      <ul className="space-y-1.5">
        {rows.map((p) => (
          <StyleRow
            key={p.id}
            property={p}
            writable={writable}
            onCommit={onCommit ?? (() => undefined)}
          />
        ))}
      </ul>
      {error !== undefined && (
        <p role="alert" data-testid="style-error" className="text-danger">
          {error}
        </p>
      )}
    </section>
  );
}

type CssStyleEditorProps = {
  readonly project?: ProjectInfo | undefined;
  readonly target: Extract<InspectorTarget, { readonly kind: 'element' }>;
};

/** The style layer in the Inspector for projects without the Tailwind editor (M-ST). */
export function CssStyleEditor({ project, target: inspected }: CssStyleEditorProps) {
  const { state, refresh } = useStyleState(true);
  const ref = state?.probe.ref;
  const elementKey = ref === undefined ? undefined : `${ref.loc}#${String(ref.index)}`;
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
  });

  return (
    <>
      {!writable && <InspectorStyleUnsupportedBanner styling={project?.support.styling} />}
      {state !== undefined && (
        <StyleSourcesSection
          reading={state.reading}
          writable={writable}
          target={target}
          onTargetChange={(next) => {
            if (elementKey !== undefined)
              useStyleTargetStore.getState().setTarget(elementKey, next);
          }}
          onCommit={commit}
          error={error}
        />
      )}
    </>
  );
}
