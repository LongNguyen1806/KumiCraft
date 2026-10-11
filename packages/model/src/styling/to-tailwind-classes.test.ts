// Golden tests covering every row of SPEC-04.1 section 5.3 table (R-SM-01, R-SM-02, R-SM-03).
import { describe, expect, it } from 'vitest';

import type { DesignNode } from '../schema/node.schema.ts';
import { createDefaultTokens } from '../tokens/default-tokens.ts';
import type { StylingContext } from './styling-context.ts';
import { toTailwindClasses } from './to-tailwind-classes.ts';

const tokens = createDefaultTokens();

function makeContext(overrides?: Partial<StylingContext>): StylingContext {
  return {
    tailwind: 'v4',
    responsiveMode: 'desktop-first',
    tokens,
    ...overrides,
  };
}

function makeNode(partial: Partial<DesignNode>): DesignNode {
  return {
    id: 'n_0123456789',
    type: 'Stack',
    ...partial,
  };
}

describe('toTailwindClasses - SPEC-04.1 section 5.3 Table Golden Tests', () => {
  it('maps Flex containers (Stack, Card, Navbar) with directions', () => {
    const stack = makeNode({ type: 'Stack' });
    expect(toTailwindClasses(stack, makeContext())).toEqual(['flex', 'flex-col']);

    const navbar = makeNode({ type: 'Navbar' });
    expect(toTailwindClasses(navbar, makeContext())).toEqual(['flex', 'flex-row']);

    const rowStack = makeNode({ type: 'Stack', style: { direction: 'row' } });
    expect(toTailwindClasses(rowStack, makeContext())).toEqual(['flex', 'flex-row']);
  });

  it('maps Grid container, columns, rows and autoFit', () => {
    const grid = makeNode({
      type: 'Grid',
      style: {
        columns: 4,
        rows: 2,
        gap: 'token:spacing.4',
      },
    });
    expect(toTailwindClasses(grid, makeContext())).toEqual([
      'grid',
      'grid-cols-4',
      'grid-rows-2',
      'gap-4',
    ]);

    const autoFitGrid = makeNode({
      type: 'Grid',
      style: { autoFit: { minColumnWidth: { px: 280 } } },
    });
    expect(toTailwindClasses(autoFitGrid, makeContext())).toEqual([
      'grid',
      'grid-cols-[repeat(auto-fit,minmax(280px,1fr))]',
    ]);
  });

  it('maps flex align, justify, wrap', () => {
    const node = makeNode({
      type: 'Stack',
      style: {
        align: 'center',
        justify: 'between',
        wrap: true,
      },
    });
    expect(toTailwindClasses(node, makeContext())).toEqual([
      'flex',
      'flex-col',
      'items-center',
      'justify-between',
      'flex-wrap',
    ]);
  });

  it('maps parent positioning (grow, alignSelf, colSpan, rowSpan)', () => {
    const item = makeNode({
      type: 'Card',
      style: {
        grow: true,
        alignSelf: 'stretch',
        colSpan: 'full',
        rowSpan: 2,
      },
    });
    expect(toTailwindClasses(item, makeContext())).toContain('flex-1');
    expect(toTailwindClasses(item, makeContext())).toContain('self-stretch');
    expect(toTailwindClasses(item, makeContext())).toContain('col-span-full');
    expect(toTailwindClasses(item, makeContext())).toContain('row-span-2');
  });

  it('maps width and height with parent layout awareness (hug, fill, fixed, percent)', () => {
    const hug = makeNode({ type: 'Text', style: { width: 'hug', height: 'hug' } });
    expect(toTailwindClasses(hug, makeContext())).toEqual(['w-fit', 'h-fit']);

    const fillInRow = makeNode({ type: 'Card', style: { width: 'fill' } });
    expect(toTailwindClasses(fillInRow, makeContext({ parentLayout: 'flex-row' }))).toContain(
      'flex-1',
    );
    expect(toTailwindClasses(fillInRow, makeContext({ parentLayout: 'flex-row' }))).toContain(
      'min-w-0',
    );

    const fillInCol = makeNode({ type: 'Card', style: { height: 'fill' } });
    expect(toTailwindClasses(fillInCol, makeContext({ parentLayout: 'flex-column' }))).toContain(
      'flex-1',
    );
    expect(toTailwindClasses(fillInCol, makeContext({ parentLayout: 'flex-column' }))).toContain(
      'min-h-0',
    );

    const fixed = makeNode({
      type: 'Image',
      style: {
        width: { fixed: { px: 320 } },
        height: { percent: 50 },
      },
    });
    expect(toTailwindClasses(fixed, makeContext())).toEqual(['w-[320px]', 'h-[50%]']);
  });

  it('maps size limits and aspect ratios', () => {
    const node = makeNode({
      type: 'Container',
      style: {
        minWidth: { px: 300 },
        maxWidth: 'none',
        aspectRatio: '16/9',
      },
    });
    const classes = toTailwindClasses(node, makeContext());
    expect(classes).toContain('min-w-[300px]');
    expect(classes).toContain('max-w-none');
    expect(classes).toContain('aspect-video');
  });

  it('maps padding and margin (all equal, y/x, and individual sides)', () => {
    const allEq = makeNode({
      type: 'Card',
      style: {
        padding: {
          top: 'token:spacing.4',
          right: 'token:spacing.4',
          bottom: 'token:spacing.4',
          left: 'token:spacing.4',
        },
      },
    });
    expect(toTailwindClasses(allEq, makeContext())).toContain('p-4');

    const yx = makeNode({
      type: 'Card',
      style: {
        padding: {
          top: 'token:spacing.2',
          bottom: 'token:spacing.2',
          right: 'token:spacing.6',
          left: 'token:spacing.6',
        },
      },
    });
    expect(toTailwindClasses(yx, makeContext())).toContain('py-2');
    expect(toTailwindClasses(yx, makeContext())).toContain('px-6');

    const individual = makeNode({
      type: 'Card',
      style: {
        margin: { top: 'token:spacing.1', bottom: { px: 13 } },
      },
    });
    expect(toTailwindClasses(individual, makeContext())).toContain('mt-1');
    expect(toTailwindClasses(individual, makeContext())).toContain('mb-[13px]');
  });

  it('maps typography properties', () => {
    const text = makeNode({
      type: 'Heading',
      style: {
        fontFamily: 'token:fontFamily.sans',
        fontSize: 'token:fontSize.2xl',
        fontWeight: 'token:fontWeight.bold',
        lineHeight: 1.2,
        textAlign: 'center',
        textColor: 'token:color.primary',
        textTransform: 'uppercase',
        truncate: true,
      },
    });
    const classes = toTailwindClasses(text, makeContext());
    expect(classes).toEqual([
      'font-sans',
      'text-2xl',
      'font-bold',
      'leading-[1.2]',
      'text-center',
      'text-primary',
      'uppercase',
      'truncate',
    ]);
  });

  it('maps background color, gradients, external image URL', () => {
    const bgCol = makeNode({ type: 'Card', style: { background: 'token:color.surface' } });
    expect(toTailwindClasses(bgCol, makeContext())).toContain('bg-surface');

    const gradient = makeNode({
      type: 'Card',
      style: {
        backgroundImage: {
          kind: 'linear-gradient',
          angle: 90,
          stops: [
            { color: 'token:color.primary', at: 0 },
            { color: '#ffffff', at: 100 },
          ],
        },
      },
    });
    expect(toTailwindClasses(gradient, makeContext())).toContain(
      'bg-[linear-gradient(90deg,var(--color-primary)_0%,#ffffff_100%)]',
    );

    const extImg = makeNode({
      type: 'Section',
      style: {
        backgroundImage: {
          kind: 'image',
          src: 'https://example.com/hero.jpg',
          size: 'cover',
          position: 'center',
          repeat: false,
        },
      },
    });
    const imgClasses = toTailwindClasses(extImg, makeContext());
    expect(imgClasses).toContain('bg-[url(https://example.com/hero.jpg)]');
    expect(imgClasses).toContain('bg-cover');
    expect(imgClasses).toContain('bg-center');
    expect(imgClasses).toContain('bg-no-repeat');
  });

  it('maps border widths, colors, styles, radius, shadow, opacity and transition', () => {
    const card = makeNode({
      type: 'Card',
      style: {
        borderWidth: { top: 1, right: 1, bottom: 1, left: 1 },
        borderColor: 'token:color.border',
        borderStyle: 'dashed',
        radius: 'token:radius.lg',
        shadow: 'token:shadow.md',
        opacity: 90,
        transition: { property: 'colors', durationMs: 200 },
      },
    });
    const classes = toTailwindClasses(card, makeContext());
    expect(classes).toContain('border');
    expect(classes).toContain('border-border');
    expect(classes).toContain('border-dashed');
    expect(classes).toContain('rounded-lg');
    expect(classes).toContain('shadow-md');
    expect(classes).toContain('opacity-90');
    expect(classes).toContain('transition-colors');
    expect(classes).toContain('duration-200');
  });

  it('maps display and position (hidden, visible, sticky, zIndex, overflow)', () => {
    const hiddenNode = makeNode({ type: 'Text', style: { display: 'hidden' } });
    expect(toTailwindClasses(hiddenNode, makeContext())).toContain('hidden');

    const visibleNode = makeNode({ type: 'Stack', style: { display: 'visible' } });
    expect(toTailwindClasses(visibleNode, makeContext())).toContain('flex');

    const stickyNode = makeNode({
      type: 'Navbar',
      style: {
        position: 'sticky',
        stickyTop: 'token:spacing.0',
        zIndex: 50,
        overflowX: 'hidden',
        overflowY: 'auto',
      },
    });
    const classes = toTailwindClasses(stickyNode, makeContext());
    expect(classes).toContain('sticky');
    expect(classes).toContain('top-0');
    expect(classes).toContain('z-50');
    expect(classes).toContain('overflow-x-hidden');
    expect(classes).toContain('overflow-y-auto');
  });

  it('applies desktop-first and mobile-first responsive prefixes', () => {
    const node = makeNode({
      type: 'Card',
      style: {
        padding: {
          top: 'token:spacing.6',
          right: 'token:spacing.6',
          bottom: 'token:spacing.6',
          left: 'token:spacing.6',
        },
      },
      responsive: {
        md: {
          padding: {
            top: 'token:spacing.2',
            right: 'token:spacing.2',
            bottom: 'token:spacing.2',
            left: 'token:spacing.2',
          },
        },
      },
    });

    const dfClasses = toTailwindClasses(node, makeContext({ responsiveMode: 'desktop-first' }));
    expect(dfClasses).toContain('p-6');
    expect(dfClasses).toContain('max-md:p-2');

    const mfClasses = toTailwindClasses(node, makeContext({ responsiveMode: 'mobile-first' }));
    expect(mfClasses).toContain('p-6');
    expect(mfClasses).toContain('md:p-2');
  });

  it('maps states (hover, focus, disabled) with correct prefixes', () => {
    const btn = makeNode({
      type: 'Button',
      states: {
        hover: { background: 'token:color.primary', opacity: 90 },
        focus: { borderColor: 'token:color.primary' },
        disabled: { opacity: 50 },
      },
    });
    const classes = toTailwindClasses(btn, makeContext());
    expect(classes).toContain('hover:bg-primary');
    expect(classes).toContain('hover:opacity-90');
    expect(classes).toContain('focus-visible:border-primary');
    expect(classes).toContain('disabled:opacity-50');
  });

  it('handles runtimeHidden for v4 (hidden!) and v3 (!hidden)', () => {
    const node = makeNode({ type: 'Card' });
    expect(toTailwindClasses(node, makeContext({ tailwind: 'v4', runtimeHidden: true }))).toContain(
      'hidden!',
    );
    expect(toTailwindClasses(node, makeContext({ tailwind: 'v3', runtimeHidden: true }))).toContain(
      '!hidden',
    );
  });

  it('adheres to R-SM-01 order and R-SM-02 uniqueness', () => {
    const complex = makeNode({
      type: 'Card',
      style: {
        width: 'fill',
        padding: {
          top: 'token:spacing.4',
          right: 'token:spacing.4',
          bottom: 'token:spacing.4',
          left: 'token:spacing.4',
        },
        textColor: 'token:color.foreground',
        background: 'token:color.surface',
        radius: 'token:radius.md',
        shadow: 'token:shadow.sm',
      },
    });
    const classes = toTailwindClasses(complex, makeContext());
    // Unique classes only
    expect(new Set(classes).size).toBe(classes.length);

    // Order: layout container -> width -> padding -> textColor -> background -> radius -> shadow
    const flexIdx = classes.indexOf('flex');
    const wIdx = classes.indexOf('w-full');
    const pIdx = classes.indexOf('p-4');
    const textIdx = classes.indexOf('text-foreground');
    const bgIdx = classes.indexOf('bg-surface');
    const rIdx = classes.indexOf('rounded-md');
    const sIdx = classes.indexOf('shadow-sm');

    expect(flexIdx).toBeLessThan(wIdx);
    expect(wIdx).toBeLessThan(pIdx);
    expect(pIdx).toBeLessThan(textIdx);
    expect(textIdx).toBeLessThan(bgIdx);
    expect(bgIdx).toBeLessThan(rIdx);
    expect(rIdx).toBeLessThan(sIdx);
  });
});
