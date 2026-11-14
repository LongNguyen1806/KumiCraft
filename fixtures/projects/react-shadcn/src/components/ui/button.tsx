import type { ButtonHTMLAttributes, ReactNode } from 'react';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  readonly variant?: 'default' | 'outline' | 'ghost';
  readonly size?: 'default' | 'sm' | 'lg';
  readonly children?: ReactNode;
}

const VARIANT_CLASSES: Readonly<Record<'default' | 'outline' | 'ghost', string>> = {
  default: 'bg-brand text-white hover:opacity-90',
  outline: 'border border-brand text-brand bg-transparent hover:bg-slate-100',
  ghost: 'text-brand bg-transparent hover:bg-slate-100',
};

const SIZE_CLASSES: Readonly<Record<'default' | 'sm' | 'lg', string>> = {
  default: 'h-9 px-4 py-2 text-sm',
  sm: 'h-8 px-3 text-xs',
  lg: 'h-10 px-6 text-base',
};

export function Button({
  variant = 'default',
  size = 'default',
  className = '',
  type = 'button',
  children,
  ...rest
}: ButtonProps) {
  const classes = [
    'inline-flex items-center justify-center rounded-md font-medium transition-colors',
    VARIANT_CLASSES[variant],
    SIZE_CLASSES[size],
    className,
  ]
    .filter((c) => c.length > 0)
    .join(' ');

  return (
    <button type={type} className={classes} {...rest}>
      {children}
    </button>
  );
}
