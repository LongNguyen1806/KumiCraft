// Property mappers for Tailwind classes (SPEC-04.1 section 5.3 table).
import type { BackgroundImage, StyleProps } from '../schema/style.schema.ts';
import type { ParentLayout } from './styling-context.ts';
import {
  colorToCssVar,
  colorToSuffix,
  fontSizeToSuffix,
  fontWeightToSuffix,
  limitValueToSuffix,
  lineHeightToSuffix,
  radiusToSuffix,
  shadowToSuffix,
  sizeValueToClasses,
  spacingToSuffix,
  tokenNameToSuffix,
} from './value-converters.ts';

const FLEX_CONTAINERS = new Set([
  'Stack',
  'Section',
  'Card',
  'Form',
  'Navbar',
  'Sidebar',
  'Footer',
  'DetailView',
  'Modal',
  'Container',
]);

export function isFlexContainer(nodeType: string): boolean {
  return FLEX_CONTAINERS.has(nodeType);
}

export function isGridContainer(nodeType: string): boolean {
  return nodeType === 'Grid';
}

/** Group 1: Container layout (flex/grid) */
export function mapContainerLayout(nodeType: string, style: StyleProps): string[] {
  const classes: string[] = [];

  if (isGridContainer(nodeType)) {
    classes.push('grid');
    if (style.columns !== undefined) classes.push(`grid-cols-${String(style.columns)}`);
    if (style.autoFit !== undefined) {
      classes.push(
        `grid-cols-[repeat(auto-fit,minmax(${String(style.autoFit.minColumnWidth.px)}px,1fr))]`,
      );
    }
    if (style.rows !== undefined) classes.push(`grid-rows-${String(style.rows)}`);
  } else if (isFlexContainer(nodeType)) {
    classes.push('flex');
    const defaultDir = nodeType === 'Navbar' || nodeType === 'Footer' ? 'row' : 'column';
    const dir = style.direction ?? defaultDir;
    classes.push(dir === 'row' ? 'flex-row' : 'flex-col');
  }

  if (style.gap !== undefined) classes.push(`gap-${spacingToSuffix(style.gap)}`);
  if (style.align !== undefined) classes.push(`items-${style.align}`);
  if (style.justify !== undefined) classes.push(`justify-${style.justify}`);
  if (style.wrap === true) classes.push('flex-wrap');

  return classes;
}

/** Group 2: Position inside parent */
export function mapParentPosition(style: StyleProps): string[] {
  const classes: string[] = [];
  if (style.grow === true) classes.push('flex-1');
  if (style.alignSelf !== undefined) classes.push(`self-${style.alignSelf}`);
  if (style.colSpan !== undefined) {
    classes.push(style.colSpan === 'full' ? 'col-span-full' : `col-span-${String(style.colSpan)}`);
  }
  if (style.rowSpan !== undefined) classes.push(`row-span-${String(style.rowSpan)}`);
  return classes;
}

/** Group 3: Size */
export function mapSize(style: StyleProps, parentLayout?: ParentLayout): string[] {
  const classes: string[] = [];
  if (style.width !== undefined)
    classes.push(...sizeValueToClasses('w', style.width, parentLayout));
  if (style.height !== undefined)
    classes.push(...sizeValueToClasses('h', style.height, parentLayout));
  if (style.minWidth !== undefined) classes.push(`min-w-${limitValueToSuffix(style.minWidth)}`);
  if (style.maxWidth !== undefined) classes.push(`max-w-${limitValueToSuffix(style.maxWidth)}`);
  if (style.minHeight !== undefined) classes.push(`min-h-${limitValueToSuffix(style.minHeight)}`);
  if (style.maxHeight !== undefined) classes.push(`max-h-${limitValueToSuffix(style.maxHeight)}`);
  if (style.aspectRatio !== undefined) {
    if (style.aspectRatio === '1/1') classes.push('aspect-square');
    else if (style.aspectRatio === '16/9') classes.push('aspect-video');
    else classes.push(`aspect-[${style.aspectRatio}]`);
  }
  return classes;
}

function mapSides(
  prefix: 'p' | 'm',
  sides: { top?: unknown; right?: unknown; bottom?: unknown; left?: unknown } | undefined,
  toSuffix: (val: never) => string,
): string[] {
  if (sides === undefined) return [];
  const { top, right, bottom, left } = sides;
  if (top !== undefined && top === right && right === bottom && bottom === left) {
    return [`${prefix}-${toSuffix(top as never)}`];
  }
  if (top !== undefined && top === bottom && right !== undefined && right === left) {
    return [`${prefix}y-${toSuffix(top as never)}`, `${prefix}x-${toSuffix(right as never)}`];
  }
  const res: string[] = [];
  if (top !== undefined && top === bottom) res.push(`${prefix}y-${toSuffix(top as never)}`);
  else {
    if (top !== undefined) res.push(`${prefix}t-${toSuffix(top as never)}`);
    if (bottom !== undefined) res.push(`${prefix}b-${toSuffix(bottom as never)}`);
  }
  if (right !== undefined && right === left) res.push(`${prefix}x-${toSuffix(right as never)}`);
  else {
    if (right !== undefined) res.push(`${prefix}r-${toSuffix(right as never)}`);
    if (left !== undefined) res.push(`${prefix}l-${toSuffix(left as never)}`);
  }
  return res;
}

