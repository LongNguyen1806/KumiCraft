// Renders the neutral tree as HTML, exactly as React's renderToStaticMarkup writes the same JSX
// (03b section 2.3): Vue templates, Razor views and plain HTML pages use it.
import type { TreeAttr, TreeElement, TreeNode } from './tree.ts';

/** Elements written without a closing tag (`<br/>`, as React writes them). */
export const VOID_TAGS: ReadonlySet<string> = new Set([
  'area',
  'base',
  'br',
  'col',
  'embed',
  'hr',
  'img',
  'input',
  'link',
  'meta',
  'source',
  'track',
  'wbr',
]);

/** JSX names whose HTML attribute differs (React's property to attribute table). */
const ATTR_NAMES: Readonly<Record<string, string>> = {
  className: 'class',
  htmlFor: 'for',
  tabIndex: 'tabindex',
  readOnly: 'readonly',
  maxLength: 'maxlength',
  minLength: 'minlength',
  autoComplete: 'autocomplete',
  autoFocus: 'autofocus',
  colSpan: 'colspan',
  rowSpan: 'rowspan',
  srcSet: 'srcset',
  crossOrigin: 'crossorigin',
  encType: 'enctype',
  inputMode: 'inputmode',
  spellCheck: 'spellcheck',
  autoPlay: 'autoplay',
  playsInline: 'playsinline',
  noValidate: 'novalidate',
  formNoValidate: 'formnovalidate',
  dateTime: 'datetime',
  enterKeyHint: 'enterkeyhint',
  referrerPolicy: 'referrerpolicy',
  strokeWidth: 'stroke-width',
  strokeLinecap: 'stroke-linecap',
  strokeLinejoin: 'stroke-linejoin',
  strokeDasharray: 'stroke-dasharray',
  strokeDashoffset: 'stroke-dashoffset',
  strokeMiterlimit: 'stroke-miterlimit',
  strokeOpacity: 'stroke-opacity',
  fillRule: 'fill-rule',
  fillOpacity: 'fill-opacity',
  clipRule: 'clip-rule',
  clipPath: 'clip-path',
  stopColor: 'stop-color',
  stopOpacity: 'stop-opacity',
  textAnchor: 'text-anchor',
  dominantBaseline: 'dominant-baseline',
  fontSize: 'font-size',
  fontWeight: 'font-weight',
  fontFamily: 'font-family',
};

/** Attributes React writes as `name=""` when true and leaves out when false. */
const BOOLEAN_ATTRS: ReadonlySet<string> = new Set([
  'allowFullScreen',
  'async',
  'autoFocus',
  'autoPlay',
  'checked',
  'controls',
  'default',
  'defer',
  'disabled',
  'formNoValidate',
  'hidden',
  'loop',
  'multiple',
  'muted',
  'noValidate',
  'open',
  'playsInline',
  'readOnly',
  'required',
  'reversed',
  'selected',
]);

/** React's escapeTextForBrowser. */
export function escapeHtml(text: string): string {
  return text
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#x27;');
}

export function htmlAttrName(jsxName: string): string {
  return ATTR_NAMES[jsxName] ?? jsxName;
}

/** The attribute as React writes it, or undefined when React leaves it out. */
export function htmlAttr(attr: TreeAttr): string | undefined {
  const name = htmlAttrName(attr.name);
  const v = attr.value;
  if (v.kind === 'string') return `${name}="${escapeHtml(v.value)}"`;
  if (v.kind === 'number') return `${name}="${String(v.value)}"`;
  if (BOOLEAN_ATTRS.has(attr.name)) return v.value ? `${name}=""` : undefined;
  if (/^(aria|data)-/.test(attr.name)) return `${name}="${String(v.value)}"`;
  return undefined;
}

const INPUT_LATE = new Set(['name', 'checked', 'defaultChecked', 'value', 'defaultValue']);

/**
 * React writes an input's `name`, then `checked`, then `value` after its other attributes, and
 * `defaultChecked` / `defaultValue` as `checked` / `value` (ReactFizzConfigDOM pushInput).
 */
function inputAttrs(attrs: readonly TreeAttr[]): TreeAttr[] {
  const find = (name: string) => attrs.find((a) => a.name === name);
  const checked = find('checked') ?? find('defaultChecked');
  const value = find('value') ?? find('defaultValue');
  const late = [
    find('name'),
    checked === undefined ? undefined : { ...checked, name: 'checked' },
    value === undefined ? undefined : { ...value, name: 'value' },
  ].filter((a): a is TreeAttr => a !== undefined);
  return [...attrs.filter((a) => !INPUT_LATE.has(a.name)), ...late];
}

/** The attributes of an element, in React's order and form (`name="value"`). */
export function htmlAttrs(el: TreeElement): string[] {
  let attrs = el.attrs;
  if (el.tag === 'input') attrs = inputAttrs(el.attrs);
  if (el.tag === 'textarea') attrs = el.attrs.filter((a) => !TEXTAREA_VALUE.has(a.name));
  return attrs.map(htmlAttr).filter((a): a is string => a !== undefined);
}

const TEXTAREA_VALUE = new Set(['value', 'defaultValue']);

/** React writes a textarea's `value` / `defaultValue` as its text, not as an attribute. */
export function contentOf(el: TreeElement): readonly TreeNode[] {
  if (el.tag !== 'textarea') return el.children;
  const value =
    el.attrs.find((a) => a.name === 'value') ?? el.attrs.find((a) => a.name === 'defaultValue');
  if (value === undefined || value.value.kind === 'boolean') return el.children;
  return [{ kind: 'text', value: String(value.value.value) }];
}

function renderElement(el: TreeElement): string {
  const attrs = htmlAttrs(el)
    .map((a) => ` ${a}`)
    .join('');
  if (VOID_TAGS.has(el.tag)) return `<${el.tag}${attrs}/>`;
  return `<${el.tag}${attrs}>${renderHtml(contentOf(el))}</${el.tag}>`;
}

export function renderHtml(nodes: readonly TreeNode[]): string {
  return nodes.map((n) => (n.kind === 'text' ? escapeHtml(n.value) : renderElement(n))).join('');
}
