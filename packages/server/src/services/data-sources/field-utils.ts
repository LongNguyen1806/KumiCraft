// Shared field naming and heuristic helpers for Data Sources (TK-33, TK-34).
import type { DataFieldType } from '@kumicraft/shared';

export function humanizeFieldName(name: string): string {
  const spaced = name
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/[_-]+/g, ' ')
    .trim();
  return spaced.length === 0 ? name : `${spaced.charAt(0).toUpperCase()}${spaced.slice(1)}`;
}

export function inferTextFieldType(name: string): DataFieldType {
  const lower = name.toLowerCase();
  if (lower.includes('email')) return 'email';
  if (lower.includes('password') || lower.includes('passwd')) return 'password';
  if (
    lower.includes('url') ||
    lower.includes('website') ||
    lower === 'link' ||
    lower === 'avatar'
  ) {
    return 'url';
  }
  if (lower.endsWith('at') || lower.includes('datetime') || lower.includes('timestamp')) {
    return 'datetime';
  }
  if (lower.includes('date') || lower.includes('birthday')) return 'date';
  if (
    lower.includes('description') ||
    lower.includes('bio') ||
    lower.includes('notes') ||
    lower.includes('message') ||
    lower.includes('summary')
  ) {
    return 'textarea';
  }
  return 'text';
}

export function normalizeFieldType(raw: string, fieldName: string): DataFieldType {
  switch (raw) {
    case 'email':
    case 'number':
    case 'date':
    case 'datetime':
    case 'boolean':
    case 'select':
    case 'textarea':
    case 'url':
    case 'password':
      return raw;
    default:
      return inferTextFieldType(fieldName);
  }
}
