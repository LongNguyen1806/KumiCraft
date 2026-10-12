import type { ReactNode } from 'react';

type ChoicePillProps = {
  readonly name: string;
  readonly value: string;
  readonly checked: boolean;
  readonly onChange: () => void;
  readonly children: ReactNode;
};

/** A radio button drawn as a pill: charcoal when chosen, as in the approved design. */
export function ChoicePill({ name, value, checked, onChange, children }: ChoicePillProps) {
  return (
    <label className="inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-full px-4 text-ink-soft transition-colors hover:bg-field hover:text-ink has-checked:bg-charcoal has-checked:text-on-charcoal has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-charcoal">
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
