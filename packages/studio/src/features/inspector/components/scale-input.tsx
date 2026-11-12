// A typed value with suggestions for open-scale properties (spec-log #123, #124): any value
// Tailwind accepts can be typed (`13`, `2.5`, `1/3`, `[13px]`), and a click shows every usual
// value to pick (a native datalist filtered them by what the field held, so it showed nothing).
// Like every Inspector field it writes as the user types (R-IN-13, R-IN-14), but only a valid
// value: `abc` or a half-typed `[13` turns the field red and writes nothing.
import type { PropertyId } from '@kumicraft/shared';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { isValidScaleValue } from '../scale-values.ts';

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
          {option}
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

/** The field's draft, list and handlers: what it shows, and what it writes. */
function useScaleField(props: ScaleInputProps) {
  const { property, value, suggestions, major, onInput } = props;
  // R-IN-20: while the field has focus it shows what the user types.
  const [draft, setDraft] = useState<string>();
  const [open, setOpen] = useState(false);
  const shown = draft ?? value;
  const write = (next: string) => {
    setDraft(next);
    if (isValidScaleValue(property, next, suggestions, major)) onInput(next.trim());
  };
  const pick = (next: string) => {
    write(next);
    setOpen(false);
  };
  const keys = useSuggestKeys(suggestions, open, setOpen, pick);
  const handlers = {
    onFocus: () => {
      setDraft(value);
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
    valid: isValidScaleValue(property, shown, suggestions, major),
    highlight: keys.highlight,
    pick,
    handlers,
  };
}

export function ScaleInput(props: ScaleInputProps) {
  const { property, suggestions, major, disabled, mixed } = props;
  const { t } = useTranslation();
  const field = useScaleField(props);
  const listId = `suggest-list-${property}`;

  return (
    <span className="relative block">
      <input
        id={`field-${property}`}
        data-testid={`input-${property}`}
        type="text"
        role="combobox"
        aria-expanded={field.open}
        aria-controls={listId}
        aria-autocomplete="list"
        autoComplete="off"
        spellCheck={false}
        aria-label={props.label}
        aria-invalid={!field.valid}
        title={field.valid ? props.title : t('inspector.invalidValue', { major })}
        disabled={disabled}
        value={field.shown}
        placeholder={mixed === true ? t('inspector.mixed') : '—'}
        {...field.handlers}
        className={`${props.className} aria-[invalid=true]:border-danger aria-[invalid=true]:text-danger`}
      />
      {field.open && (
        <SuggestionList
          id={listId}
          property={property}
          suggestions={suggestions}
          current={field.shown}
          highlight={field.highlight}
          onPick={field.pick}
        />
      )}
    </span>
  );
}
