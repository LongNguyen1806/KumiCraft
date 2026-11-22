// Shared token bucket utilities and string helpers (SPEC-04 R-TH-10 to R-TH-14, R-ST-11).
import type { ThemeInfo, ThemeToken, ThemeTokenKind } from '@kumicraft/shared';

export type TokenBuckets = {
  readonly colors: ThemeToken[];
  readonly fontSizes: ThemeToken[];
  readonly radii: ThemeToken[];
  readonly fonts: ThemeToken[];
  readonly shadows: ThemeToken[];
  readonly breakpoints: ThemeToken[];
};

export function emptyBuckets(): TokenBuckets {
  return {
    colors: [],
    fontSizes: [],
    radii: [],
    fonts: [],
    shadows: [],
    breakpoints: [],
  };
}

export function pushTokenToBucket(
  buckets: TokenBuckets,
  kind: ThemeTokenKind,
  token: ThemeToken,
): void {
  switch (kind) {
    case 'color':
      buckets.colors.push(token);
      break;
    case 'fontSize':
      buckets.fontSizes.push(token);
      break;
    case 'radius':
      buckets.radii.push(token);
      break;
    case 'font':
      buckets.fonts.push(token);
      break;
    case 'shadow':
      buckets.shadows.push(token);
      break;
  }
}

export function targetBucket(theme: ThemeInfo, kind: ThemeTokenKind): readonly ThemeToken[] {
  switch (kind) {
    case 'color':
      return theme.colors;
    case 'font':
      return theme.fonts;
    case 'fontSize':
      return theme.fontSizes;
    case 'radius':
      return theme.radii;
    case 'shadow':
      return theme.shadows;
  }
}

export const getBucketForKind = targetBucket;

export function kindPrefix(kind: ThemeTokenKind, system: 'css' | 'sass' | 'less' = 'css'): string {
  switch (kind) {
    case 'color':
      return system === 'css' ? 'color-' : '';
    case 'fontSize':
      return 'font-size-';
    case 'font':
      return 'font-';
    case 'radius':
      return 'radius-';
    case 'shadow':
      return 'shadow-';
  }
}

export function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
