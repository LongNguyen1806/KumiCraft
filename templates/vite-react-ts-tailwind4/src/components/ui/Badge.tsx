import type { ReactNode } from 'react';

type BadgeProps = {
  readonly children: ReactNode;
};

export function Badge({ children }: BadgeProps) {
  return (
    <span className="inline-flex items-center rounded-full bg-brand-soft px-3 py-1 text-xs font-semibold text-brand-ink">
      {children}
    </span>
  );
}
