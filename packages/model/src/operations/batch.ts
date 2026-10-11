// applyBatch and assignIds (SPEC-03 section 7.4).
import { nanoid } from 'nanoid';

import { err, ok, type Result } from '../result.ts';
import type { DesignDocument } from '../schema/document.schema.ts';
import type { ValidateOptions } from '../schema/validate/validate-document.ts';
import { applyOperation, invertOperation } from './engine.ts';
import type { DesignOperation } from './operation.schema.ts';
import { validateOperation } from './validate-operation.ts';

/**
 * Applies `ops` as one unit: all of them or none (V-50).
 *
 * @returns The new document and the operations that undo the batch, already in reverse order
 *   (V-51); or E005 with `params.index` of the first invalid operation. The input document is
 *   never changed.
 */
export function applyBatch(
  document: DesignDocument,
  ops: readonly DesignOperation[],
  options: ValidateOptions = {},
): Result<{ doc: DesignDocument; inverse: readonly DesignOperation[] }> {
  let current = document;
  const inverse: DesignOperation[] = [];
  for (const [index, op] of ops.entries()) {
    const valid = validateOperation(current, op, options);
    if (!valid.ok) return err({ ...valid.error, params: { ...valid.error.params, index } });
    inverse.push(invertOperation(current, op));
    current = applyOperation(current, op);
  }
  return ok({ doc: current, inverse: inverse.reverse() });
}

/** SPEC-04.3 section 4.3: temporary ids proposed by the AI. */
export const TEMPORARY_ID = /^tmp_\d+$/;

export type IdGenerator = (kind: 'node' | 'page' | 'interaction') => string;

const randomId: IdGenerator = (kind) =>
  kind === 'node' ? `n_${nanoid(10)}` : kind === 'page' ? `p_${nanoid(10)}` : `i_${nanoid(8)}`;

/** The kind of object a temporary id names, from the object that defines it. */
function kindOf(owner: Readonly<Record<string, unknown>>): 'node' | 'page' | 'interaction' {
  if ('trigger' in owner) return 'interaction';
  if ('route' in owner) return 'page';
  return 'node';
}

function findDefinitions(value: unknown, generate: IdGenerator, idMap: Record<string, string>) {
  if (Array.isArray(value)) {
    for (const item of value) findDefinitions(item, generate, idMap);
  } else if (value instanceof Object) {
    const record = value as Readonly<Record<string, unknown>>;
    const id = record['id'];
    if (typeof id === 'string' && TEMPORARY_ID.test(id) && idMap[id] === undefined)
      idMap[id] = generate(kindOf(record));
    for (const item of Object.values(record)) findDefinitions(item, generate, idMap);
  }
}

function replaceIds(value: unknown, idMap: Readonly<Record<string, string>>): unknown {
  if (typeof value === 'string') return idMap[value] ?? value;
  if (Array.isArray(value)) return value.map((item) => replaceIds(item, idMap));
  if (value instanceof Object) {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [key, replaceIds(item, idMap)]),
    );
  }
  return value;
}

/**
 * Replaces temporary ids (`tmp_1`, `tmp_2`…) with system ids and updates every reference in the
 * batch, including interaction targets and navigation to new pages.
 *
 * @param generate - Id source; random by default, injectable for deterministic tests.
 */
export function assignIds(
  ops: readonly DesignOperation[],
  generate: IdGenerator = randomId,
): { ops: readonly DesignOperation[]; idMap: Readonly<Record<string, string>> } {
  const idMap: Record<string, string> = {};
  findDefinitions(ops, generate, idMap);
  return { ops: replaceIds(ops, idMap) as DesignOperation[], idMap };
}
