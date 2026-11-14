// Pure parser and merger for composite CSS declarations: transform, filter, transition, linear-gradient, box-shadow (K9.7-2 TK-10..15).

export type CompositeKind =
  'transform' | 'filter' | 'backdrop-filter' | 'transition' | 'background-image' | 'box-shadow';

export const COMPOSITE_CSS_PROPERTY_OF: Readonly<Record<string, CompositeKind>> = {
  rotate: 'transform',
  scale: 'transform',
  translateX: 'transform',
  translateY: 'transform',
  skewX: 'transform',
  blur: 'filter',
  brightness: 'filter',
  contrast: 'filter',
  grayscale: 'filter',
  backdropBlur: 'backdrop-filter',
  transitionProperty: 'transition',
  duration: 'transition',
  ease: 'transition',
  delay: 'transition',
  backgroundImage: 'background-image',
  gradientFrom: 'background-image',
  gradientVia: 'background-image',
  gradientTo: 'background-image',
  shadowColor: 'box-shadow',
};

export function isCompositeStyleProperty(propertyId: string): boolean {
  return COMPOSITE_CSS_PROPERTY_OF[propertyId] !== undefined;
}

/** Splits input by spaces or commas at top-level (ignoring delimiters inside parentheses or quotes). */
export function splitTopLevel(input: string, mode: 'space' | 'comma'): string[] {
  const out: string[] = [];
  let depth = 0;
  let quote: string | undefined;
  let start = -1;
  for (let i = 0; i < input.length; i++) {
    const ch = input[i] ?? '';
    if (quote !== undefined) {
      if (ch === quote) quote = undefined;
    } else if (ch === '"' || ch === "'") {
      quote = ch;
    } else if (ch === '(' || ch === '[') {
      depth++;
    } else if ((ch === ')' || ch === ']') && depth > 0) {
      depth--;
    }
    const isDelim =
      depth === 0 && quote === undefined && (mode === 'comma' ? ch === ',' : /\s/.test(ch));
    if (isDelim) {
      if (start !== -1) {
        const slice = input.slice(start, i).trim();
        if (slice !== '') out.push(slice);
        start = -1;
      }
    } else if (start === -1 && (mode === 'comma' || !/\s/.test(ch))) {
      start = i;
    }
  }
  if (start !== -1) {
    const tail = input.slice(start).trim();
    if (tail !== '') out.push(tail);
  }
  return out;
}

export type CssFnCall = { readonly name: string; readonly args: string; readonly raw: string };

export function parseFunctionList(raw: string): CssFnCall[] {
  const parts = splitTopLevel(raw.trim(), 'space');
  const calls: CssFnCall[] = [];
  for (const part of parts) {
    const open = part.indexOf('(');
    if (open <= 0 || !part.endsWith(')')) continue;
    calls.push({
      name: part.slice(0, open).trim(),
      args: part.slice(open + 1, -1).trim(),
      raw: part,
    });
  }
  return calls;
}

const FN_NAME_FOR_PROP: Readonly<Record<string, string>> = {
  rotate: 'rotate',
  scale: 'scale',
  translateX: 'translateX',
  translateY: 'translateY',
  skewX: 'skewX',
  blur: 'blur',
  brightness: 'brightness',
  contrast: 'contrast',
  grayscale: 'grayscale',
  backdropBlur: 'blur',
};

function formatFnValue(propId: string, val: string): string {
  const v = val.trim();
  if ((propId === 'rotate' || propId === 'skewX') && /^-?\d+(\.\d+)?$/.test(v)) {
    return `${v}deg`;
  }
  if ((propId === 'translateX' || propId === 'translateY') && /^-?\d+(\.\d+)?$/.test(v)) {
    return `${v}px`;
  }
  if ((propId === 'blur' || propId === 'backdropBlur') && /^\d+(\.\d+)?$/.test(v)) {
    return `${v}px`;
  }
  return v;
}

function mergeFunctionCallList(
  existing: string | undefined,
  propId: string,
  nextVal: string | undefined,
): string | undefined {
  const fnName = FN_NAME_FOR_PROP[propId];
  if (fnName === undefined) return nextVal;
  const trimmed = existing?.trim() ?? '';
  const list = trimmed === '' || trimmed === 'none' ? [] : parseFunctionList(trimmed);
  const idx = list.findIndex((item) => item.name === fnName);
  const cleaned = nextVal?.trim() ?? '';
  if (cleaned === '' || cleaned === 'none') {
    const filtered = list.filter((_, i) => i !== idx);
    return filtered.length === 0
      ? undefined
      : filtered.map((c) => `${c.name}(${c.args})`).join(' ');
  }
  const inner =
    cleaned.startsWith(`${fnName}(`) && cleaned.endsWith(')')
      ? cleaned.slice(fnName.length + 1, -1).trim()
      : cleaned;
  const formattedArgs = formatFnValue(propId, inner);
  const entry: CssFnCall = {
    name: fnName,
    args: formattedArgs,
    raw: `${fnName}(${formattedArgs})`,
  };
  const nextList = idx >= 0 ? list.map((c, i) => (i === idx ? entry : c)) : [...list, entry];
  return nextList.map((c) => `${c.name}(${c.args})`).join(' ');
}

