import type { HTMLAttributes, ReactNode } from 'react';

interface CardPartProps extends HTMLAttributes<HTMLDivElement> {
  readonly children?: ReactNode;
}

function joinClasses(base: string, extra?: string): string {
  return extra !== undefined && extra.length > 0 ? `${base} ${extra}` : base;
}

export function Card({ className, children, ...rest }: CardPartProps) {
  return (
    <div
      className={joinClasses(
        'rounded-lg border border-slate-200 bg-white text-slate-900 shadow-sm',
        className,
      )}
      {...rest}
    >
      {children}
    </div>
  );
}

export function CardHeader({ className, children, ...rest }: CardPartProps) {
  return (
    <div className={joinClasses('flex flex-col space-y-1.5 p-6', className)} {...rest}>
      {children}
    </div>
  );
}

export function CardTitle({ className, children, ...rest }: CardPartProps) {
  return (
    <h3 className={joinClasses('text-lg font-semibold leading-none', className)} {...rest}>
      {children}
    </h3>
  );
}

export function CardContent({ className, children, ...rest }: CardPartProps) {
  return (
    <div className={joinClasses('p-6 pt-0', className)} {...rest}>
      {children}
    </div>
  );
}
