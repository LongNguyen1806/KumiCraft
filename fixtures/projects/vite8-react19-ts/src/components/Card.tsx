import type { ReactNode } from 'react';

export function Card({
  title,
  children,
}: {
  readonly title: string;
  readonly children?: ReactNode;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <h3 className="text-lg font-semibold text-slate-800">{title}</h3>
      <div className="mt-2 text-sm text-slate-600">{children}</div>
    </div>
  );
}
