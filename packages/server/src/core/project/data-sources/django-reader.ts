// Static checked-regex parser for Django models.py (TK-33): never runs Python code.
import type { DataField, DataFieldType, DataSourceItem } from '@kumicraft/shared';

import { humanizeFieldName, inferTextFieldType } from './field-utils.ts';

const CLASS_RE = /^class\s+([A-Z][A-Za-z0-9_]*)\s*\(([^)]+)\)\s*:/gm;
const FIELD_RE = /^\s{2,8}([a-z][a-z0-9_]*)\s*=\s*models\.([A-Z][A-Za-z0-9_]*)\s*\(/;
const CONST_CHOICES_RE = /^([A-Z][A-Z0-9_]*)\s*=\s*\[([\s\S]*?)\]/gm;

function extractTupleValues(block: string): readonly string[] {
  const out: string[] = [];
  const pairRe = /\(\s*['"]([^'"]+)['"]\s*,/g;
  for (const m of block.matchAll(pairRe)) {
    if (m[1]) out.push(m[1]);
  }
  return out;
}

function collectChoiceConstants(code: string): ReadonlyMap<string, readonly string[]> {
  const map = new Map<string, readonly string[]>();
  for (const m of code.matchAll(CONST_CHOICES_RE)) {
    const name = m[1];
    const body = m[2];
    if (!name || !body) continue;
    const vals = extractTupleValues(body);
    if (vals.length > 0) map.set(name, vals);
  }
  return map;
}

function extractBalancedCallArgs(
  lines: readonly string[],
  startIdx: number,
): { args: string; endIdx: number } {
  let depth = 0;
  let opened = false;
  const collected: string[] = [];
  for (let i = startIdx; i < lines.length && i < startIdx + 25; i++) {
    const line = lines[i] ?? '';
    collected.push(line);
    for (const ch of line) {
      if (ch === '(') {
        depth++;
        opened = true;
      } else if (ch === ')') {
        depth--;
      }
    }
    if (opened && depth <= 0) {
      return { args: collected.join('\n'), endIdx: i };
    }
  }
  return { args: collected.join('\n'), endIdx: startIdx };
}

function mapDjangoFieldType(djangoType: string, fieldName: string): DataFieldType {
  switch (djangoType) {
    case 'TextField':
      return 'textarea';
    case 'EmailField':
      return 'email';
    case 'URLField':
      return 'url';
    case 'IntegerField':
    case 'PositiveIntegerField':
    case 'SmallIntegerField':
    case 'BigIntegerField':
    case 'FloatField':
    case 'DecimalField':
      return 'number';
    case 'BooleanField':
    case 'NullBooleanField':
      return 'boolean';
    case 'DateField':
      return 'date';
    case 'DateTimeField':
      return 'datetime';
    default:
      return inferTextFieldType(fieldName);
  }
}

function parseDjangoField(
  name: string,
  djangoType: string,
  argsText: string,
  constants: ReadonlyMap<string, readonly string[]>,
): DataField {
  const openIdx = argsText.indexOf('(');
  const inner = openIdx >= 0 ? argsText.slice(openIdx + 1, argsText.lastIndexOf(')')) : '';

  const verboseNamed = /\bverbose_name\s*=\s*['"]([^'"]+)['"]/.exec(inner)?.[1];
  const positionalLabel = /^\s*['"]([^'"]+)['"]/.exec(inner)?.[1];
  const label = verboseNamed ?? positionalLabel ?? humanizeFieldName(name);

  const maxLenMatch = /\bmax_length\s*=\s*(\d+)/.exec(inner)?.[1];
  const maxLength = maxLenMatch !== undefined ? Number(maxLenMatch) : undefined;

  const blankTrue = /\bblank\s*=\s*True\b/.test(inner);
  const nullTrue = /\bnull\s*=\s*True\b/.test(inner);
  const required = !blankTrue && !nullTrue;

  let options: readonly string[] | undefined;
  const inlineChoices = /\bchoices\s*=\s*\[([\s\S]*?)\]/.exec(inner)?.[1];
  if (inlineChoices) {
    options = extractTupleValues(inlineChoices);
  } else {
    const constName = /\bchoices\s*=\s*([A-Z][A-Z0-9_]*)/.exec(inner)?.[1];
    if (constName) options = constants.get(constName);
  }

  const type: DataFieldType =
    options !== undefined && options.length > 0 ? 'select' : mapDjangoFieldType(djangoType, name);

  return {
    name,
    label,
    type,
    required,
    ...(options && options.length > 0 ? { options } : {}),
    ...(maxLength !== undefined && maxLength > 0 ? { maxLength } : {}),
  };
}

function collectModelRanges(code: string): readonly { name: string; startLine: number }[] {
  const models: { name: string; startLine: number }[] = [];
  for (const m of code.matchAll(CLASS_RE)) {
    const name = m[1];
    const bases = m[2] ?? '';
    if (!name || !/models\.Model|AbstractUser|Model\b/.test(bases)) continue;
    const before = code.slice(0, m.index);
    const startLine = before.split(/\r?\n/).length;
    models.push({ name, startLine });
  }
  return models;
}

export function listDjangoSourcesInFile(file: string, code: string): readonly DataSourceItem[] {
  return collectModelRanges(code).map((m) => ({
    id: `django:${file}:${m.name}`,
    kind: 'django',
    name: m.name,
    file,
    label: `${m.name} (Django)`,
  }));
}

export function readDjangoFieldsFromFile(code: string, modelName: string): readonly DataField[] {
  const models = collectModelRanges(code);
  const targetIdx = models.findIndex((m) => m.name === modelName);
  if (targetIdx < 0) return [];
  const target = models[targetIdx];
  if (!target) return [];
  const lines = code.split(/\r?\n/);
  const stopLine = models[targetIdx + 1]?.startLine ?? lines.length + 1;
  const constants = collectChoiceConstants(code);
  const fields: DataField[] = [];

  for (let i = target.startLine; i < stopLine - 1; i++) {
    const line = lines[i] ?? '';
    if (/^\S/.test(line) && line.trim().length > 0) break;
    const m = FIELD_RE.exec(line);
    if (!m?.[1] || !m[2]) continue;
    if (m[2] === 'ForeignKey' || m[2] === 'ManyToManyField' || m[2] === 'OneToOneField') continue;
    const { args, endIdx } = extractBalancedCallArgs(lines, i);
    fields.push(parseDjangoField(m[1], m[2], args, constants));
    i = endIdx;
  }
  return fields;
}
