// Accessibility & WCAG contrast hints measured from live DOM styles (TK-65).
import type { ElementA11yInfo } from '@kumicraft/shared';

interface RgbaColor {
  readonly r: number;
  readonly g: number;
  readonly b: number;
  readonly a: number;
}

const WHITE: RgbaColor = { r: 255, g: 255, b: 255, a: 1 };

function clamp01(n: number): number {
  return Math.max(0, Math.min(1, n));
}

function parseAlpha(alphaRaw: string | undefined): number | undefined {
  if (alphaRaw === undefined) return 1;
  const val = alphaRaw.endsWith('%') ? Number(alphaRaw.slice(0, -1)) / 100 : Number(alphaRaw);
  return Number.isNaN(val) ? undefined : clamp01(val);
}

function linearToSrgbByte(c: number): number {
  const clamped = clamp01(c);
  const srgb = clamped <= 0.0031308 ? 12.92 * clamped : 1.055 * Math.pow(clamped, 1 / 2.4) - 0.055;
  return clamp01(srgb) * 255;
}

function oklabToRgba(L: number, a: number, b: number, alpha: number): RgbaColor {
  const l_ = L + 0.3963377774 * a + 0.2158037573 * b;
  const m_ = L - 0.1055613458 * a - 0.0638541728 * b;
  const s_ = L - 0.0894841775 * a - 1.291485548 * b;
  const l = l_ * l_ * l_;
  const m = m_ * m_ * m_;
  const s = s_ * s_ * s_;
  return {
    r: linearToSrgbByte(4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s),
    g: linearToSrgbByte(-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s),
    b: linearToSrgbByte(-0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s),
    a: alpha,
  };
}

function parseHueDeg(raw: string): number | undefined {
  const m = /^(-?[\d.]+)(deg|rad|grad|turn)?$/.exec(raw);
  if (!m) return undefined;
  const v = Number(m[1]);
  if (Number.isNaN(v)) return undefined;
  const unit = m[2] ?? 'deg';
  if (unit === 'rad') return (v * 180) / Math.PI;
  if (unit === 'grad') return v * 0.9;
  if (unit === 'turn') return v * 360;
  return v;
}

function parseOklchOrOklab(trimmed: string): RgbaColor | undefined {
  const lch =
    /^oklch\(\s*([\d.]+%?)\s+([\d.]+%?)\s+(-?[\d.]+(?:deg|rad|grad|turn)?|none)(?:\s*\/\s*([\d.]+%?))?\s*\)$/.exec(
      trimmed,
    );
  if (lch) {
    const L = lch[1]?.endsWith('%') ? Number(lch[1].slice(0, -1)) / 100 : Number(lch[1]);
    const C = lch[2]?.endsWith('%') ? (Number(lch[2].slice(0, -1)) / 100) * 0.4 : Number(lch[2]);
    const H = lch[3] === 'none' ? 0 : parseHueDeg(lch[3] ?? '0');
    const a = parseAlpha(lch[4]);
    if (Number.isNaN(L) || Number.isNaN(C) || H === undefined || a === undefined) return undefined;
    const rad = (H * Math.PI) / 180;
    return oklabToRgba(L, C * Math.cos(rad), C * Math.sin(rad), a);
  }
  const lab =
    /^oklab\(\s*([\d.]+%?)\s+(-?[\d.]+%?)\s+(-?[\d.]+%?)(?:\s*\/\s*([\d.]+%?))?\s*\)$/.exec(
      trimmed,
    );
  if (lab) {
    const L = lab[1]?.endsWith('%') ? Number(lab[1].slice(0, -1)) / 100 : Number(lab[1]);
    const ca = lab[2]?.endsWith('%') ? (Number(lab[2].slice(0, -1)) / 100) * 0.4 : Number(lab[2]);
    const cb = lab[3]?.endsWith('%') ? (Number(lab[3].slice(0, -1)) / 100) * 0.4 : Number(lab[3]);
    const alpha = parseAlpha(lab[4]);
    if ([L, ca, cb].some((n) => Number.isNaN(n)) || alpha === undefined) return undefined;
    return oklabToRgba(L, ca, cb, alpha);
  }
  const srgb = /^color\(\s*srgb\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)(?:\s*\/\s*([\d.]+%?))?\s*\)$/.exec(
    trimmed,
  );
  if (srgb) {
    const r = Number(srgb[1]) * 255;
    const g = Number(srgb[2]) * 255;
    const b = Number(srgb[3]) * 255;
    const alpha = parseAlpha(srgb[4]);
    if ([r, g, b].some((n) => Number.isNaN(n)) || alpha === undefined) return undefined;
    return {
      r: Math.max(0, Math.min(255, r)),
      g: Math.max(0, Math.min(255, g)),
      b: Math.max(0, Math.min(255, b)),
      a: alpha,
    };
  }
  return undefined;
}

