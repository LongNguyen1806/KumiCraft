// A block as Pug written for a person (03d section 3.2): classes as `.shorthand`, attributes as
// `name="value"`, a lone text on the tag's line. Pug then writes the same HTML as `renderHtml`
// (and `renderPug`, its exact but harder to read twin).
import { decodeEntities } from './entities.ts';
import { contentOf, escapeHtml, htmlAttrs, VOID_TAGS } from './render-html.ts';
import type { TreeElement, TreeNode } from './tree.ts';

/** A class Pug's `.name` shorthand can write (no `:`, `/`, `[`… as Tailwind variants have). */
const SHORTHAND = /^-?[_a-zA-Z][_a-zA-Z0-9-]*$/;

/** Text Pug puts out as written: markup escaped, interpolation markers too. */
function pugText(value: string): string {
  return escapeHtml(value).replaceAll('#{', '\\#{').replaceAll('#[', '\\#[');
}

/** `name="value"` as Pug writes it; `!=` (not escaped again) when Pug's escaping would differ. */
function pugAttr(html: string): string {
  const eq = html.indexOf('=');
  const name = html.slice(0, eq);
  const escaped = html.slice(eq + 2, -1);
  const raw = decodeEntities(escaped);
  // Pug escapes & < > " like React; React also escapes ' and writes empty booleans as "".
  if (raw === '' || raw.includes("'") || escapeHtml(raw) !== escaped) {
    return `${name}!=${JSON.stringify(escaped)}`;
  }
  return `${name}=${JSON.stringify(raw)}`;
}

function headOf(el: TreeElement): string {
  const attrs = htmlAttrs(el);
  const cls = attrs.find((a) => a.startsWith('class="'));
  const classes = cls === undefined ? [] : decodeEntities(cls.slice(7, -1)).split(/\s+/);
  const shorthand = classes.length > 0 && classes.every((c) => SHORTHAND.test(c));
  const rest = attrs.filter((a) => !(shorthand && a === cls)).map(pugAttr);
  const dots = shorthand ? classes.map((c) => `.${c}`).join('') : '';
  const tag = el.tag === 'div' && dots !== '' ? '' : el.tag;
  return `${tag}${dots}${rest.length > 0 ? `(${rest.join(', ')})` : ''}`;
}

function renderElement(el: TreeElement, indent: string, unit: string): string[] {
  const head = `${indent}${headOf(el)}`;
  if (VOID_TAGS.has(el.tag)) return [head];
  const content = contentOf(el);
  const only = content[0];
  if (content.length === 1 && only?.kind === 'text' && !only.value.startsWith(' ')) {
    return [`${head} ${pugText(only.value)}`];
  }
  const inner = `${indent}${unit}`;
  return [
    head,
    ...content.flatMap((c) =>
      c.kind === 'text' ? [`${inner}| ${pugText(c.value)}`] : renderElement(c, inner, unit),
    ),
  ];
}

/** The nodes as Pug lines, each starting with `indent` (`unit` per level below). */
export function renderPugSource(nodes: readonly TreeNode[], indent = '', unit = '  '): string[] {
  return nodes.flatMap((n) =>
    n.kind === 'text' ? [`${indent}| ${pugText(n.value)}`] : renderElement(n, indent, unit),
  );
}
