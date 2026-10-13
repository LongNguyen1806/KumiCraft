// Turns a preset into a node tree that fits the workspace (SPEC-04.1 section 10, R-LB-02): a token
// the workspace no longer has is replaced by the default token's value, or left out when the
// property has no plain-value form (shadow, font family).
import type { DesignTokens } from '../schema/document.schema.ts';
import type { DesignNode } from '../schema/node.schema.ts';
import { createDefaultTokens } from '../tokens/default-tokens.ts';
import type { Preset, PresetContext } from './types.ts';

export type InstantiatedPreset = {
  readonly node: DesignNode;
  /** Token references that were replaced or dropped, for a warning in the Studio. */
  readonly replacedTokens: readonly string[];
};

const TOKEN_REF = /^token:([A-Za-z]+)\.(.+)$/;
const DEFAULT_TOKENS = createDefaultTokens();

type Fallback = { readonly keep: true; readonly value: unknown } | { readonly keep: false };

function tokenEntry(tokens: DesignTokens, group: string, name: string): unknown {
  const groups = tokens as unknown as Readonly<
    Record<string, Readonly<Record<string, { readonly value: unknown }>> | undefined>
  >;
  return groups[group]?.[name]?.value;
}

/** The plain value a style property accepts in place of a token of `group`. */
function plainValue(group: string, value: unknown): Fallback {
  switch (group) {
    case 'color':
    case 'spacing':
    case 'radius':
    case 'fontWeight':
    case 'lineHeight':
      return { keep: true, value };
    case 'fontSize':
      return { keep: true, value: (value as { readonly size: unknown }).size };
    default:
      return { keep: false };
  }
}

function replaceMissing(value: unknown, tokens: DesignTokens, replaced: string[]): unknown {
  if (Array.isArray(value)) return value.map((item) => replaceMissing(item, tokens, replaced));
  if (value instanceof Object) {
    const out: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(value)) {
      const next = replaceMissing(item, tokens, replaced);
      if (next !== undefined) out[key] = next;
    }
    return out;
  }
  const match = typeof value === 'string' ? (TOKEN_REF.exec(value) ?? undefined) : undefined;
  if (match === undefined) return value;
  const [, group = '', name = ''] = match;
  if (tokenEntry(tokens, group, name) !== undefined) return value;
  replaced.push(String(value));
  const fallback = tokenEntry(DEFAULT_TOKENS, group, name);
  if (fallback === undefined) return undefined;
  const plain = plainValue(group, fallback);
  return plain.keep ? plain.value : undefined;
}

/** `preset.create` plus R-LB-02, for the tokens the workspace has now. */
export function instantiatePreset(preset: Preset, context: PresetContext = {}): InstantiatedPreset {
  const node = preset.create(context);
  if (context.tokens === undefined) return { node, replacedTokens: [] };
  const replacedTokens: string[] = [];
  const fitted = replaceMissing(node, context.tokens, replacedTokens) as DesignNode;
  return { node: fitted, replacedTokens };
}