const TIME_RE = /^-?\d*\.?\d+(ms|s)$/;
const EASE_KEYWORDS = new Set(['linear', 'ease', 'ease-in', 'ease-out', 'ease-in-out']);

function isEaseToken(tok: string): boolean {
  return EASE_KEYWORDS.has(tok) || tok.startsWith('cubic-bezier(') || tok.startsWith('steps(');
}

type TransitionParts = {
  property?: string | undefined;
  duration?: string | undefined;
  ease?: string | undefined;
  delay?: string | undefined;
};

function parseTransitionLayer(raw: string): TransitionParts {
  const tokens = splitTopLevel(raw, 'space');
  const parts: TransitionParts = {};
  for (const tok of tokens) {
    if (TIME_RE.test(tok)) {
      if (parts.duration === undefined) parts.duration = tok;
      else if (parts.delay === undefined) parts.delay = tok;
    } else if (isEaseToken(tok)) {
      parts.ease = tok;
    } else if (parts.property === undefined) {
      parts.property = tok;
    }
  }
  return parts;
}

function formatTransitionParts(parts: TransitionParts): string | undefined {
  const out = [parts.property, parts.duration, parts.ease, parts.delay].filter(
    (x): x is string => x !== undefined && x !== '',
  );
  return out.length === 0 ? undefined : out.join(' ');
}

function mergeTransitionValue(
  existing: string | undefined,
  propId: string,
  nextVal: string | undefined,
): string | undefined {
  const layers =
    existing !== undefined && existing.trim() !== '' ? splitTopLevel(existing, 'comma') : [];
  const firstLayer = layers[0] ?? '';
  const parts = parseTransitionLayer(firstLayer);
  const cleaned = nextVal?.trim();
  const val = cleaned === undefined || cleaned === '' ? undefined : cleaned;
  if (propId === 'transitionProperty') parts.property = val;
  else if (propId === 'duration') {
    parts.duration = val !== undefined && /^\d+(\.\d+)?$/.test(val) ? `${val}ms` : val;
  } else if (propId === 'ease') parts.ease = val;
  else if (propId === 'delay') {
    parts.delay = val !== undefined && /^\d+(\.\d+)?$/.test(val) ? `${val}ms` : val;
  }
  if (parts.duration === undefined && parts.delay !== undefined) parts.duration = '0ms';
  if (
    parts.property === undefined &&
    (parts.duration !== undefined || parts.ease !== undefined || parts.delay !== undefined)
  ) {
    parts.property = 'all';
  }
  const mergedFirst = formatTransitionParts(parts);
  const rest = layers.slice(1);
  const all = [mergedFirst, ...rest].filter((x): x is string => x !== undefined && x !== '');
  return all.length === 0 ? undefined : all.join(', ');
}

type GradientParts = {
  direction: string;
  stops: string[];
};

function isGradientDirection(arg: string): boolean {
  const t = arg.trim();
  return t.startsWith('to ') || /^-?\d*\.?\d+(deg|rad|grad|turn)$/.test(t);
}

function parseLinearGradient(raw: string): GradientParts | undefined {
  const open = raw.indexOf('linear-gradient(');
  if (open < 0) return undefined;
  let depth = 0;
  let end = -1;
  for (let i = open + 'linear-gradient('.length - 1; i < raw.length; i++) {
    const ch = raw[i];
    if (ch === '(') depth++;
    else if (ch === ')') {
      depth--;
      if (depth === 0) {
        end = i;
        break;
      }
    }
  }
  if (end < 0) return undefined;
  const inner = raw.slice(open + 'linear-gradient('.length, end);
  const args = splitTopLevel(inner, 'comma');
  if (args.length === 0) return undefined;
  const first = args[0] ?? '';
  if (isGradientDirection(first)) {
    return { direction: first, stops: args.slice(1) };
  }
  return { direction: 'to bottom', stops: args };
}

function normalizeDirection(dir: string): string {
  const map: Readonly<Record<string, string>> = {
    'linear-to-t': 'to top',
    'linear-to-tr': 'to top right',
    'linear-to-r': 'to right',
    'linear-to-br': 'to bottom right',
    'linear-to-b': 'to bottom',
    'linear-to-bl': 'to bottom left',
    'linear-to-l': 'to left',
    'linear-to-tl': 'to top left',
  };
  return map[dir] ?? dir;
}

