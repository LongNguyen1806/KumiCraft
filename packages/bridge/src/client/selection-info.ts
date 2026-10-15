import type { ElementInfo, ElementRef } from '@reactcraft/shared';

export const MAX_DOM_CLASS = 4000;

function resolveFoundInfo(ref: ElementRef, el: Element, instances: number): ElementInfo {
  const r = el.getBoundingClientRect();
  const rect = {
    x: r.x,
    y: r.y,
    width: r.width,
    height: r.height,
  };
  const rawClass = el.getAttribute('class') ?? undefined;
  const domClass = rawClass !== undefined ? rawClass.slice(0, MAX_DOM_CLASS) : undefined;

  return {
    ref,
    found: true,
    tag: el.tagName.toLowerCase(),
    rect,
    instances,
    ...(domClass !== undefined ? { domClass } : {}),
  };
}

function resolveMissingInfo(
  ref: ElementRef,
  instances: number,
  previous: readonly ElementInfo[],
): ElementInfo {
  const prev = previous.find((p) => p.ref.loc === ref.loc && p.ref.index === ref.index);
  return {
    ref,
    found: false,
    tag: prev?.tag ?? 'unknown',
    instances,
  };
}

/** R-BR-16: current state of each selected ref in the page. */
export function collectSelectionInfo(
  refs: readonly ElementRef[],
  root: ParentNode,
  previous: readonly ElementInfo[],
): ElementInfo[] {
  const allElements = Array.from(root.querySelectorAll('[data-rc-loc]'));
  return refs.map((ref) => {
    const matches = allElements.filter((el) => el.getAttribute('data-rc-loc') === ref.loc);
    const el = matches[ref.index];
    const instances = Math.max(1, matches.length);
    if (el !== undefined) {
      return resolveFoundInfo(ref, el, instances);
    }
    return resolveMissingInfo(ref, instances, previous);
  });
}
