import { useId } from 'react';

type SwitchProps = {
  readonly label: string;
  readonly help?: string;
  readonly checked: boolean;
  readonly disabled?: boolean;
  readonly onChange: (checked: boolean) => void;
};

/** An on/off setting with its label and an explanation of what it changes. */
export function Switch({ label, help, checked, disabled = false, onChange }: SwitchProps) {
  const helpId = useId();
  return (
    <div className="flex items-start gap-4 py-2.5">
      <div className="grid min-w-0 flex-1 gap-0.5">
        <span className="font-medium">{label}</span>
        {help !== undefined && (
          <span id={helpId} className="text-xs text-ink-soft">
            {help}
          </span>
        )}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        {...(help === undefined ? {} : { 'aria-describedby': helpId })}
        disabled={disabled}
        onClick={() => {
          onChange(!checked);
        }}
        className="relative mt-0.5 h-6 w-11 shrink-0 rounded-full bg-line transition-colors disabled:opacity-50 aria-checked:bg-charcoal"
      >
        <span
          className={`absolute top-0.5 left-0.5 size-5 rounded-full bg-card-solid shadow transition-transform ${
            checked ? 'translate-x-5' : ''
          }`}
        />
      </button>
    </div>
  );
}
