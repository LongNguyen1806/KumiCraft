// CSS shorthand unpacking for border radius and border width (SPEC-04 M-ST, R-ST-04).

export type UnpackedBorderRadius = {
  readonly borderTopLeftRadius: string;
  readonly borderTopRightRadius: string;
  readonly borderBottomRightRadius: string;
  readonly borderBottomLeftRadius: string;
};

export function unpackBorderRadius(cssValue: string): UnpackedBorderRadius {
  const [horiz] = cssValue.split('/');
  const tok = (horiz ?? '').trim().split(/\s+/).filter(Boolean);
  const [tl, tr, br, bl] =
    tok.length === 1
      ? [tok[0], tok[0], tok[0], tok[0]]
      : tok.length === 2
        ? [tok[0], tok[1], tok[0], tok[1]]
        : tok.length === 3
          ? [tok[0], tok[1], tok[2], tok[1]]
          : tok.length >= 4
            ? [tok[0], tok[1], tok[2], tok[3]]
            : [cssValue, cssValue, cssValue, cssValue];
  const d = cssValue;
  return {
    borderTopLeftRadius: tl ?? d,
    borderTopRightRadius: tr ?? d,
    borderBottomRightRadius: br ?? d,
    borderBottomLeftRadius: bl ?? d,
  };
}

export type UnpackedBorderWidth = {
  readonly borderTopWidth: string;
  readonly borderRightWidth: string;
  readonly borderBottomWidth: string;
  readonly borderLeftWidth: string;
};

export function unpackBorderWidth(cssValue: string): UnpackedBorderWidth {
  const tok = cssValue.trim().split(/\s+/).filter(Boolean);
  const w = tok.filter((t) =>
    /^(thin|medium|thick|\d+(\.\d+)?(px|rem|em|%|vh|vw|pt|pc|in|cm|mm)?)$/i.test(t),
  );
  const used = w.length > 0 ? w : tok;
  const [t, r, b, l] =
    used.length === 1
      ? [used[0], used[0], used[0], used[0]]
      : used.length === 2
        ? [used[0], used[1], used[0], used[1]]
        : used.length === 3
          ? [used[0], used[1], used[2], used[1]]
          : used.length >= 4
            ? [used[0], used[1], used[2], used[3]]
            : [cssValue, cssValue, cssValue, cssValue];
  const d = cssValue;
  return {
    borderTopWidth: t ?? d,
    borderRightWidth: r ?? d,
    borderBottomWidth: b ?? d,
    borderLeftWidth: l ?? d,
  };
}
