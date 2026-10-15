// JSX Text parsing, normalization, and entity decoding (R-SE-07, R-SE-08).

const NAMED_ENTITIES: Readonly<Record<string, string>> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: '\u00A0',
  copy: '\u00A9',
  reg: '\u00AE',
  trade: '\u2122',
};

/**
 * Decodes HTML entities in text (named, decimal, hex).
 */
export function decodeHtmlEntities(raw: string): string {
  return raw.replace(/&(#?[a-zA-Z0-9]+);/g, (match, entity: string) => {
    if (entity.startsWith('#x') || entity.startsWith('#X')) {
      const hex = entity.slice(2);
      const code = parseInt(hex, 16);
      return Number.isNaN(code) ? match : String.fromCodePoint(code);
    }
    if (entity.startsWith('#')) {
      const dec = entity.slice(1);
      const code = parseInt(dec, 10);
      return Number.isNaN(code) ? match : String.fromCodePoint(code);
    }
    return NAMED_ENTITIES[entity] ?? match;
  });
}

/**
 * Normalizes JSX whitespace according to JSX specification (R-SE-07):
 * - Drop lines that are whitespace-only.
 * - Trim leading and trailing whitespace from remaining lines.
 * - Join remaining lines with a single space.
 */
export function normalizeJsxWhitespace(raw: string): string {
  const lines = raw.split(/\r?\n/);
  const nonEmpty = lines.map((line) => line.trim()).filter((line) => line.length > 0);

  return nonEmpty.join(' ');
}

/**
 * Encodes text for writing into JSX body (R-SE-08):
 * - Collapse consecutive whitespace, trim ends.
 * - Encode `{` -> `&#123;`, `}` -> `&#125;`, `<` -> `&lt;`, `>` -> `&gt;`.
 * - Encode `&` that is followed by an entity pattern: `&([#a-zA-Z0-9]+;)` -> `&amp;$1`.
 */
export function encodeJsxText(text: string): string {
  const collapsed = text.replace(/\s+/g, ' ').trim();
  let result = '';

  for (let i = 0; i < collapsed.length; i++) {
    const ch = collapsed[i];
    if (ch === '{') {
      result += '&#123;';
    } else if (ch === '}') {
      result += '&#125;';
    } else if (ch === '<') {
      result += '&lt;';
    } else if (ch === '>') {
      result += '&gt;';
    } else if (ch === '&') {
      const remainder = collapsed.slice(i + 1);
      const match = remainder.match(/^[#a-zA-Z0-9]+;/);
      if (match) {
        result += '&amp;';
      } else {
        result += '&';
      }
    } else {
      result += ch ?? '';
    }
  }

  return result;
}
