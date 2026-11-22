// Scroll Reveal controls and shared MotionSelectField for Inspector Motion (K9.7-2 TK-18..22).
import type { ElementRef, ElementSource, RevealEffect, TreeNode } from '@kumicraft/shared';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { fetchComponentProps } from '../../../api/project-client.ts';
import { revealElement } from '../../../api/source-client.ts';
import { useSelectionStore } from '../../../core/selection-store.ts';
import { REVEAL_FIELDS } from '../numeric-fields.ts';
import { SliderNumberField } from './slider-number-field.tsx';

const REVEAL_EFFECTS: readonly RevealEffect[] = ['fade', 'slide-up', 'zoom'];

export function formatMs(value: string): string {
  return `${value}ms`;
}

export function MotionSelectField({
  testId,
  label,
  disabled,
  value,
  options,
  onChange,
}: {
  readonly testId: string;
  readonly label: string;
  readonly disabled: boolean;
  readonly value: string;
  readonly options: readonly { readonly value: string; readonly label: string }[];
  readonly onChange: (val: string) => void;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[11px] text-ink-faint">{label}</span>
      <select
        data-testid={testId}
        disabled={disabled}
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
        }}
        className="h-7 rounded border border-line bg-card-solid px-1.5 text-xs text-ink"
      >
        <option value="">—</option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function SmallSelect({
  testId,
  ariaLabel,
  disabled,
  value,
  options,
  onChange,
}: {
  readonly testId: string;
  readonly ariaLabel: string;
  readonly disabled: boolean;
  readonly value: string;
  readonly options: readonly { readonly value: string; readonly label: string }[];
  readonly onChange: (val: string) => void;
}) {
  return (
    <select
      data-testid={testId}
      aria-label={ariaLabel}
      disabled={disabled}
      value={value}
      onChange={(e) => {
        onChange(e.target.value);
      }}
      className="h-7 rounded border border-line bg-card-solid px-1 text-[11px] text-ink"
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

type RevealValues = {
  readonly effect: RevealEffect;
  readonly delay: number;
  readonly stagger: number;
};

const isRevealEffect = (v: unknown): v is RevealEffect =>
  v === 'fade' || v === 'slide-up' || v === 'zoom';

/** The effect, then delay and stagger as a slider and a typed value (the owner, 2026-11-18). */
function RevealValueFields(props: {
  readonly disabled: boolean;
  readonly values: RevealValues;
  readonly onChange: (next: RevealValues) => void;
}) {
  const { t } = useTranslation();
  const { values, onChange } = props;
  return (
    <div className="flex flex-col gap-2">
      <SmallSelect
        testId="motion-reveal-effect"
        ariaLabel={t('inspector.motion.revealEffect')}
        disabled={props.disabled}
        value={values.effect}
        options={REVEAL_EFFECTS.map((o) => ({ value: o, label: o }))}
        onChange={(v) => {
          if (isRevealEffect(v)) onChange({ ...values, effect: v });
        }}
      />
      <SliderNumberField
        field={REVEAL_FIELDS.delay}
        label={t('inspector.fields.delay')}
        testId="motion-reveal-delay"
        disabled={props.disabled}
        value={values.delay}
        onCommit={(n) => {
          onChange({ ...values, delay: n ?? 0 });
        }}
      />
      <SliderNumberField
        field={REVEAL_FIELDS.stagger}
        label={t('inspector.motion.revealStagger')}
        testId="motion-reveal-stagger"
        disabled={props.disabled}
        value={values.stagger}
        onCommit={(n) => {
          onChange({ ...values, stagger: n ?? 0 });
        }}
      />
    </div>
  );
}

/**
 * The effect, delay and stagger the `<Reveal …>` in the code has. They were kept in the panel
 * only, so it showed fade / 0 / 0 whatever the code said.
 */
function useRevealProps(useLoc: string | undefined, version: number): RevealValues | undefined {
  const [read, setRead] = useState<{ readonly key: string; readonly values: RevealValues }>();
  const key = `${useLoc ?? ''}#${String(version)}`;
  useEffect(() => {
    if (useLoc === undefined) return undefined;
    let live = true;
    const load = async () => {
      let res: Awaited<ReturnType<typeof fetchComponentProps>>;
      try {
        res = await fetchComponentProps({ loc: useLoc, tag: 'Reveal' });
      } catch {
        return; // the panel keeps the values it shows; the next change reads again
      }
      if (!live) return;
      const prop = (name: string) => res.props.find((p) => p.name === name)?.value;
      const effect = prop('effect');
      const delay = prop('delay');
      const stagger = prop('stagger');
      setRead({
        key,
        values: {
          effect: isRevealEffect(effect) ? effect : 'fade',
          delay: typeof delay === 'number' ? delay : 0,
          stagger: typeof stagger === 'number' ? stagger : 0,
        },
      });
    };
    void load();
    return () => {
      live = false;
    };
  }, [useLoc, key]);
  return read?.key === key ? read.values : undefined;
}

/** Where the `<Reveal …>` around the element is written: the use the Canvas reported. */
function revealUseLoc(
  treeNodes: readonly TreeNode[],
  refTarget: ElementRef,
  edited: { readonly loc: string; readonly tag: string },
): string | undefined {
  if (edited.tag === 'Reveal') return edited.loc;
  const node = treeNodes.find(
    (n) => n.ref.loc === refTarget.loc && n.ref.index === refTarget.index,
  );
  const parent = node?.parent !== undefined ? treeNodes[node.parent] : undefined;
  return parent?.component?.tag === 'Reveal' ? parent.component.loc : undefined;
}

/**
 * What the Reveal switch changes: the use of the component when the selected element is the first
 * element of one (`<Reveal …>` in the page), else the element itself. A lock on the component's
 * own element (a class written as code in Reveal.tsx) does not stop the use, which is in the page.
 */
function useRevealTarget(refTarget: ElementRef, source: ElementSource, disabled: boolean) {
  const use = useSelectionStore(
    (s) =>
      s.selectionInfo.find((i) => i.ref.loc === refTarget.loc && i.ref.index === refTarget.index)
        ?.use,
  );
  return {
    edited: use ?? { loc: source.loc, tag: source.tag },
    locked: disabled && use === undefined,
  };
}

/** True when the element (or the use it stands for) is already inside a Reveal. */
function isRevealWrapped(
  treeNodes: readonly TreeNode[],
  refTarget: ElementRef,
  editedTag: string,
): boolean {
  const idx = treeNodes.findIndex(
    (n) => n.ref.loc === refTarget.loc && n.ref.index === refTarget.index,
  );
  const parentIdx = idx >= 0 ? treeNodes[idx]?.parent : undefined;
  const parentNode = parentIdx !== undefined ? treeNodes[parentIdx] : undefined;
  return (
    editedTag === 'Reveal' ||
    parentNode?.tag === 'Reveal' ||
    parentNode?.label === 'Reveal' ||
    (parentNode?.ref.loc.includes('Reveal.') ?? false)
  );
}

/** True when the selected element (or the use it stands for) shows through a Reveal. */
export function useRevealWrapped(refTarget: ElementRef, source: ElementSource): boolean {
  const treeNodes = useSelectionStore((s) => s.treeNodes);
  const { edited } = useRevealTarget(refTarget, source, false);
  return isRevealWrapped(treeNodes, refTarget, edited.tag);
}

function useRevealState(
  refTarget: ElementRef,
  source: ElementSource,
  disabled: boolean,
  onRefresh: () => void,
) {
  const treeNodes = useSelectionStore((s) => s.treeNodes);
  const { edited, locked } = useRevealTarget(refTarget, source, disabled);
  // What to use when the Reveal is turned on; once it is on, the code's values show.
  const [chosen, setChosen] = useState<RevealValues>({ effect: 'fade', delay: 0, stagger: 0 });
  const [busy, setBusy] = useState(false);
  const [version, setVersion] = useState(0);

  const isWrapped = isRevealWrapped(treeNodes, refTarget, edited.tag);
  const inCode = useRevealProps(
    isWrapped ? revealUseLoc(treeNodes, refTarget, edited) : undefined,
    version,
  );
  const values = isWrapped ? (inCode ?? chosen) : chosen;

  const sendReveal = async (action: 'wrap' | 'unwrap', next: RevealValues) => {
    if (locked || busy) return;
    setBusy(true);
    try {
      const res = await revealElement({
        action,
        loc: edited.loc,
        tag: edited.tag,
        ...(action === 'wrap' ? next : {}),
      });
      // The wrap moved the element a line down and an indent in: select it where it is now
      // (the owner's report, 2026-11-18: the selection was lost).
      if (res.loc !== undefined && res.loc !== refTarget.loc) {
        useSelectionStore.getState().setSelectedRefs([{ loc: res.loc, index: refTarget.index }]);
      }
      setChosen(next);
      setVersion((v) => v + 1);
      onRefresh();
    } finally {
      setBusy(false);
    }
  };
  return {
    values,
    setChosen,
    busy,
    isWrapped,
    locked,
    sendReveal,
  };
}

function RevealHeaderRow({
  isWrapped,
  disabled,
  onToggle,
}: {
  readonly isWrapped: boolean;
  readonly disabled: boolean;
  readonly onToggle: () => void;
}) {
  const { t } = useTranslation();
  return (
    <div className="flex items-center justify-between">
      <span className="text-[11px] font-medium text-ink-soft">
        {t('inspector.motion.revealTitle')}
      </span>
      <button
        type="button"
        data-testid="motion-reveal-toggle"
        disabled={disabled}
        onClick={onToggle}
        className={`rounded px-2 py-0.5 text-[11px] font-medium ${isWrapped ? 'bg-accent text-white' : 'border border-line bg-card-solid text-ink'}`}
      >
        {isWrapped ? t('inspector.effects.on') : t('inspector.effects.off')}
      </button>
    </div>
  );
}

export function RevealControls({
  refTarget,
  source,
  disabled,
  onRefresh,
}: {
  readonly refTarget: ElementRef;
  readonly source: ElementSource;
  readonly disabled: boolean;
  readonly onRefresh: () => void;
}) {
  const r = useRevealState(refTarget, source, disabled, onRefresh);
  const toggleAction = r.isWrapped ? 'unwrap' : 'wrap';
  const change = (next: RevealValues) => {
    if (r.isWrapped) void r.sendReveal('wrap', next);
    else r.setChosen(next);
  };
  return (
    <div className="space-y-1.5 border-t border-line pt-2" data-testid="motion-reveal-controls">
      <RevealHeaderRow
        isWrapped={r.isWrapped}
        disabled={r.locked || r.busy}
        onToggle={() => {
          void r.sendReveal(toggleAction, r.values);
        }}
      />
      <RevealValueFields disabled={r.locked || r.busy} values={r.values} onChange={change} />
    </div>
  );
}
