// A typed value with suggestions for open-scale properties (spec-log #123, #124): any value
// Tailwind accepts can be typed (`13`, `2.5`, `1/3`, `[13px]`), and a click shows every usual
// value to pick (a native datalist filtered them by what the field held, so it showed nothing).
// Like every Inspector field it writes as the user types (R-IN-13, R-IN-14), but only a valid
// value: `abc` or a half-typed `[13` turns the field red and writes nothing.
import type { PropertyId } from '@kumicraft/shared';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { isValidScaleValue } from '../scale-values.ts';
import { checkSpacingRhythm, prioritizeSpacingSuggestions } from '../spacing-rhythm.ts';

export type ScaleInputProps = {
  readonly property: PropertyId;
  /** The value read from the code for the active frame and state. */
  readonly value: string;
  readonly suggestions: readonly string[];
  readonly major: 3 | 4;
  readonly disabled: boolean;
  readonly mixed?: boolean | undefined;
  readonly label?: string | undefined;
  readonly title?: string | undefined;
  readonly className: string;
  /** Called with each valid value; '' removes the class. */
  readonly onInput: (raw: string) => void;
};

function SuggestionList({
  id,
  property,
  suggestions,
  current,
  highlight,
  onPick,
}: {
  readonly id: string;
  readonly property: PropertyId;
  readonly suggestions: readonly string[];
  readonly current: string;
  readonly highlight: number;
  readonly onPick: (value: string) => void;
}) {
  const { t } = useTranslation();
  const defaultLabel = t('inspector.scaleDefault');
  return (
    <ul
      id={id}
      role="listbox"
      data-testid={`suggest-${property}`}
      className="absolute top-full left-0 z-30 mt-1 max-h-52 min-w-full overflow-auto rounded-md border border-line bg-card-solid p-1 shadow-soft"
    >
      {suggestions.map((option, index) => (
        <li
          key={option}
          role="option"
          aria-selected={option === current}
          data-highlight={index === highlight}
          // mousedown, not click: the field keeps focus, so its blur does not close the list first.
          onMouseDown={(e) => {
            e.preventDefault();
            onPick(option);
          }}
          className="cursor-pointer rounded px-2 py-1 font-mono text-[11px] whitespace-nowrap text-ink hover:bg-field aria-selected:font-semibold aria-selected:text-accent data-[highlight=true]:bg-field"
        >
          {shownToken(option, defaultLabel)}
        </li>
      ))}
    </ul>
  );
}

function useSuggestKeys(
  suggestions: readonly string[],
  open: boolean,
  setOpen: (open: boolean) => void,
  pick: (value: string) => void,
) {
  const [highlight, setHighlight] = useState(-1);
  // Enter picks a suggestion only after the arrows moved to it; after typing it keeps what was
  // typed (it used to pick the highlighted old value and write it over the typed one).
  const [navigated, setNavigated] = useState(false);
  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      setOpen(true);
      setNavigated(true);
      const step = e.key === 'ArrowDown' ? 1 : -1;
      setHighlight((h) => Math.max(0, Math.min(suggestions.length - 1, h + step)));
    } else if (e.key === 'Enter') {
      const chosen = open && navigated ? suggestions[highlight] : undefined;
      if (chosen !== undefined) pick(chosen);
      setNavigated(false);
      setOpen(false);
    } else if (e.key === 'Escape') {
      setOpen(false);
    }
  };
  const reset = (index: number) => {
    setHighlight(index);
    setNavigated(false);
  };
  return { highlight, reset, onKeyDown };
}

/**
 * The bare class (`rounded`, `border`) is the scale step `DEFAULT`: shown in words ("mặc định"),
 * as the owner could not tell what DEFAULT meant, and read back from those words when typed.
 */
function shownToken(token: string, defaultLabel: string): string {
  return token === 'DEFAULT' ? defaultLabel : token;
}

function typedToken(text: string, defaultLabel: string): string {
  return text.trim().toLowerCase() === defaultLabel.toLowerCase() ? 'DEFAULT' : text;
}

