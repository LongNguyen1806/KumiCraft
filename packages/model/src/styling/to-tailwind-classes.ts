// Tailwind class generator for DesignNode (SPEC-04.1 section 5, ADR-FE-06).
import type { DesignNode } from '../schema/node.schema.ts';
import type { ResponsiveKey, ResponsiveMode } from '../schema/primitives.schema.ts';
import type { StateStyleProps, StyleProps } from '../schema/style.schema.ts';
import {
  mapBackground,
  mapBorders,
  mapContainerLayout,
  mapDisplayAndPosition,
  mapEffects,
  mapParentPosition,
  mapSize,
  mapSpacing,
  mapTypography,
} from './map-property.ts';
import type { StylingContext } from './styling-context.ts';
import { colorToSuffix, shadowToSuffix } from './value-converters.ts';

const DESKTOP_FIRST_KEYS: readonly ResponsiveKey[] = ['xl', 'lg', 'md', 'sm'];
const MOBILE_FIRST_KEYS: readonly ResponsiveKey[] = ['sm', 'md', 'lg', 'xl', '2xl'];

function getResponsivePrefix(mode: ResponsiveMode, key: ResponsiveKey): string {
  return mode === 'desktop-first' ? `max-${key}:` : `${key}:`;
}

function mapStyleGroup(
  nodeType: string,
  style: StyleProps,
  ctx: StylingContext,
  isBase: boolean,
): string[] {
  const classes: string[] = [];
  if (isBase) {
    classes.push(...mapContainerLayout(nodeType, style));
  } else {
    // Responsive breakpoints can override gap, align, justify, wrap, columns, etc.
    if (style.gap !== undefined || style.align !== undefined || style.justify !== undefined) {
      classes.push(
        ...mapContainerLayout(nodeType, style).filter((c) => c !== 'flex' && c !== 'grid'),
      );
    }
  }
  classes.push(...mapParentPosition(style));
  classes.push(...mapSize(style, ctx.parentLayout));
  classes.push(...mapSpacing(style));
  classes.push(...mapTypography(style));
  classes.push(...mapBackground(style));
  classes.push(...mapBorders(style));
  classes.push(...mapEffects(style));
  classes.push(...mapDisplayAndPosition(nodeType, style));
  return classes;
}

function mapStateStyle(state: 'hover' | 'focus' | 'disabled', props: StateStyleProps): string[] {
  const prefix = state === 'hover' ? 'hover:' : state === 'focus' ? 'focus-visible:' : 'disabled:';
  const raw: string[] = [];
  if (props.textColor !== undefined) raw.push(`text-${colorToSuffix(props.textColor)}`);
  if (props.background !== undefined) raw.push(`bg-${colorToSuffix(props.background)}`);
  if (props.borderColor !== undefined) raw.push(`border-${colorToSuffix(props.borderColor)}`);
  if (props.shadow !== undefined) raw.push(`shadow-${shadowToSuffix(props.shadow)}`);
  if (props.opacity !== undefined) raw.push(`opacity-${String(props.opacity)}`);
  return raw.map((cls) => `${prefix}${cls}`);
}

function mapStates(node: DesignNode): string[] {
  if (node.states === undefined) return [];
  const classes: string[] = [];
  const stateKeys: readonly ('hover' | 'focus' | 'disabled')[] = ['hover', 'focus', 'disabled'];
  for (const key of stateKeys) {
    const props = node.states[key];
    if (props !== undefined) {
      classes.push(...mapStateStyle(key, props));
    }
  }
  return classes;
}

function mapResponsive(node: DesignNode, ctx: StylingContext): string[] {
  if (node.responsive === undefined) return [];
  const classes: string[] = [];
  const keys = ctx.responsiveMode === 'desktop-first' ? DESKTOP_FIRST_KEYS : MOBILE_FIRST_KEYS;

  for (const key of keys) {
    const rStyle = node.responsive[key];
    if (rStyle !== undefined) {
      const prefix = getResponsivePrefix(ctx.responsiveMode, key);
      const groupClasses = mapStyleGroup(node.type, rStyle, ctx, false);
      for (const cls of groupClasses) {
        classes.push(`${prefix}${cls}`);
      }
    }
  }
  return classes;
}

/**
 * Maps a DesignNode to its deterministic list of Tailwind CSS classes (ADR-FE-06, R-SM-01).
 * Shared identically between Canvas renderer and codegen lowering.
 */
export function toTailwindClasses(node: DesignNode, ctx: StylingContext): string[] {
  const result: string[] = [];

  // 1. Base style (9 ordered groups)
  if (node.style !== undefined) {
    result.push(...mapStyleGroup(node.type, node.style, ctx, true));
  } else {
    result.push(...mapContainerLayout(node.type, {}));
  }

  // 2. Responsive overrides
  result.push(...mapResponsive(node, ctx));

  // 3. Interaction states (hover, focus, disabled)
  result.push(...mapStates(node));

  // 4. Runtime visibility override (V-71)
  if (ctx.runtimeHidden === true) {
    result.push(ctx.tailwind === 'v4' ? 'hidden!' : '!hidden');
  }

  // Deduplicate while preserving first appearance order (R-SM-02)
  return Array.from(new Set(result));
}
