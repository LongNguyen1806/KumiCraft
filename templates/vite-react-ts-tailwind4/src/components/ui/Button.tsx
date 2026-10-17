import type { ReactNode } from 'react';

type ButtonProps = {
  readonly children: ReactNode;
  readonly type?: 'button' | 'submit' | 'reset';
};

export function Button({ children, type = 'button' }: ButtonProps) {
  return (
    <button
      type={type}
      className="inline-flex items-center justify-center rounded-lg bg-brand px-5 py-2.5 text-sm font-medium text-white transition hover:bg-brand-ink"
    >
      {children}
    </button>
  );
}
