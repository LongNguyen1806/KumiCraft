// Shared steps of the MCP edit tools (R-AG-19, round 7b): read an element before changing it, so
// each edit carries the tag and the current value the server checks (R-SE-02), and turn a simple
// "where" into the server's insert target.
import { type ElementSource, ElementSourceSchema, type InsertTarget } from '@kumicraft/shared';
import { z } from 'zod';

import type { ApiClient, ApiResult } from './api-client.ts';

export const LocSchema = z
  .string()
  .min(1)
  .describe('file:line:column of an element, as kumicraft_get_page_tree returns');

export const WHERE = ['before', 'after', 'inside-start', 'inside-end'] as const;

export const TargetSchema = z.strictObject({
  loc: LocSchema,
  where: z
    .enum(WHERE)
    .describe(
      'before/after: next to that element; inside-start/inside-end: as its first/last child',
    ),
});
export type Target = z.infer<typeof TargetSchema>;

export type Read<T> =
  { readonly ok: true; readonly value: T } | { readonly ok: false; readonly message: string };

export async function readElement(api: ApiClient, loc: string): Promise<Read<ElementSource>> {
  const result = await api.get('source/element', { loc });
  if (!result.ok) return result;
  const parsed = ElementSourceSchema.safeParse(result.data);
  if (!parsed.success)
    return { ok: false, message: 'E013: KumiCraft sent an element it could not read.' };
  return { ok: true, value: parsed.data };
}

/** The guards of several elements, read in order; the first failure stops. */
export async function readGuards(
  api: ApiClient,
  locs: readonly string[],
): Promise<Read<{ loc: string; tag: string }[]>> {
  const guards: { loc: string; tag: string }[] = [];
  for (const loc of locs) {
    const element = await readElement(api, loc);
    if (!element.ok) return element;
    guards.push({ loc, tag: element.value.tag });
  }
  return { ok: true, value: guards };
}

export async function insertTarget(api: ApiClient, target: Target): Promise<Read<InsertTarget>> {
  const element = await readElement(api, target.loc);
  if (!element.ok) return element;
  const guard = { loc: target.loc, tag: element.value.tag };
  if (target.where === 'before' || target.where === 'after') {
    return { ok: true, value: { kind: 'sibling', ref: guard, where: target.where } };
  }
  const where = target.where === 'inside-start' ? 'start' : 'end';
  return { ok: true, value: { kind: 'child', parent: guard, where } };
}

/** One edit through POST /source/edits: one history step the Studio can undo (R-HI-01). */
export function applyEdit(api: ApiClient, edit: unknown): Promise<ApiResult> {
  return api.post('source/edits', { edit });
}

export const cannot = (message: string): ApiResult => ({ ok: false, message });
