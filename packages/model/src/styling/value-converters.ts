// Value conversion helpers for styling map (SPEC-04.1 section 5.2, 5.3).
import type {
  Color,
  LimitValue,
  Px,
  SizeValue,
  Spacing,
  TokenRef,
} from '../schema/primitives.schema.ts';
import type { ParentLayout } from './styling-context.ts';

export function tokenNameToSuffix(tokenRef: string): string {
  const dotIndex = tokenRef.indexOf('.');
  return dotIndex === -1 ? tokenRef : tokenRef.slice(dotIndex + 1);
}

export function spacingToSuffix(spacing: Spacing): string {
  if (typeof spacing === 'string') {
    return tokenNameToSuffix(spacing);
  }
  return `[${String(spacing.px)}px]`;
}

export function colorToSuffix(color: Color): string {
  if (color.startsWith('token:')) {
    return tokenNameToSuffix(color);
  }
  return `[${color}]`;
}

export function colorToCssVar(color: Color): string {
  if (color.startsWith('token:')) {
    return `var(--color-${tokenNameToSuffix(color)})`;
  }
  return color;
}

export function limitValueToSuffix(limit: LimitValue): string {
  if (limit === 'none') {
    return 'none';
  }
  return `[${String(limit.px)}px]`;
}

export function sizeValueToClasses(
  dim: 'w' | 'h',
  val: SizeValue,
  parentLayout?: ParentLayout,
): string[] {
  if (val === 'hug') {
    return [`${dim}-fit`];
  }
  if (val === 'fill') {
    if (dim === 'w' && parentLayout === 'flex-row') {
      return ['flex-1', 'min-w-0'];
    }
    if (dim === 'h' && parentLayout === 'flex-column') {
      return ['flex-1', 'min-h-0'];
    }
    return [`${dim}-full`];
  }
  if ('fixed' in val) {
    return [`${dim}-[${String(val.fixed.px)}px]`];
  }
  return [`${dim}-[${String(val.percent)}%]`];
}

export function radiusToSuffix(radius: TokenRef<'radius'> | Px): string {
  if (typeof radius === 'string') {
    return tokenNameToSuffix(radius);
  }
  return `[${String(radius.px)}px]`;
}

export function shadowToSuffix(shadow: TokenRef<'shadow'> | 'none'): string {
  if (shadow === 'none') {
    return 'none';
  }
  return tokenNameToSuffix(shadow);
}

export function fontSizeToSuffix(size: TokenRef<'fontSize'> | Px): string {
  if (typeof size === 'string') {
    return tokenNameToSuffix(size);
  }
  return `[${String(size.px)}px]`;
}

export function fontWeightToSuffix(weight: TokenRef<'fontWeight'> | number): string {
  if (typeof weight === 'string') {
    return tokenNameToSuffix(weight);
  }
  return `[${String(weight)}]`;
}

export function lineHeightToSuffix(lh: TokenRef<'lineHeight'> | number): string {
  if (typeof lh === 'string') {
    return tokenNameToSuffix(lh);
  }
  return `[${String(lh)}]`;
}
