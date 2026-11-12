// Turning a free frame off gives back what turning it on replaced (spec-log #126). Turning it on
// records each child's classes before and after; turning it off puts back every child that still
// has the "after" classes (never moved, resized or edited), and leaves the others where the user
// put them. The frame stays their positioning parent while any of them is still placed absolutely.
// Children are matched by their classes, so an edit above the frame that shifts lines changes
// nothing; a child edited by hand no longer matches and is left alone.
import type { AttributeLevelEdit } from '@kumicraft/shared';

export type FreeSnapshotChild = {
  readonly loc: string;
  readonly before: string;
  readonly after: string;
};

export type FreeSnapshot = {
  /** The frame's location when it was turned on. */
  readonly loc: string;
  readonly frameBefore: string;
  readonly frameAfter: string;
  readonly children: readonly FreeSnapshotChild[];
};

/** An element as it is now: where, which tag, and its static classes. */
export type CurrentElement = {
  readonly loc: string;
  readonly tag: string;
  readonly className: string;
};

export type RestorePlan = {
  readonly edits: readonly AttributeLevelEdit[];
  readonly restored: number;
  readonly kept: number;
};

const MAX_SNAPSHOTS = 30;
const storageKey = (projectId: string) => `kumicraft.freeFrameSnapshots.${projectId}`;

const tokens = (className: string): string[] => className.split(/\s+/).filter((c) => c !== '');
const sameClasses = (a: string, b: string): boolean => tokens(a).join(' ') === tokens(b).join(' ');
const fileOf = (loc: string): string => loc.replace(/:\d+:\d+$/, '');

function isChild(value: unknown): value is FreeSnapshotChild {
  return (
    value instanceof Object &&
    'loc' in value &&
    typeof value.loc === 'string' &&
    'before' in value &&
    typeof value.before === 'string' &&
    'after' in value &&
    typeof value.after === 'string'
  );
}

function isSnapshot(value: unknown): value is FreeSnapshot {
  return (
    value instanceof Object &&
    'loc' in value &&
    typeof value.loc === 'string' &&
    'frameBefore' in value &&
    typeof value.frameBefore === 'string' &&
    'frameAfter' in value &&
    typeof value.frameAfter === 'string' &&
    'children' in value &&
    Array.isArray(value.children) &&
    value.children.every(isChild)
  );
}

function readAll(projectId: string): FreeSnapshot[] {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(storageKey(projectId)) ?? '[]');
    return Array.isArray(parsed) ? parsed.filter(isSnapshot) : [];
  } catch {
    return [];
  }
}

/** Remembers what turning a frame on replaced; a newer one for the same frame replaces it. */
export function saveFreeSnapshot(projectId: string, snapshot: FreeSnapshot): void {
  const list = readAll(projectId).filter((s) => s.loc !== snapshot.loc);
  list.push(snapshot);
  try {
    localStorage.setItem(storageKey(projectId), JSON.stringify(list.slice(-MAX_SNAPSHOTS)));
  } catch {
    // Without storage, turning the frame off falls back to putting children in the flow.
  }
}

/**
 * The record for the frame at `loc`, or, when lines moved since, the newest one in the same file
 * whose "after" classes are the frame's classes now.
 */
export function findFreeSnapshot(
  projectId: string,
  loc: string,
  frameClassName: string,
): FreeSnapshot | undefined {
  const list = readAll(projectId).reverse();
  return (
    list.find((s) => s.loc === loc) ??
    list.find((s) => fileOf(s.loc) === fileOf(loc) && sameClasses(s.frameAfter, frameClassName))
  );
}

function takeMatch(
  unused: FreeSnapshotChild[],
  child: CurrentElement,
): FreeSnapshotChild | undefined {
  const matches = (e: FreeSnapshotChild) => sameClasses(e.after, child.className);
  let index = unused.findIndex((e) => e.loc === child.loc && matches(e));
  if (index < 0) index = unused.findIndex(matches);
  return index < 0 ? undefined : unused.splice(index, 1)[0];
}

function frameClassAfter(
  snapshot: FreeSnapshot,
  frame: CurrentElement,
  keepsAbsolute: boolean,
): string {
  // A child still placed absolutely needs the frame as its positioning parent, and its height.
  if (keepsAbsolute) return frame.className;
  if (sameClasses(frame.className, snapshot.frameAfter)) return snapshot.frameBefore;
  // The frame itself was edited since: only drop the `relative` turning it on added.
  if (tokens(snapshot.frameBefore).includes('relative')) return frame.className;
  return tokens(frame.className)
    .filter((c) => c !== 'relative')
    .join(' ');
}

/** The one batch that turns the frame off and gives back what was not changed since. */
export function planFreeRestore(
  snapshot: FreeSnapshot,
  frame: CurrentElement,
  children: readonly CurrentElement[],
): RestorePlan {
  const unused = [...snapshot.children];
  const childEdits: AttributeLevelEdit[] = [];
  let kept = 0;
  let keepsAbsolute = false;
  for (const child of children) {
    const match = takeMatch(unused, child);
    if (match === undefined) {
      kept += 1;
      if (tokens(child.className).includes('absolute')) keepsAbsolute = true;
    } else if (match.before !== child.className) {
      childEdits.push({
        kind: 'setClassName',
        loc: child.loc,
        tag: child.tag,
        before: child.className,
        after: match.before,
      });
    }
  }
  const edits: AttributeLevelEdit[] = [
    { kind: 'setFlag', loc: frame.loc, tag: frame.tag, name: 'data-rc-free', on: false },
  ];
  const frameAfter = frameClassAfter(snapshot, frame, keepsAbsolute);
  if (frameAfter !== frame.className) {
    edits.push({
      kind: 'setClassName',
      loc: frame.loc,
      tag: frame.tag,
      before: frame.className,
      after: frameAfter,
    });
  }
  return { edits: [...edits, ...childEdits], restored: children.length - kept, kept };
}
