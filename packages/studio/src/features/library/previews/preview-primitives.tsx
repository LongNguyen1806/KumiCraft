import type { ReactNode } from 'react';

export function WireSvg({ children }: { readonly children: ReactNode }) {
  return (
    <svg
      viewBox="0 0 120 76"
      width={120}
      height={76}
      fill="none"
      aria-hidden="true"
      className="block text-ink"
    >
      {children}
    </svg>
  );
}

export function WireBox({
  x,
  y,
  w,
  h,
  rx = 3,
  accent = false,
  muted = false,
}: {
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
  readonly rx?: number;
  readonly accent?: boolean;
  readonly muted?: boolean;
}) {
  return (
    <rect
      x={x}
      y={y}
      width={w}
      height={h}
      rx={rx}
      fill="currentColor"
      fillOpacity={accent ? 0.22 : muted ? 0.08 : 0.04}
      stroke="currentColor"
      strokeOpacity={accent ? 0.55 : 0.28}
      strokeWidth={1}
    />
  );
}

export function WireBar({
  x,
  y,
  w,
  h = 4,
  strong = false,
}: {
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h?: number;
  readonly strong?: boolean;
}) {
  return (
    <rect
      x={x}
      y={y}
      width={w}
      height={h}
      rx={h / 2}
      fill="currentColor"
      fillOpacity={strong ? 0.55 : 0.25}
    />
  );
}
