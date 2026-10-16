export const CODE = String.raw`(?:R-[A-Z]{2}-\d{2}|V-\d{2,3}|S-\d{2,3}[a-z]?|AC-\d{2})`;

const TAG_REGEX = new RegExp(String.raw`\[(${CODE}(?:,\s*${CODE})*)\]`, 'g');

export function readTags(text) {
  const result = [];
  for (const tag of text.matchAll(TAG_REGEX)) {
    for (const code of tag[1].split(/,\s*/)) {
      result.push(code);
    }
  }
  return result;
}
