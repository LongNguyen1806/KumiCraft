// A number field with a slider and a typed value (the owner, 2026-11-18). Dragging or typing shows
// the value on the Canvas at once (`onPreview`); it is written once, when the mouse is let go,
// Enter is pressed or the field is left (`onCommit`), so one drag is one Undo step. A typed value
// that is not a number or is out of the limits turns the field red, says why, and writes nothing.
import { type KeyboardEvent, useId, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import {
  type NumberUnit,
  type NumericField,
  parseTyped,
  steppedValue,
  type TypedNumber,
} from '../numeric-fields.ts';

const UNIT_LABEL: Readonly<Record<NumberUnit, string>> = { deg: '°', '%': '%', px: 'px', ms: 'ms' };
/** Arrow presses close together are one write, after the last one. */
const ARROW_WRITE_MS = 400;

export type SliderNumberFieldProps = {
  readonly field: NumericField;
  readonly label: string;
  readonly testId: string;
  /** The value the code holds; undefined when it sets nothing. */
  readonly value: number | undefined;
  /** What the code holds when it is not a plain number (`translate-x-1/2`): shown as it is. */
  readonly raw?: string | undefined;
  readonly disabled: boolean;
  readonly onPreview?: ((value: number) => void) | undefined;
  readonly onPreviewEnd?: (() => void) | undefined;
  /** undefined takes the value off (the class goes). */
  readonly onCommit: (value: number | undefined) => void;
};

function useErrorText(field: NumericField) {
  const { t } = useTranslation();
  return (typed: TypedNumber): string | undefined => {
    if (typed.kind !== 'error') return undefined;
    const unit = UNIT_LABEL[field.unit];
    const limit = `${String(typed.limit ?? '')}${unit}`;
    return t(`inspector.number.${typed.reason}`, { unit, limit });
  };
}

/** The draft typed in the field, kept while it has focus so a re-read does not overwrite it. */
function useDraft(props: SliderNumberFieldProps) {
  const [draft, setDraft] = useState<string>();
  const [error, setError] = useState<string>();
  // The dragged value holds only while the code still holds what it held when the drag began:
  // once the written value comes back, the code's value shows again.
  const [drag, setDrag] = useState<{ readonly value: number; readonly from: number | undefined }>();
  const dragged = drag !== undefined && drag.from === props.value ? drag.value : undefined;
  const setDragged = (value: number | undefined) => {
    setDrag(value === undefined ? undefined : { value, from: props.value });
  };
  const errorText = useErrorText(props.field);
  const shown = props.value ?? dragged;
  const text =
    draft ??
    (dragged !== undefined ? String(dragged) : (props.value?.toString() ?? props.raw ?? ''));
  return { draft, setDraft, error, setError, dragged, setDragged, errorText, shown, text };
}

type Draft = ReturnType<typeof useDraft>;

type KeyContext = {
  readonly props: SliderNumberFieldProps;
  readonly s: Draft;
  readonly preview: (value: number) => void;
  readonly pending: { current: number | undefined };
  readonly arrowTimer: { current: ReturnType<typeof setTimeout> | undefined };
  readonly commitTyped: () => boolean;
  readonly commitPending: () => void;
};

/** Enter writes what was typed; up/down step by one (ten with Shift), written after the last press. */
function onFieldKey(e: KeyboardEvent<HTMLInputElement>, c: KeyContext): void {
  if (e.key === 'Enter') {
    c.commitTyped();
    return;
  }
  if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return;
  e.preventDefault();
  const from = c.s.dragged ?? c.props.value;
  const next = steppedValue(c.props.field, from, e.key === 'ArrowUp', e.shiftKey);
  c.s.setDraft(String(next));
  c.s.setError(undefined);
  c.preview(next);
  c.pending.current = next;
  clearTimeout(c.arrowTimer.current);
  c.arrowTimer.current = setTimeout(c.commitPending, ARROW_WRITE_MS);
}

/** Leaving the field writes what is pending or typed; a wrong value writes nothing. */
function onFieldBlur(c: KeyContext): void {
  clearTimeout(c.arrowTimer.current);
  const arrowed = c.pending.current !== undefined;
  c.commitPending();
  // Left with a wrong value: nothing is written, the Canvas shows the code again.
  if (!arrowed && !c.commitTyped()) {
    c.props.onPreviewEnd?.();
    c.s.setDragged(undefined);
  }
  c.s.setDraft(undefined);
  c.s.setError(undefined);
}

function NumberBox({
  id,
  props,
  s,
  h,
}: {
  readonly id: string;
  readonly props: SliderNumberFieldProps;
  readonly s: Draft;
  readonly h: ReturnType<typeof useFieldHandlers>;
}) {
  const box =
    s.error === undefined
      ? 'border-line bg-card-solid focus-within:border-accent'
      : 'border-danger bg-danger/10';
  return (
    <div
      className={`flex h-7 w-[5.25rem] shrink-0 items-center gap-0.5 rounded border px-1.5 ${box}`}
    >
      <input
        id={id}
        data-testid={`${props.testId}-input`}
        inputMode="numeric"
        autoComplete="off"
        disabled={props.disabled}
        value={s.text}
        placeholder="—"
        aria-invalid={s.error !== undefined}
        onFocus={() => {
          s.setDraft(s.text);
        }}
        onChange={(e) => {
          h.type(e.target.value);
        }}
        onKeyDown={h.keyDown}
        onBlur={h.blur}
        className="w-full min-w-0 bg-transparent text-right font-mono text-xs text-ink outline-none"
      />
      <span className="font-mono text-[11px] text-ink-faint">{UNIT_LABEL[props.field.unit]}</span>
    </div>
  );
}

/** What the slider and the typed field do: preview at once, write once at the end. */
function useFieldHandlers(props: SliderNumberFieldProps, s: Draft) {
  const { field } = props;
  const arrowTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const pending = useRef<number | undefined>(undefined);
  const commit = (value: number | undefined) => {
    pending.current = undefined;
    if (value === props.value) {
      props.onPreviewEnd?.();
      return;
    }
    props.onCommit(value);
  };
  const preview = (value: number) => {
    s.setDragged(value);
    props.onPreview?.(value);
  };
  /** Writes what was typed; false when there is nothing valid to write. */
  const commitTyped = (): boolean => {
    const typed = parseTyped(field, s.draft ?? '');
    if (s.draft === undefined || typed.kind === 'error') return false;
    commit(typed.kind === 'value' ? typed.value : undefined);
    return true;
  };
  const commitPending = () => {
    if (pending.current !== undefined) commit(pending.current);
  };
  return {
    commit,
    commitPending,
    slide: (value: number) => {
      s.setError(undefined);
      s.setDraft(undefined);
      pending.current = value;
      preview(value);
    },
    type: (text: string) => {
      s.setDraft(text);
      const typed = parseTyped(field, text);
      s.setError(s.errorText(typed));
      if (typed.kind === 'value') preview(typed.value);
    },
    keyDown: (e: KeyboardEvent<HTMLInputElement>) => {
      onFieldKey(e, { props, s, preview, pending, arrowTimer, commitTyped, commitPending });
    },
    blur: () => {
      onFieldBlur({ props, s, preview, pending, arrowTimer, commitTyped, commitPending });
    },
  };
}

function FieldHeader(props: {
  readonly id: string;
  readonly label: string;
  readonly testId: string;
  readonly canClear: boolean;
  readonly onClear: () => void;
}) {
  const { t } = useTranslation();
  return (
    <div className="flex items-baseline justify-between gap-2">
      <label htmlFor={props.id} className="text-[11px] text-ink-faint">
        {props.label}
      </label>
      {props.canClear && (
        <button
          type="button"
          data-testid={`${props.testId}-clear`}
          onClick={props.onClear}
          className="text-[11px] text-ink-faint hover:text-accent"
        >
          {t('inspector.number.clear')}
        </button>
      )}
    </div>
  );
}

export function SliderNumberField(props: SliderNumberFieldProps) {
  const { field, disabled, testId } = props;
  const id = useId();
  const s = useDraft(props);
  const h = useFieldHandlers(props, s);
  const sliderValue = Math.min(
    field.max,
    Math.max(field.min, s.dragged ?? props.value ?? field.rest),
  );
  return (
    <div className="flex flex-col gap-1" data-testid={testId}>
      <FieldHeader
        id={id}
        label={props.label}
        testId={testId}
        canClear={props.value !== undefined && !disabled}
        onClear={() => {
          h.commit(undefined);
        }}
      />
      <div className="flex items-center gap-2">
        <input
          type="range"
          data-testid={`${testId}-slider`}
          aria-label={props.label}
          disabled={disabled}
          min={field.min}
          max={field.max}
          step={1}
          value={sliderValue}
          onChange={(e) => {
            h.slide(Number(e.target.value));
          }}
          onPointerUp={h.commitPending}
          onKeyUp={(e) => {
            if (e.key.startsWith('Arrow') || e.key === 'Home' || e.key === 'End') h.commitPending();
          }}
          className={`h-4 min-w-0 flex-1 ${s.shown === undefined ? 'accent-ink-faint opacity-40' : 'accent-accent'}`}
        />
        <NumberBox id={id} props={props} s={s} h={h} />
      </div>
      {s.error !== undefined && (
        <span role="alert" data-testid={`${testId}-error`} className="text-[11px] text-danger">
          {s.error}
        </span>
      )}
    </div>
  );
}
