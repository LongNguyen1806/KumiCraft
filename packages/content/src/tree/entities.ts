// HTML entities in JSX text and attribute strings, decoded as the JSX compiler does. An unknown
// named entity stays as written, like in JSX.

const NAMED: Readonly<Record<string, string>> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
  copy: '©',
  reg: '®',
  trade: '™',
  mdash: '—',
  ndash: '–',
  hellip: '…',
  middot: '·',
  bull: '•',
  times: '×',
  rarr: '→',
  larr: '←',
  laquo: '«',
  raquo: '»',
  rsquo: '’',
  lsquo: '‘',
  rdquo: '”',
  ldquo: '“',
  deg: '°',
  euro: '€',
  check: '✓',
  star: '☆',
};

export function decodeEntities(text: string): string {
  return text.replace(/&(#x[0-9a-fA-F]+|#\d+|[A-Za-z]+);/g, (whole, body: string) => {
    if (body.startsWith('#x')) return String.fromCodePoint(Number.parseInt(body.slice(2), 16));
    if (body.startsWith('#')) return String.fromCodePoint(Number.parseInt(body.slice(1), 10));
    return NAMED[body] ?? whole;
  });
}
