// Lazy loader and JSX/SVG attribute helpers for offline Lucide icons (K9.7-2 TK-6).
import { SVG_ALLOWED_TAGS, type SvgAllowedTag, type SvgNodeItem } from '@kumicraft/shared';

export type IconNode = readonly SvgNodeItem[];

export type IconEntry = {
  readonly name: string;
  readonly node: IconNode;
};

const SVG_ALLOWED_TAG_SET: ReadonlySet<string> = new Set(SVG_ALLOWED_TAGS);

const KEBAB_TO_JSX_ATTR: Readonly<Record<string, string>> = {
  'stroke-width': 'strokeWidth',
  'stroke-linecap': 'strokeLinecap',
  'stroke-linejoin': 'strokeLinejoin',
  'stroke-dasharray': 'strokeDasharray',
  'stroke-dashoffset': 'strokeDashoffset',
  'stroke-miterlimit': 'strokeMiterlimit',
  'stroke-opacity': 'strokeOpacity',
  'fill-rule': 'fillRule',
  'clip-rule': 'clipRule',
  'fill-opacity': 'fillOpacity',
};

let cachedIcons: readonly IconEntry[] | undefined;

function isPlainObject(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === 'object' && Boolean(value) && !Array.isArray(value);
}

function isSvgAllowedTag(tag: string): tag is SvgAllowedTag {
  return SVG_ALLOWED_TAG_SET.has(tag);
}

function parseSvgNode(raw: unknown): IconNode | undefined {
  if (!Array.isArray(raw) || raw.length === 0) return undefined;
  const out: SvgNodeItem[] = [];
  for (const item of raw) {
    if (!Array.isArray(item) || item.length < 2) return undefined;
    const rawTag: unknown = item[0];
    const rawAttrs: unknown = item[1];
    if (typeof rawTag !== 'string' || !isSvgAllowedTag(rawTag)) return undefined;
    if (!isPlainObject(rawAttrs)) return undefined;
    const attrs: Record<string, string | number> = {};
    for (const [k, v] of Object.entries(rawAttrs)) {
      if (k === 'key') continue;
      if (typeof v === 'string' || typeof v === 'number') {
        attrs[k] = v;
      }
    }
    out.push([rawTag, attrs]);
  }
  return out;
}

function parseIconsPayload(raw: unknown): readonly IconEntry[] {
  const payload = isPlainObject(raw) && 'default' in raw ? raw['default'] : raw;
  if (!isPlainObject(payload) || !Array.isArray(payload['icons'])) return [];
  const entries: IconEntry[] = [];
  for (const row of payload['icons']) {
    if (!Array.isArray(row) || row.length < 2) continue;
    const name: unknown = row[0];
    const node = parseSvgNode(row[1]);
    if (typeof name !== 'string' || !/^[a-z0-9-]+$/.test(name) || node === undefined) continue;
    entries.push({ name, node });
  }
  return entries;
}

/** Dynamically imports icons.generated.json ONLY on first call so main bundle stays small. */
export async function loadOfflineIcons(): Promise<readonly IconEntry[]> {
  if (cachedIcons !== undefined) return cachedIcons;
  const mod: unknown = await import('./icons.generated.json');
  const parsed = parseIconsPayload(mod);
  cachedIcons = parsed;
  return parsed;
}

export function resetIconCacheForTest(): void {
  cachedIcons = undefined;
}

export function toJsxSvgAttrName(attr: string): string {
  return KEBAB_TO_JSX_ATTR[attr] ?? attr;
}

export function toJsxSvgAttrs(
  attrs: Readonly<Record<string, string | number>>,
): Record<string, string | number> {
  const out: Record<string, string | number> = {};
  for (const [key, value] of Object.entries(attrs)) {
    if (key === 'key') continue;
    out[toJsxSvgAttrName(key)] = value;
  }
  return out;
}

function escapeXmlAttr(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
}

function renderChildNodeJsx(item: SvgNodeItem, indent: string): string {
  const [tag, attrs] = item;
  const attrParts: string[] = [];
  for (const [rawKey, rawVal] of Object.entries(attrs)) {
    if (rawKey === 'key') continue;
    const key = toJsxSvgAttrName(rawKey);
    attrParts.push(`${key}="${escapeXmlAttr(String(rawVal))}"`);
  }
  const attrText = attrParts.length > 0 ? ` ${attrParts.join(' ')}` : '';
  return `${indent}<${tag}${attrText} />`;
}

export function buildIconJsx(
  icon: IconEntry,
  opts?: { readonly size?: number; readonly strokeWidth?: number },
): string {
  const size = opts?.size ?? 24;
  const strokeWidth = opts?.strokeWidth ?? 2;
  const children = icon.node.map((node) => renderChildNodeJsx(node, '  ')).join('\n');
  return [
    `<svg width="${String(size)}" height="${String(size)}" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="${String(strokeWidth)}" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" data-icon="${icon.name}">`,
    children,
    '</svg>',
  ].join('\n');
}
