// Shallow set/unset on plain objects, with the patch that undoes it.

export type Plain = Readonly<Record<string, unknown>>;

/** Copy of `object` without `keys`. */
export function omit<T extends object>(object: T, keys: Iterable<string>): T {
  const drop = new Set(keys);
  return Object.fromEntries(Object.entries(object).filter(([key]) => !drop.has(key))) as T;
}

/** Applies `set` then `unset`. Returns undefined when nothing is left, so empty objects disappear. */
export function patchObject(
  current: Plain | undefined,
  set: Plain,
  unset: readonly string[] = [],
): Record<string, unknown> | undefined {
  const removed = new Set(unset);
  for (const [key, value] of Object.entries(set)) if (value === undefined) removed.add(key);
  const next = omit({ ...current, ...set }, removed);
  return Object.keys(next).length === 0 ? undefined : next;
}

/** The patch that restores `current` after `patchObject(current, set, unset)`. */
export function inversePatch(
  current: Plain | undefined,
  set: Plain,
  unset: readonly string[] = [],
): { set: Record<string, unknown>; unset: string[] } {
  const inverse = { set: {} as Record<string, unknown>, unset: [] as string[] };
  for (const key of new Set([...Object.keys(set), ...unset])) {
    const old = current?.[key];
    if (old === undefined) inverse.unset.push(key);
    else inverse.set[key] = old;
  }
  return inverse;
}

/** Copy of `object` with `value` stored at `path`; undefined removes the last key of an object. */
export function setPath(
  object: unknown,
  path: readonly (string | number)[],
  value: unknown,
): unknown {
  const [key, ...rest] = path;
  if (key === undefined) return value;
  if (Array.isArray(object)) {
    const copy: unknown[] = [...(object as unknown[])];
    copy[Number(key)] = setPath(copy[Number(key)], rest, value);
    return copy;
  }
  const record: Plain = { ...(object as Plain | undefined) };
  const next = setPath(record[key], rest, value);
  return next === undefined ? omit(record, [String(key)]) : { ...record, [key]: next };
}

export function getPath(object: unknown, path: readonly (string | number)[]): unknown {
  let current: unknown = object;
  for (const key of path) {
    if (!(current instanceof Object)) return undefined;
    current = (current as Record<string | number, unknown>)[key];
  }
  return current;
}