function mergeGradientValue(
  existing: string | undefined,
  propId: string,
  nextVal: string | undefined,
): string | undefined {
  const cleaned = nextVal?.trim();
  if (
    propId === 'backgroundImage' &&
    (cleaned === undefined || cleaned === '' || cleaned === 'none')
  ) {
    return undefined;
  }
  const parsed = existing !== undefined ? parseLinearGradient(existing) : undefined;
  const dir = parsed?.direction ?? 'to right';
  const stops = parsed?.stops ?? [];
  let from = stops[0] ?? '#2563eb';
  let via = stops.length >= 3 ? stops[1] : undefined;
  let to = stops.length >= 2 ? (stops[stops.length - 1] ?? '#9333ea') : '#9333ea';
  if (propId === 'backgroundImage' && cleaned !== undefined) {
    const nextDir = normalizeDirection(cleaned);
    const ordered = [from, via, to].filter((s): s is string => s !== undefined && s !== '');
    return `linear-gradient(${nextDir}, ${ordered.join(', ')})`;
  }
  if (propId === 'gradientFrom') from = cleaned ?? '#2563eb';
  else if (propId === 'gradientVia') via = cleaned === '' ? undefined : cleaned;
  else if (propId === 'gradientTo') to = cleaned ?? '#9333ea';
  const ordered = [from, via, to].filter((s): s is string => s !== undefined && s !== '');
  return `linear-gradient(${dir}, ${ordered.join(', ')})`;
}

function mergeShadowColor(
  existing: string | undefined,
  nextColor: string | undefined,
): string | undefined {
  const color = nextColor?.trim() ?? '';
  if (color === '') return existing;
  const trimmed = existing?.trim() ?? '';
  if (trimmed === '' || trimmed === 'none') {
    return `0 10px 15px -3px ${color}`;
  }
  const layers = splitTopLevel(trimmed, 'comma');
  const updated = layers.map((layer) => {
    const parts = splitTopLevel(layer, 'space');
    const last = parts[parts.length - 1] ?? '';
    const looksLikeColor =
      last.startsWith('#') ||
      last.startsWith('rgb') ||
      last.startsWith('hsl') ||
      last.startsWith('oklch') ||
      last.startsWith('var(') ||
      /^[a-z]+$/.test(last);
    const base = looksLikeColor ? parts.slice(0, -1) : parts;
    return base.length === 0 ? `0 10px 15px -3px ${color}` : `${base.join(' ')} ${color}`;
  });
  return updated.join(', ');
}

export function extractCompositeSubValue(
  propertyId: string,
  declarationValue: string | undefined,
): string | undefined {
  if (declarationValue === undefined) return undefined;
  const trimmed = declarationValue.trim();
  if (trimmed === '' || trimmed === 'none') return undefined;
  const kind = COMPOSITE_CSS_PROPERTY_OF[propertyId];
  if (kind === 'transform' || kind === 'filter' || kind === 'backdrop-filter') {
    const fnName = FN_NAME_FOR_PROP[propertyId];
    return parseFunctionList(trimmed).find((c) => c.name === fnName)?.args;
  }
  if (kind === 'transition') {
    const first = splitTopLevel(trimmed, 'comma')[0] ?? '';
    const parts = parseTransitionLayer(first);
    if (propertyId === 'transitionProperty') return parts.property;
    if (propertyId === 'duration') return parts.duration;
    if (propertyId === 'ease') return parts.ease;
    return parts.delay;
  }
  if (kind === 'background-image') {
    const grad = parseLinearGradient(trimmed);
    if (grad === undefined) return undefined;
    if (propertyId === 'backgroundImage') return grad.direction;
    if (propertyId === 'gradientFrom') return grad.stops[0];
    if (propertyId === 'gradientVia') return grad.stops.length >= 3 ? grad.stops[1] : undefined;
    return grad.stops.length >= 2 ? grad.stops[grad.stops.length - 1] : undefined;
  }
  if (kind === 'box-shadow') {
    const first = splitTopLevel(trimmed, 'comma')[0] ?? '';
    const parts = splitTopLevel(first, 'space');
    return parts[parts.length - 1];
  }
  return undefined;
}

export function mergeCompositeCssDeclaration(
  propertyId: string,
  existingDeclaration: string | undefined,
  nextSubValue: string | undefined,
): string | undefined {
  const kind = COMPOSITE_CSS_PROPERTY_OF[propertyId];
  if (kind === 'transform' || kind === 'filter' || kind === 'backdrop-filter') {
    return mergeFunctionCallList(existingDeclaration, propertyId, nextSubValue);
  }
  if (kind === 'transition') {
    return mergeTransitionValue(existingDeclaration, propertyId, nextSubValue);
  }
  if (kind === 'background-image') {
    return mergeGradientValue(existingDeclaration, propertyId, nextSubValue);
  }
  if (kind === 'box-shadow') {
    return mergeShadowColor(existingDeclaration, nextSubValue);
  }
  return nextSubValue;
}
