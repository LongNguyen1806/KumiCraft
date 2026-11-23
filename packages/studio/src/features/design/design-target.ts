// Pure utilities for design target matching and insert anchor resolution (SPEC-04 R-CP-11, spec-log #23).
import type { ElementRef, PageInfo, RelPath, TreeNode } from '@kumicraft/shared';

export type DesignTarget = {
  readonly kind: 'page' | 'layout' | 'component' | 'draft';
  readonly name?: string | undefined;
  readonly file?: RelPath | undefined;
  readonly route: string;
};

function normalizeRouteSegments(path: string): string[] {
  const withoutQueryOrHash = path.split(/[?#]/)[0] ?? path;
  const trimmed =
    withoutQueryOrHash.endsWith('/') && withoutQueryOrHash.length > 1
      ? withoutQueryOrHash.slice(0, -1)
      : withoutQueryOrHash;
  return trimmed.split('/').filter(Boolean);
}

function findPage(
  pages: readonly PageInfo[],
  targetSegments: readonly string[],
  same: (a: string, b: string) => boolean,
): PageInfo | undefined {
  for (const page of pages) {
    const pageSegments = normalizeRouteSegments(page.path);
    if (pageSegments.length !== targetSegments.length) continue;

    let matches = true;
    for (let i = 0; i < pageSegments.length; i++) {
      const pageSeg = pageSegments[i];
      const targetSeg = targetSegments[i];
      if (pageSeg && targetSeg && !pageSeg.startsWith(':') && !same(pageSeg, targetSeg)) {
        matches = false;
        break;
      }
    }

    if (matches) return page;
  }
  return undefined;
}

const exact = (a: string, b: string): boolean => a === b;
const anyCase = (a: string, b: string): boolean => a.toLowerCase() === b.toLowerCase();

/**
 * Matches current route against project pages: segment-by-segment, :param matches any, strips
 * query and trailing slash. Then, as ASP.NET routes do (React Router too, by default), letter case
 * aside; then `/Shop/Index` as `/Shop` and `/Home` as `/` (the MVC default action and controller).
 */
export function matchPage(pages: readonly PageInfo[], route: string): PageInfo | undefined {
  const target = normalizeRouteSegments(route);
  const found = findPage(pages, target, exact) ?? findPage(pages, target, anyCase);
  if (found !== undefined) return found;
  const withoutIndex = target.at(-1)?.toLowerCase() === 'index' ? target.slice(0, -1) : target;
  const home = withoutIndex.length === 1 && withoutIndex[0]?.toLowerCase() === 'home';
  const alias = home ? [] : withoutIndex;
  return alias.length === target.length ? undefined : findPage(pages, alias, anyCase);
}

export function designTargetOf(pages: readonly PageInfo[], route: string): DesignTarget {
  const page = matchPage(pages, route);
  return {
    kind: 'page',
    name: page?.component ?? page?.path,
    file: page?.file,
    route,
  };
}

function fileOfLoc(loc: string): string {
  return loc.split(':')[0] ?? loc;
}

/**
 * Resolves element to insert into when currently selected element belongs to a different file (R-CP-11).
 * Takes the nearest ancestor in `designFile` from the Bridge's `ancestors` of this copy; without them,
 * ascends `parent` indices in `treeNodes`, which only knows the first copy of a repeated element.
 * Returns original ref if designFile is undefined or ref already belongs to designFile.
 * Returns undefined if no ancestor belongs to designFile.
 */
export function insertAnchor(
  ref: ElementRef,
  treeNodes: readonly TreeNode[],
  designFile: RelPath | undefined,
  ancestors?: readonly ElementRef[],
): ElementRef | undefined {
  if (designFile === undefined || designFile === '') return ref;
  if (fileOfLoc(ref.loc) === designFile) return ref;
  if (ancestors !== undefined) return ancestors.find((a) => fileOfLoc(a.loc) === designFile);

  let currentIndex = treeNodes.findIndex((n) => n.ref.loc === ref.loc && n.ref.index === ref.index);
  while (currentIndex !== -1) {
    const node = treeNodes[currentIndex];
    if (node === undefined || node.parent === undefined) break;
    const parentNode = treeNodes[node.parent];
    if (parentNode === undefined) break;
    if (fileOfLoc(parentNode.ref.loc) === designFile) {
      return parentNode.ref;
    }
    currentIndex = node.parent;
  }

  return undefined;
}
