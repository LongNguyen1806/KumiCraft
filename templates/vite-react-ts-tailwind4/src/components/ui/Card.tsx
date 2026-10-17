import type { ReactNode } from 'react';

type CardProps = {
  readonly children: ReactNode;
};

export function Card({ children }: CardProps) {
  return (
    <div className="rounded-card border border-slate-200 bg-white p-6 shadow-card">
      {children}
    </div>
  );
}