/** Group 4: Spacing (padding & margin) */
export function mapSpacing(style: StyleProps): string[] {
  return [
    ...mapSides('p', style.padding, spacingToSuffix),
    ...mapSides('m', style.margin, spacingToSuffix),
  ];
}

/** Group 5: Typography */
export function mapTypography(style: StyleProps): string[] {
  const classes: string[] = [];
  if (style.fontFamily !== undefined) classes.push(`font-${tokenNameToSuffix(style.fontFamily)}`);
  if (style.fontSize !== undefined) classes.push(`text-${fontSizeToSuffix(style.fontSize)}`);
  if (style.fontWeight !== undefined) classes.push(`font-${fontWeightToSuffix(style.fontWeight)}`);
  if (style.lineHeight !== undefined)
    classes.push(`leading-${lineHeightToSuffix(style.lineHeight)}`);
  if (style.textAlign !== undefined) classes.push(`text-${style.textAlign}`);
  if (style.textColor !== undefined) classes.push(`text-${colorToSuffix(style.textColor)}`);
  if (style.textTransform !== undefined) {
    classes.push(style.textTransform === 'none' ? 'normal-case' : style.textTransform);
  }
  if (style.truncate === true) classes.push('truncate');
  return classes;
}

function mapBackgroundImage(bg: BackgroundImage): string[] {
  if (bg.kind === 'linear-gradient') {
    const stops = bg.stops.map((s) => `${colorToCssVar(s.color)}_${String(s.at)}%`).join(',');
    return [`bg-[linear-gradient(${String(bg.angle)}deg,${stops})]`];
  }
  const classes: string[] = [];
  if (bg.src.startsWith('http://') || bg.src.startsWith('https://')) {
    classes.push(`bg-[url(${bg.src})]`);
  }
  classes.push(`bg-${bg.size}`);
  classes.push(`bg-${bg.position}`);
  if (!bg.repeat) classes.push('bg-no-repeat');
  return classes;
}

/** Group 6: Background */
export function mapBackground(style: StyleProps): string[] {
  const classes: string[] = [];
  if (style.background !== undefined) classes.push(`bg-${colorToSuffix(style.background)}`);
  if (style.backgroundImage !== undefined)
    classes.push(...mapBackgroundImage(style.backgroundImage));
  return classes;
}

function mapBorderWidth(
  bw:
    | {
        top?: number | undefined;
        right?: number | undefined;
        bottom?: number | undefined;
        left?: number | undefined;
      }
    | undefined,
): string[] {
  if (bw === undefined) return [];
  const { top, right, bottom, left } = bw;
  const toWidth = (w: number) => (w === 1 ? '' : `-${String(w)}`);
  if (top !== undefined && top === right && right === bottom && bottom === left) {
    return [`border${toWidth(top)}`];
  }
  const res: string[] = [];
  if (top !== undefined) res.push(`border-t${toWidth(top)}`);
  if (right !== undefined) res.push(`border-r${toWidth(right)}`);
  if (bottom !== undefined) res.push(`border-b${toWidth(bottom)}`);
  if (left !== undefined) res.push(`border-l${toWidth(left)}`);
  return res;
}

/** Group 7: Borders */
export function mapBorders(style: StyleProps): string[] {
  const classes: string[] = [];
  if (style.borderWidth !== undefined) classes.push(...mapBorderWidth(style.borderWidth));
  if (style.borderColor !== undefined) classes.push(`border-${colorToSuffix(style.borderColor)}`);
  if (style.borderStyle !== undefined && style.borderStyle !== 'solid') {
    classes.push(`border-${style.borderStyle}`);
  }
  if (style.radius !== undefined) classes.push(`rounded-${radiusToSuffix(style.radius)}`);
  return classes;
}

/** Group 8: Effects */
export function mapEffects(style: StyleProps): string[] {
  const classes: string[] = [];
  if (style.shadow !== undefined) classes.push(`shadow-${shadowToSuffix(style.shadow)}`);
  if (style.opacity !== undefined) classes.push(`opacity-${String(style.opacity)}`);
  if (style.transition !== undefined) {
    classes.push(
      `transition-${style.transition.property}`,
      `duration-${String(style.transition.durationMs)}`,
    );
  }
  return classes;
}

/** Group 9: Display and positioning */
export function mapDisplayAndPosition(nodeType: string, style: StyleProps): string[] {
  const classes: string[] = [];
  if (style.display === 'hidden') {
    classes.push('hidden');
  } else if (style.display === 'visible') {
    if (isGridContainer(nodeType)) classes.push('grid');
    else if (isFlexContainer(nodeType)) classes.push('flex');
    else classes.push('block');
  }
  if (style.position === 'sticky') classes.push('sticky');
  if (style.stickyTop !== undefined) classes.push(`top-${spacingToSuffix(style.stickyTop)}`);
  if (style.zIndex !== undefined) classes.push(`z-${String(style.zIndex)}`);
  if (style.overflowX !== undefined) classes.push(`overflow-x-${style.overflowX}`);
  if (style.overflowY !== undefined) classes.push(`overflow-y-${style.overflowY}`);
  return classes;
}
