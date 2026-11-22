// Tailwind class model types (SPEC-04 section 8, R-TW-01..11).
import type { ThemeInfo } from '@kumicraft/shared';
import type {
  Breakpoint,
  InteractionState,
  ResponsiveKey,
  ResponsiveMode,
} from '@kumicraft/shared';

export type PropertyId = string;

export type ClassValue =
  | { readonly kind: 'scale'; readonly token: string }
  | { readonly kind: 'keyword'; readonly name: string }
  | { readonly kind: 'theme'; readonly name: string }
  | { readonly kind: 'arbitrary'; readonly css: string };

export type ClassToken = {
  readonly raw: string;
  readonly start: number;
  readonly end: number;
  readonly variants: readonly string[];
  readonly important: boolean;
  readonly negative: boolean;
  readonly utility: string;
  readonly property?: PropertyId | undefined;
  readonly value?: ClassValue | undefined;
  readonly opacity?: string | undefined;
};

export type Scope = {
  readonly breakpoint: Breakpoint;
  readonly state?: InteractionState | undefined;
  readonly dark?: boolean | undefined;
};

export type ClassContext = {
  readonly theme: ThemeInfo;
  readonly mode: ResponsiveMode;
  readonly breakpoints: Readonly<Record<ResponsiveKey, number>>;
  readonly major?: 3 | 4 | undefined;
};