export function parseCssColor(raw: string): RgbaColor | undefined {
  const trimmed = raw.trim().toLowerCase();
  const commaMatch =
    /^rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)(?:\s*,\s*([\d.]+%?))?\s*\)$/.exec(trimmed);
  const spaceMatch =
    commaMatch ??
    /^rgba?\(\s*([\d.]+)\s+([\d.]+)\s+([\d.]+)(?:\s*\/\s*([\d.]+%?))?\s*\)$/.exec(trimmed);
  if (!spaceMatch) return parseOklchOrOklab(trimmed);
  const [, rs, gs, bs, alphaRaw] = spaceMatch;
  const r = Number(rs);
  const g = Number(gs);
  const b = Number(bs);
  const a = parseAlpha(alphaRaw);
  if ([r, g, b].some((n) => Number.isNaN(n)) || a === undefined) return undefined;
  return { r, g, b, a };
}

function relativeLuminance(c: RgbaColor): number {
  const channel = (v: number): number => {
    const n = v / 255;
    return n <= 0.04045 ? n / 12.92 : Math.pow((n + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * channel(c.r) + 0.7152 * channel(c.g) + 0.0722 * channel(c.b);
}

function compositeOver(fg: RgbaColor, bg: RgbaColor): RgbaColor {
  const a = fg.a;
  return {
    r: fg.r * a + bg.r * (1 - a),
    g: fg.g * a + bg.g * (1 - a),
    b: fg.b * a + bg.b * (1 - a),
    a: 1,
  };
}

export function contrastRatio(fg: RgbaColor, bg: RgbaColor): number {
  const l1 = relativeLuminance(fg);
  const l2 = relativeLuminance(bg);
  const ratio = (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
  return Math.round(ratio * 100) / 100;
}

function resolveEffectiveBackground(el: Element, win: Window): RgbaColor {
  const layers: RgbaColor[] = [];
  for (
    let node: Element | undefined = el;
    node !== undefined;
    node = node.parentElement ?? undefined
  ) {
    const bgRaw = win.getComputedStyle(node).backgroundColor;
    const parsed = parseCssColor(bgRaw);
    if (parsed === undefined || parsed.a === 0) continue;
    layers.push(parsed);
    if (parsed.a >= 1) break;
  }
  let resolved = WHITE;
  for (let i = layers.length - 1; i >= 0; i--) {
    const layer = layers[i];
    if (layer !== undefined) resolved = compositeOver(layer, resolved);
  }
  return resolved;
}

function formatRgb(c: RgbaColor): string {
  return `rgb(${String(Math.round(c.r))}, ${String(Math.round(c.g))}, ${String(Math.round(c.b))})`;
}

function hasNonEmptyAttr(el: Element, name: string): boolean {
  const val = el.getAttribute(name) ?? '';
  return val.trim().length > 0;
}

function hasAssociatedLabel(el: Element): boolean {
  if (el.closest('label')) return true;
  const id = el.getAttribute('id') ?? '';
  if (id.trim() === '') return false;
  for (const label of el.ownerDocument.querySelectorAll('label[for]')) {
    if (label.getAttribute('for') === id) return true;
  }
  return false;
}

export function measureElementA11y(el: Element): ElementA11yInfo | undefined {
  const tag = el.tagName.toLowerCase();
  const text = el.textContent.trim();
  const hasText = text.length > 0;
  const missingAlt = tag === 'img' && !el.hasAttribute('alt');
  const hasName =
    hasText ||
    hasNonEmptyAttr(el, 'aria-label') ||
    hasNonEmptyAttr(el, 'aria-labelledby') ||
    hasNonEmptyAttr(el, 'title');
  const missingAccessibleName = (tag === 'button' || tag === 'a') && !hasName;
  const isFormControl = tag === 'input' || tag === 'select' || tag === 'textarea';
  const isHiddenInput = tag === 'input' && el.getAttribute('type')?.toLowerCase() === 'hidden';
  const unlabeledInput =
    isFormControl &&
    !isHiddenInput &&
    !hasNonEmptyAttr(el, 'aria-label') &&
    !hasNonEmptyAttr(el, 'aria-labelledby') &&
    !hasAssociatedLabel(el);

  const win = el.ownerDocument.defaultView;
  let contrast: number | undefined;
  let textColor: string | undefined;
  let bgColor: string | undefined;

  if (hasText && win) {
    const style = win.getComputedStyle(el);
    const fgRaw = parseCssColor(style.color);
    if (fgRaw !== undefined) {
      const bg = resolveEffectiveBackground(el, win);
      const fg = fgRaw.a < 1 ? compositeOver(fgRaw, bg) : fgRaw;
      contrast = contrastRatio(fg, bg);
      textColor = formatRgb(fg);
      bgColor = formatRgb(bg);
    }
  }

  if (contrast === undefined && !missingAlt && !missingAccessibleName && !unlabeledInput) {
    return undefined;
  }

  return {
    hasText,
    ...(hasText ? { textLength: text.length } : {}),
    ...(contrast !== undefined ? { contrast, textColor, bgColor } : {}),
    missingAlt,
    missingAccessibleName,
    unlabeledInput,
  };
}
