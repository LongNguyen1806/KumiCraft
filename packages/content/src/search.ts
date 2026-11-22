import { LIBRARY_BLOCKS } from './blocks.ts';
import { DEFAULT_BLOCK_LABELS, expandSynonyms } from './search-synonyms.ts';
import type { LibraryBlock } from './types.ts';

export type LibraryBlockLabelsResolver = (blockId: string) => {
  readonly vi: string;
  readonly en: string;
};

export function normalizeText(text: string): string {
  return text
    .replace(/[đĐ]/g, 'd')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

function hasWholeToken(haystack: string, needle: string): boolean {
  if (needle.length === 0) return false;
  const escaped = needle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`(^|[^a-z0-9])${escaped}($|[^a-z0-9])`).test(haystack);
}

function scoreBlock(
  block: LibraryBlock,
  query: string,
  expanded: readonly string[],
  resolveLabel?: LibraryBlockLabelsResolver,
): number {
  const resolved = resolveLabel?.(block.id);
  const viLabel = normalizeText(resolved?.vi || DEFAULT_BLOCK_LABELS[block.labelKey] || '');
  const enLabel = normalizeText(resolved?.en || '');
  const labels = [viLabel, enLabel].filter((v) => v.length > 0);
  const id = normalizeText(block.id);
  const allKw = [...block.keywords.vi, ...block.keywords.en].map(normalizeText);

  let score = 0;
  if (id === query || id.endsWith(`.${query}`)) score += 120;
  if (labels.some((l) => l === query)) score += 100;
  else if (labels.some((l) => l.startsWith(query))) score += 60;
  if (allKw.includes(query)) score += 80;
  if (labels.some((l) => hasWholeToken(l, query)) || allKw.some((kw) => hasWholeToken(kw, query))) {
    score += 45;
  }
  if (
    id.includes(query) ||
    labels.some((l) => l.includes(query)) ||
    allKw.some((kw) => kw.includes(query))
  ) {
    score += 20;
  }

  for (const syn of expanded) {
    if (syn === query) continue;
    if (id === syn || id.endsWith(`.${syn}`)) score += 50;
    if (labels.some((l) => l === syn || hasWholeToken(l, syn))) score += 40;
    if (allKw.includes(syn)) score += 35;
    else if (allKw.some((kw) => kw.includes(syn))) score += 15;
  }

  const tokens = query.split(/\s+/).filter(Boolean);
  if (tokens.length > 1) {
    const combined = `${id} ${labels.join(' ')} ${allKw.join(' ')}`;
    if (tokens.every((t) => combined.includes(t))) score += 25;
  }
  return score;
}

export function searchBlocks(
  query: string,
  resolveLabel?: LibraryBlockLabelsResolver,
): readonly LibraryBlock[] {
  const normalized = normalizeText(query);
  if (normalized.length === 0) return LIBRARY_BLOCKS;
  const expanded = expandSynonyms(normalized);
  return LIBRARY_BLOCKS.map((block, index) => ({
    block,
    index,
    score: scoreBlock(block, normalized, expanded, resolveLabel),
  }))
    .filter((entry) => entry.score > 0)
    .sort((a, b) => (b.score !== a.score ? b.score - a.score : a.index - a.index))
    .map((entry) => entry.block);
}
