const TOGGLE_TS = `import { useId, useState } from 'react';

export type ToggleProps = {
  label: string;
  defaultPressed?: boolean;
  onChange?: (pressed: boolean) => void;
  className?: string;
};

export function Toggle({ label, defaultPressed = false, onChange, className }: ToggleProps) {
  const id = useId();
  const [pressed, setPressed] = useState(defaultPressed);

  const handleToggle = () => {
    const next = !pressed;
    setPressed(next);
    onChange?.(next);
  };

  return (
    <div
      className={className}
      style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}
    >
      <label htmlFor={id} style={{ fontSize: '14px', fontWeight: 500, cursor: 'pointer' }}>
        {label}
      </label>
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={pressed}
        onClick={handleToggle}
        style={{
          width: '40px',
          height: '22px',
          borderRadius: '9999px',
          border: 'none',
          padding: '2px',
          cursor: 'pointer',
          backgroundColor: pressed ? '#2563eb' : '#d1d5db',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: pressed ? 'flex-end' : 'flex-start',
        }}
      >
        <span
          aria-hidden="true"
          style={{
            width: '18px',
            height: '18px',
            borderRadius: '9999px',
            backgroundColor: '#ffffff',
          }}
        />
      </button>
    </div>
  );
}
`;

const TOGGLE_JS = `import { useId, useState } from 'react';

export function Toggle({ label, defaultPressed = false, onChange, className }) {
  const id = useId();
  const [pressed, setPressed] = useState(defaultPressed);

  const handleToggle = () => {
    const next = !pressed;
    setPressed(next);
    onChange?.(next);
  };

  return (
    <div
      className={className}
      style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}
    >
      <label htmlFor={id} style={{ fontSize: '14px', fontWeight: 500, cursor: 'pointer' }}>
        {label}
      </label>
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={pressed}
        onClick={handleToggle}
        style={{
          width: '40px',
          height: '22px',
          borderRadius: '9999px',
          border: 'none',
          padding: '2px',
          cursor: 'pointer',
          backgroundColor: pressed ? '#2563eb' : '#d1d5db',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: pressed ? 'flex-end' : 'flex-start',
        }}
      >
        <span
          aria-hidden="true"
          style={{
            width: '18px',
            height: '18px',
            borderRadius: '9999px',
            backgroundColor: '#ffffff',
          }}
        />
      </button>
    </div>
  );
}
`;

const CHOICE_TS = `import { useId, useState } from 'react';
import type { KeyboardEvent } from 'react';

export type ChoiceProps = {
  name?: string;
  label?: string;
  options: string | readonly string[];
  defaultValue?: string;
  onChange?: (value: string) => void;
  className?: string;
};

function parseOptions(options: string | readonly string[]): string[] {
  if (typeof options === 'string') {
    return options
      .split(',')
      .map((s) => s.trim())
      .filter((s) => s.length > 0);
  }
  return [...options];
}

export function Choice({ label, options, defaultValue, onChange, className }: ChoiceProps) {
  const id = useId();
  const items = parseOptions(options);
  const [selected, setSelected] = useState(defaultValue ?? items[0] ?? '');

  const select = (value: string) => {
    setSelected(value);
    onChange?.(value);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (items.length === 0) return;
    const current = items.indexOf(selected);
    const idx = current >= 0 ? current : 0;
    if (event.key === 'ArrowRight') {
      event.preventDefault();
      select(items[(idx + 1) % items.length] ?? '');
    } else if (event.key === 'ArrowLeft') {
      event.preventDefault();
      select(items[(idx - 1 + items.length) % items.length] ?? '');
    }
  };

  return (
    <div className={className}>
      {label ? (
        <p id={id} style={{ fontSize: '13px', fontWeight: 600, margin: '0 0 8px 0' }}>
          {label}
        </p>
      ) : undefined}
      <div
        role="radiogroup"
        aria-labelledby={label ? id : undefined}
        onKeyDown={handleKeyDown}
        style={{ display: 'inline-flex', flexWrap: 'wrap', gap: '6px' }}
      >
        {items.map((opt) => {
          const active = opt === selected;
          return (
            <button
              key={opt}
              type="button"
              role="radio"
              aria-checked={active}
              tabIndex={active ? 0 : -1}
              onClick={() => select(opt)}
              style={{
                padding: '6px 14px',
                borderRadius: '6px',
                border: active ? '1px solid #2563eb' : '1px solid #d1d5db',
                backgroundColor: active ? '#2563eb' : 'transparent',
                color: active ? '#ffffff' : 'inherit',
                fontSize: '13px',
                fontWeight: active ? 600 : 500,
                cursor: 'pointer',
              }}
            >
              {opt}
            </button>
          );
        })}
      </div>
    </div>
  );
}
`;

const CHOICE_JS = `import { useId, useState } from 'react';

function parseOptions(options) {
  if (typeof options === 'string') {
    return options
      .split(',')
      .map((s) => s.trim())
      .filter((s) => s.length > 0);
  }
  return [...options];
}

export function Choice({ label, options, defaultValue, onChange, className }) {
  const id = useId();
  const items = parseOptions(options);
  const [selected, setSelected] = useState(defaultValue ?? items[0] ?? '');

  const select = (value) => {
    setSelected(value);
    onChange?.(value);
  };

  const handleKeyDown = (event) => {
    if (items.length === 0) return;
    const current = items.indexOf(selected);
    const idx = current >= 0 ? current : 0;
    if (event.key === 'ArrowRight') {
      event.preventDefault();
      select(items[(idx + 1) % items.length] ?? '');
    } else if (event.key === 'ArrowLeft') {
      event.preventDefault();
      select(items[(idx - 1 + items.length) % items.length] ?? '');
    }
  };

  return (
    <div className={className}>
      {label ? (
        <p id={id} style={{ fontSize: '13px', fontWeight: 600, margin: '0 0 8px 0' }}>
          {label}
        </p>
      ) : undefined}
      <div
        role="radiogroup"
        aria-labelledby={label ? id : undefined}
        onKeyDown={handleKeyDown}
        style={{ display: 'inline-flex', flexWrap: 'wrap', gap: '6px' }}
      >
        {items.map((opt) => {
          const active = opt === selected;
          return (
            <button
              key={opt}
              type="button"
              role="radio"
              aria-checked={active}
              tabIndex={active ? 0 : -1}
              onClick={() => select(opt)}
              style={{
                padding: '6px 14px',
                borderRadius: '6px',
                border: active ? '1px solid #2563eb' : '1px solid #d1d5db',
                backgroundColor: active ? '#2563eb' : 'transparent',
                color: active ? '#ffffff' : 'inherit',
                fontSize: '13px',
                fontWeight: active ? 600 : 500,
                cursor: 'pointer',
              }}
            >
              {opt}
            </button>
          );
        })}
      </div>
    </div>
  );
}
`;

export function buildToggleTemplate(typescript: boolean): string {
  return typescript ? TOGGLE_TS : TOGGLE_JS;
}

export function buildChoiceTemplate(typescript: boolean): string {
  return typescript ? CHOICE_TS : CHOICE_JS;
}
