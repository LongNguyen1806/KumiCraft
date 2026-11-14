// Static JSON OpenAPI reader for components.schemas / definitions (TK-33).
import type { DataField, DataFieldType, DataSourceItem } from '@kumicraft/shared';

import { humanizeFieldName, inferTextFieldType } from './field-utils.ts';

function isPlainObject(val: unknown): val is Readonly<Record<string, unknown>> {
  return typeof val === 'object' && Boolean(val) && !Array.isArray(val);
}

function readOpenApiSchemasMap(
  rawJson: string,
): Readonly<Record<string, Readonly<Record<string, unknown>>>> | undefined {
  let parsed: unknown;
  try {
    parsed = JSON.parse(rawJson);
  } catch {
    return undefined;
  }
  if (!isPlainObject(parsed)) return undefined;
  const components = isPlainObject(parsed['components']) ? parsed['components'] : undefined;
  const candidate = isPlainObject(components?.['schemas'])
    ? components['schemas']
    : isPlainObject(parsed['definitions'])
      ? parsed['definitions']
      : undefined;
  if (!candidate) return undefined;
  if (parsed['openapi'] === undefined && parsed['swagger'] === undefined) return undefined;
  const out: Record<string, Readonly<Record<string, unknown>>> = {};
  for (const [k, v] of Object.entries(candidate)) {
    if (isPlainObject(v) && isPlainObject(v['properties'])) {
      out[k] = v;
    }
  }
  return out;
}

function mapOpenApiPropType(name: string, prop: Readonly<Record<string, unknown>>): DataFieldType {
  if (Array.isArray(prop['enum']) && prop['enum'].length > 0) return 'select';
  const rawType = typeof prop['type'] === 'string' ? prop['type'] : '';
  if (rawType === 'boolean') return 'boolean';
  if (rawType === 'integer' || rawType === 'number') return 'number';
  const format = typeof prop['format'] === 'string' ? prop['format'] : '';
  if (format === 'email') return 'email';
  if (format === 'date') return 'date';
  if (format === 'date-time') return 'datetime';
  if (format === 'uri' || format === 'url') return 'url';
  if (format === 'password') return 'password';
  return inferTextFieldType(name);
}

export function listOpenApiSourcesInFile(file: string, rawJson: string): readonly DataSourceItem[] {
  const schemas = readOpenApiSchemasMap(rawJson);
  if (!schemas) return [];
  return Object.keys(schemas).map((name) => ({
    id: `openapi:${file}:${name}`,
    kind: 'openapi',
    name,
    file,
    label: `${name} (OpenAPI)`,
  }));
}

export function readOpenApiFieldsFromFile(
  rawJson: string,
  schemaName: string,
): readonly DataField[] {
  const schemas = readOpenApiSchemasMap(rawJson);
  const schema = schemas?.[schemaName];
  if (!schema) return [];
  const props = isPlainObject(schema['properties']) ? schema['properties'] : undefined;
  if (!props) return [];
  const requiredSet = new Set(
    Array.isArray(schema['required'])
      ? schema['required'].filter((r): r is string => typeof r === 'string')
      : [],
  );

  const fields: DataField[] = [];
  for (const [name, rawProp] of Object.entries(props)) {
    if (!isPlainObject(rawProp)) continue;
    const type = mapOpenApiPropType(name, rawProp);
    const label =
      typeof rawProp['title'] === 'string' && rawProp['title'].length > 0
        ? rawProp['title']
        : humanizeFieldName(name);
    const options = Array.isArray(rawProp['enum'])
      ? rawProp['enum'].map(String).filter((s) => s.length > 0)
      : undefined;
    const maxLength =
      typeof rawProp['maxLength'] === 'number' && rawProp['maxLength'] > 0
        ? Math.floor(rawProp['maxLength'])
        : undefined;
    fields.push({
      name,
      label,
      type,
      required: requiredSet.has(name),
      ...(options && options.length > 0 ? { options } : {}),
      ...(maxLength !== undefined ? { maxLength } : {}),
    });
  }
  return fields;
}
