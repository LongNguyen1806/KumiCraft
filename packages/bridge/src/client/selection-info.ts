import type { ElementInfo, ElementRef } from '@kumicraft/shared';

import { measureElementA11y } from './a11y-measure.ts';
import { componentUseOf } from './component-use.ts';

export const MAX_DOM_CLASS = 4000;

const MAX_ANCESTORS = 200;

/** Refs of the `data-rc-loc` ancestors of `el`, nearest first, with the index of each copy. */
function ancestorRefs(el: Element, byLoc: ReadonlyMap<string, readonly Element[]>): ElementRef[] {
  const refs: ElementRef[] = [];
  for (
    let node = el.parentElement;
    node && refs.length < MAX_ANCESTORS;
    node = node.parentElement
  ) {
    const loc = node.getAttribute('data-rc-loc') ?? '';
    if (loc === '') continue;
    const index = byLoc.get(loc)?.indexOf(node) ?? -1;
    if (index >= 0) refs.push({ loc, index });
  }
  return refs;
}

function resolveFoundInfo(
  ref: ElementRef,
  el: Element,
  instances: number,
  ancestors: readonly ElementRef[],
  designFile: string | undefined,
): ElementInfo {
  const r = el.getBoundingClientRect();
  const rect = {
    x: r.x,
    y: r.y,
    width: r.width,
    height: r.height,
  };
  const rawClass = el.getAttribute('class') ?? undefined;
  const domClass = rawClass !== undefined ? rawClass.slice(0, MAX_DOM_CLASS) : undefined;
  const a11y = measureElementA11y(el);
  const use = componentUseOf(el, designFile);

  return {
    ref,
    found: true,
    tag: el.tagName.toLowerCase(),
    rect,
    instances,
    ...(domClass !== undefined ? { domClass } : {}),
    ancestors: [...ancestors],
    ...(a11y !== undefined ? { a11y } : {}),
    ...(use !== undefined ? { use } : {}),
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
  designFile?: string,
): ElementInfo[] {
  const byLoc = new Map<string, Element[]>();
  for (const el of root.querySelectorAll('[data-rc-loc]')) {
    const loc = el.getAttribute('data-rc-loc') ?? '';
    const list = byLoc.get(loc);
    if (list === undefined) byLoc.set(loc, [el]);
    else list.push(el);
  }
  return refs.map((ref) => {
    const matches = byLoc.get(ref.loc) ?? [];
    const el = matches[ref.index];
    const instances = Math.max(1, matches.length);
    if (el !== undefined) {
      return resolveFoundInfo(ref, el, instances, ancestorRefs(el, byLoc), designFile);
    }
    return resolveMissingInfo(ref, instances, previous);
  });
}
