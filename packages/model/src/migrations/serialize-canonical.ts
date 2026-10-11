// Canonical JSON of workspace files (SPEC-04.1 R-DS-07 to R-DS-10): writing the same document twice
// gives byte-identical files, so Git diffs show real changes only.
import type { z } from 'zod';

import {
  DataSourceCatalogSchema,
  DesignTokensSchema,
  PageSchema,
  UserComponentSchema,
  WorkspaceMetaSchema,
} from '../schema/document.schema.ts';
import { RESPONSIVE_KEYS } from '../schema/primitives.schema.ts';

/** The JSON files of a workspace (ADR-BE-11) and their schemas. */
export const FILE_SCHEMAS = {
  workspace: WorkspaceMetaSchema,
  tokens: DesignTokensSchema,
  page: PageSchema,
  component: UserComponentSchema,
  dataSources: DataSourceCatalogSchema,
} as const;
export type WorkspaceFileKind = keyof typeof FILE_SCHEMAS;
export type WorkspaceFileValue<K extends WorkspaceFileKind> = z.infer<(typeof FILE_SCHEMAS)[K]>;

/** Properties whose value is a `Record`: keys sorted alphabetically (R-DS-08). */
const RECORD_PROPERTIES = new Set(['propValues', 'slots', 'bindings', 'states', 'params']);
const TOKEN_GROUPS_FILE = 'tokens';
const RESPONSIVE_ORDER = new Map<string, number>(RESPONSIVE_KEYS.map((key, i) => [key, i]));

const byName = ([a]: [string, unknown], [b]: [string, unknown]) => (a < b ? -1 : a > b ? 1 : 0);
const byBreakpoint = ([a]: [string, unknown], [b]: [string, unknown]) =>
  (RESPONSIVE_ORDER.get(a) ?? 99) - (RESPONSIVE_ORDER.get(b) ?? 99);

/**
 * Sorts the keys of Record values. Other objects keep their key order, which after parsing is the
 * declaration order of the schema (R-DS-07).
 */
function sortRecords(value: unknown, property: string | undefined, isTokenGroup: boolean): unknown {
  if (Array.isArray(value)) return value.map((item) => sortRecords(item, undefined, false));
  if (!(value instanceof Object)) return value;
  let entries = Object.entries(value).map(([key, item]): [string, unknown] => [
    key,
    sortRecords(item, key, false),
  ]);
  if (property === 'responsive') entries = entries.sort(byBreakpoint);
  else if (isTokenGroup || (property !== undefined && RECORD_PROPERTIES.has(property)))
    entries = entries.sort(byName);
  return Object.fromEntries(entries);
}

function sortTokenGroups(tokens: object): object {
  return Object.fromEntries(
    Object.entries(tokens).map(([group, entries]) => [
      group,
      sortRecords(entries, group, group !== 'schemaVersion'),
    ]),
  );
}

/**
 * Serializes one workspace file in canonical form: fields in schema order, Record keys sorted,
 * 2-space indent, LF line ends, final newline, no BOM (R-DS-07 to R-DS-09).
 *
 * @throws Error when `value` does not match the schema of `kind`; only valid data is written.
 */
export function serializeCanonical<K extends WorkspaceFileKind>(
  kind: K,
  value: WorkspaceFileValue<K>,
): string {
  const parsed = FILE_SCHEMAS[kind].safeParse(value);
  if (!parsed.success) {
    throw new Error(
      `Refusing to write an invalid ${kind} file: ${parsed.error.issues[0]?.message ?? ''}`,
    );
  }
  const ordered =
    kind === TOKEN_GROUPS_FILE
      ? sortTokenGroups(parsed.data)
      : sortRecords(parsed.data, undefined, false);
  return `${JSON.stringify(ordered, undefined, 2)}\n`;
}
