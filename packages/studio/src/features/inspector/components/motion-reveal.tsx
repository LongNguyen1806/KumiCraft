// Scroll Reveal controls and shared MotionSelectField for Inspector Motion (K9.7-2 TK-18..22).
import type { ElementRef, ElementSource, RevealEffect } from '@kumicraft/shared';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { revealElement } from '../../../api/source-client.ts';
import { useSelectionStore } from '../../selection/selection-store.ts';

const REVEAL_EFFECTS: readonly RevealEffect[] = ['fade', 'slide-up', 'zoom'];
const REVEAL_DELAYS = ['0', '100', '200', '400'] as const;
const REVEAL_STAGGERS = ['0', '75', '150'] as const;

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

function RevealSelectRow(props: {
  readonly disabled: boolean;
  readonly effect: RevealEffect;
  readonly delay: number;
  readonly stagger: number;
  readonly onEffect: (val: RevealEffect) => void;
  readonly onDelay: (val: number) => void;
  readonly onStagger: (val: number) => void;
}) {
  const { t } = useTranslation();
  return (
    <div className="grid grid-cols-3 gap-1">
      <SmallSelect
        testId="motion-reveal-effect"
        ariaLabel={t('inspector.motion.revealEffect')}
        disabled={props.disabled}
        value={props.effect}
        options={REVEAL_EFFECTS.map((o) => ({ value: o, label: o }))}
        onChange={(v) => {
          if (v === 'fade' || v === 'slide-up' || v === 'zoom') props.onEffect(v);
        }}
      />
      <SmallSelect
        testId="motion-reveal-delay"
        ariaLabel={t('inspector.fields.delay')}
        disabled={props.disabled}
        value={String(props.delay)}
        options={REVEAL_DELAYS.map((ms) => ({ value: ms, label: formatMs(ms) }))}
        onChange={(v) => {
          props.onDelay(Number(v));
        }}
      />
      <SmallSelect
        testId="motion-reveal-stagger"
        ariaLabel={t('inspector.motion.revealStagger')}
        disabled={props.disabled}
        value={String(props.stagger)}
        options={REVEAL_STAGGERS.map((ms) => ({ value: ms, label: formatMs(ms) }))}
        onChange={(v) => {
          props.onStagger(Number(v));
        }}
      />
    </div>
  );
}

function useRevealState(
  refTarget: ElementRef,
  source: ElementSource,
  disabled: boolean,
  onRefresh: () => void,
) {
  const treeNodes = useSelectionStore((s) => s.treeNodes);
  const [effect, setEffect] = useState<RevealEffect>('fade');
  const [delay, setDelay] = useState(0);
  const [stagger, setStagger] = useState(0);
  const [busy, setBusy] = useState(false);

  const idx = treeNodes.findIndex(
    (n) => n.ref.loc === refTarget.loc && n.ref.index === refTarget.index,
  );
  const parentIdx = idx >= 0 ? treeNodes[idx]?.parent : undefined;
  const parentNode = parentIdx !== undefined ? treeNodes[parentIdx] : undefined;
  const isWrapped =
    source.tag === 'Reveal' ||
    parentNode?.tag === 'Reveal' ||
    parentNode?.label === 'Reveal' ||
    (parentNode?.ref.loc.includes('Reveal.') ?? false);

  const sendReveal = async (
    action: 'wrap' | 'unwrap',
    next: { effect: RevealEffect; delay: number; stagger: number },
  ) => {
    if (disabled || busy) return;
    setBusy(true);
    try {
      await revealElement({
        action,
        loc: source.loc,
        tag: source.tag,
        ...(action === 'wrap' ? next : {}),
      });
      onRefresh();
    } finally {
      setBusy(false);
    }
  };
  return { effect, setEffect, delay, setDelay, stagger, setStagger, busy, isWrapped, sendReveal };
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
  const syncIfWrapped = (next: { effect: RevealEffect; delay: number; stagger: number }) => {
    if (r.isWrapped) void r.sendReveal('wrap', next);
  };
  return (
    <div className="space-y-1.5 border-t border-line pt-2" data-testid="motion-reveal-controls">
      <RevealHeaderRow
        isWrapped={r.isWrapped}
        disabled={disabled || r.busy}
        onToggle={() => {
          void r.sendReveal(toggleAction, {
            effect: r.effect,
            delay: r.delay,
            stagger: r.stagger,
          });
        }}
      />
      <RevealSelectRow
        disabled={disabled || r.busy}
        effect={r.effect}
        delay={r.delay}
        stagger={r.stagger}
        onEffect={(v) => {
          r.setEffect(v);
          syncIfWrapped({ effect: v, delay: r.delay, stagger: r.stagger });
        }}
        onDelay={(n) => {
          r.setDelay(n);
          syncIfWrapped({ effect: r.effect, delay: n, stagger: r.stagger });
        }}
        onStagger={(n) => {
          r.setStagger(n);
          syncIfWrapped({ effect: r.effect, delay: r.delay, stagger: n });
        }}
      />
    </div>
  );
}
