import type { ReactNode } from 'react';

type ChoicePillProps = {
  readonly name: string;
  readonly value: string;
  readonly checked: boolean;
  readonly onChange: () => void;
  readonly children: ReactNode;
};

/** A radio button drawn as one part of joined buttons (P5): white with a line when chosen. */
export function ChoicePill({ name, value, checked, onChange, children }: ChoicePillProps) {
  return (
    <label className="inline-flex h-7 cursor-pointer items-center gap-1.5 rounded-[5px] px-3 text-xs text-ink-soft transition-colors hover:text-ink has-checked:bg-card-solid has-checked:font-medium has-checked:text-ink has-checked:shadow-[0_0_0_1px_var(--color-line)] has-focus-visible:outline-2 has-focus-visible:outline-offset-1 has-focus-visible:outline-accent">
      <input
        type="radio"
        className="sr-only"
        name={name}
        value={value}
        checked={checked}
        onChange={onChange}
      />
      {children}
    </label>
  );
}

/** The track the joined buttons sit in. */
export const CHOICE_TRACK =
  'flex flex-wrap gap-0.5 justify-self-start rounded-md border border-line bg-field p-0.5';
