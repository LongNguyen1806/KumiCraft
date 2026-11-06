// Writes Bootstrap 5 utility class changes to JSX (SPEC-04 M-ST, R-ST-09, R-ST-10).
import {
  BREAKPOINT_WIDTHS,
  ok,
  RESPONSIVE_KEYS,
  type ResponsiveKey,
  type Result,
  type StyleApplyRequest,
} from '@kumicraft/shared';

import type { WrittenFile } from '../source-editor/source-editor-service.ts';
import { type BootstrapBreakpoint, parseSingleUtility, utilityFor } from './bootstrap-utilities.ts';
import {
  addClass,
  elementContext,
  mergeWrites,
  type StyleApplied,
  type StyleApplyDeps,
} from './style-apply.ts';

const RESPONSIVE_TO_BOOTSTRAP: Readonly<Record<ResponsiveKey, BootstrapBreakpoint>> = {
  sm: 'sm',
  md: 'md',
  lg: 'lg',
  xl: 'xl',
  '2xl': 'xxl',
};

function breakpointFromMedia(media: string | undefined): {
  readonly supported: boolean;
  readonly breakpoint?: BootstrapBreakpoint | undefined;
} {
  if (media === undefined) return { supported: true };
  const match = /^\(\s*min-width\s*:\s*(\d+)px\s*\)$/i.exec(media.trim());
  if (match?.[1] === undefined) return { supported: false };
  const width = Number(match[1]);
  const key = RESPONSIVE_KEYS.find((k) => BREAKPOINT_WIDTHS[k] === width);
  return key === undefined
    ? { supported: false }
    : { supported: true, breakpoint: RESPONSIVE_TO_BOOTSTRAP[key] };
}

/** The classes without the one-side utility of `property` at `breakpoint` (`pt-2` for `pt-4`). */
function withoutSameUtility(
  classes: readonly string[],
  property: string,
  breakpoint: BootstrapBreakpoint | undefined,
): string[] {
  return classes.filter((c) => {
    const parsed = parseSingleUtility(c);
    return parsed?.property !== property || parsed.breakpoint !== breakpoint;
  });
}

/**
 * Attempts to apply `request` as a Bootstrap 5 utility class in JSX. Returns `undefined` when the
 * change has a pseudo-state, uses a desktop-first `@media (max-width)`, or has an off-scale value
 * so the caller falls back to plain CSS.
 */
export async function tryApplyBootstrapChange(
  deps: StyleApplyDeps,
  root: string,
  request: StyleApplyRequest,
): Promise<Result<StyleApplied> | undefined> {
  const { change } = request;
  if (change.state !== undefined) return undefined;
  const bpInfo = breakpointFromMedia(change.media);
  if (!bpInfo.supported) return undefined;

  if (change.value === undefined) {
    const ctx = await elementContext(deps, root, request.probe.ref.loc);
    if (!ctx.ok) return ctx;
    const filtered = withoutSameUtility(ctx.value.classes, change.property, bpInfo.breakpoint);
    if (filtered.length === ctx.value.classes.length) return ok({ files: [] });
    const writes: WrittenFile[] = [];
    const edited = await addClass(deps, root, request, ctx.value, filtered, writes);
    if (!edited.ok) return edited;
    return ok({ files: mergeWrites(writes) });
  }

  const nextUtility = utilityFor(change.property, change.value, bpInfo.breakpoint);
  if (nextUtility === undefined) return undefined;

  const ctx = await elementContext(deps, root, request.probe.ref.loc);
  if (!ctx.ok) return ctx;
  const filtered = withoutSameUtility(ctx.value.classes, change.property, bpInfo.breakpoint);
  const nextClasses = [...filtered, nextUtility];
  const writes: WrittenFile[] = [];
  const edited = await addClass(deps, root, request, ctx.value, nextClasses, writes);
  if (!edited.ok) return edited;
  return ok({ files: mergeWrites(writes), className: nextUtility });
}