/** The field's draft, list and handlers: what it shows, and what it writes. */
function useScaleField(props: ScaleInputProps) {
  const { property, value, suggestions, major, onInput } = props;
  const { t } = useTranslation();
  const defaultLabel = t('inspector.scaleDefault');
  // R-IN-20: while the field has focus it shows what the user types.
  const [draft, setDraft] = useState<string>();
  const [open, setOpen] = useState(false);
  const shown = draft ?? shownToken(value, defaultLabel);
  const write = (next: string) => {
    setDraft(next);
    const token = typedToken(next, defaultLabel);
    if (isValidScaleValue(property, token, suggestions, major)) onInput(token.trim());
  };
  const pick = (next: string) => {
    write(shownToken(next, defaultLabel));
    setOpen(false);
  };
  const snap = (next: string) => {
    setDraft(undefined);
    onInput(next);
  };
  const keys = useSuggestKeys(suggestions, open, setOpen, pick);
  const handlers = {
    onFocus: () => {
      setDraft(shownToken(value, defaultLabel));
      keys.reset(suggestions.indexOf(value));
      setOpen(suggestions.length > 0);
    },
    onClick: () => {
      setOpen(suggestions.length > 0);
    },
    onBlur: () => {
      setDraft(undefined);
      setOpen(false);
    },
    onKeyDown: keys.onKeyDown,
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => {
      keys.reset(-1);
      write(e.target.value);
    },
  };
  return {
    shown,
    open,
    valid: isValidScaleValue(property, typedToken(shown, defaultLabel), suggestions, major),
    highlight: keys.highlight,
    pick,
    snap,
    handlers,
  };
}

function SpacingOffbeatDot({
  property,
  suggested,
  title,
  onSnap,
}: {
  readonly property: PropertyId;
  readonly suggested: string;
  readonly title: string | undefined;
  readonly onSnap: (value: string) => void;
}) {
  return (
    <button
      type="button"
      data-testid={`spacing-offbeat-${property}`}
      title={title}
      aria-label={title}
      onMouseDown={(e) => {
        e.preventDefault();
      }}
      onClick={() => {
        onSnap(suggested);
      }}
      className="absolute top-1/2 right-1.5 z-10 size-2 -translate-y-1/2 rounded-full bg-amber-400 hover:bg-amber-500 cursor-pointer"
    />
  );
}

type ScaleComboBoxProps = {
  readonly props: ScaleInputProps;
  readonly field: ReturnType<typeof useScaleField>;
  readonly listId: string;
  readonly offbeatTitle: string | undefined;
  readonly hasOffbeat: boolean;
};

function ScaleComboBox({ props, field, listId, offbeatTitle, hasOffbeat }: ScaleComboBoxProps) {
  const { t } = useTranslation();
  return (
    <input
      id={`field-${props.property}`}
      data-testid={`input-${props.property}`}
      type="text"
      role="combobox"
      aria-expanded={field.open}
      aria-controls={listId}
      aria-autocomplete="list"
      autoComplete="off"
      spellCheck={false}
      aria-label={props.label}
      aria-invalid={!field.valid}
      title={
        field.valid
          ? (offbeatTitle ?? props.title)
          : t('inspector.invalidValue', { major: props.major })
      }
      disabled={props.disabled}
      value={field.shown}
      placeholder={props.mixed === true ? t('inspector.mixed') : '—'}
      {...field.handlers}
      className={`${props.className} ${hasOffbeat ? 'pr-4' : ''} aria-[invalid=true]:border-danger aria-[invalid=true]:text-danger`}
    />
  );
}

export function ScaleInput(props: ScaleInputProps) {
  const { property, disabled, mixed } = props;
  const orderedSuggestions = prioritizeSpacingSuggestions(property, props.suggestions);
  const { t } = useTranslation();
  const field = useScaleField({ ...props, suggestions: orderedSuggestions });
  const listId = `suggest-list-${property}`;
  const offbeat = field.valid && !mixed ? checkSpacingRhythm(property, field.shown) : undefined;
  const offbeatTitle =
    offbeat !== undefined ? t('inspector.offbeatHint', { value: offbeat.suggested }) : undefined;

  return (
    <span className="relative block">
      <ScaleComboBox
        props={props}
        field={field}
        listId={listId}
        offbeatTitle={offbeatTitle}
        hasOffbeat={offbeat !== undefined}
      />
      {offbeat !== undefined && !disabled && (
        <SpacingOffbeatDot
          property={property}
          suggested={offbeat.suggested}
          title={offbeatTitle}
          onSnap={field.snap}
        />
      )}
      {field.open && (
        <SuggestionList
          id={listId}
          property={property}
          suggestions={orderedSuggestions}
          current={field.shown}
          highlight={field.highlight}
          onPick={field.pick}
        />
      )}
    </span>
  );
}
