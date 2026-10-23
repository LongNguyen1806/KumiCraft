// Classify import input into doc, backend, projectRoot, or invalid (R-CH-02, R-MR-01).

export type ImportTarget =
  | { readonly kind: 'doc'; readonly relPath: string }
  | { readonly kind: 'backend'; readonly path: string }
  | { readonly kind: 'projectRoot' }
  | { readonly kind: 'invalid' };

type ParsedPath = {
  readonly isWindows: boolean;
  readonly prefix: string;
  readonly segments: readonly string[];
};

function parsePath(raw: string, defaultIsWindows: boolean): ParsedPath {
  const isWindows = /^[A-Za-z]:|^\\\\/.test(raw) || defaultIsWindows;
  const normalized = raw.replaceAll('\\', '/');

  let prefix = '';
  let rest = normalized;

  const winDriveMatch = /^[A-Za-z]:/.exec(rest);
  if (winDriveMatch) {
    prefix = winDriveMatch[0].toUpperCase();
    rest = rest.slice(prefix.length);
  } else if (rest.startsWith('//')) {
    const parts = rest.slice(2).split('/');
    const server = parts[0] ?? '';
    const share = parts[1] ?? '';
    prefix = `//${server}/${share}`;
    rest = parts.slice(2).join('/');
  } else if (rest.startsWith('/')) {
    prefix = '/';
    rest = rest.slice(1);
  }

  const rawSegments = rest.split('/').filter((s) => s.length > 0 && s !== '.');
  const segments: string[] = [];
  for (const seg of rawSegments) {
    if (seg === '..') {
      if (segments.length > 0) segments.pop();
    } else {
      segments.push(seg);
    }
  }

  return { isWindows, prefix, segments };
}

function resolveTarget(root: ParsedPath, input: string): ParsedPath {
  const isInputAbsolute = /^[A-Za-z]:|^\\\\|^\//.test(input);
  if (isInputAbsolute) {
    return parsePath(input, root.isWindows);
  }

  const rawSegments = input.replaceAll('\\', '/').split('/').filter(Boolean);
  const segments = [...root.segments];
  for (const seg of rawSegments) {
    if (seg === '.') continue;
    if (seg === '..') {
      if (segments.length > 0) segments.pop();
    } else {
      segments.push(seg);
    }
  }
  return { isWindows: root.isWindows, prefix: root.prefix, segments };
}

function formatBackend(parsed: ParsedPath): string {
  if (parsed.isWindows) {
    const sep = '\\';
    if (parsed.prefix.startsWith('//')) {
      const serverShare = parsed.prefix.slice(2).replaceAll('/', '\\');
      return `\\\\${serverShare}${parsed.segments.length > 0 ? `\\${parsed.segments.join(sep)}` : ''}`;
    }
    return `${parsed.prefix}\\${parsed.segments.join(sep)}`;
  }
  return `/${parsed.segments.join('/')}`;
}

export function classifyImport(projectRoot: string, input: string): ImportTarget {
  const trimmed = input.trim();
  if (trimmed.length === 0 || trimmed.includes('\0') || projectRoot.trim().length === 0) {
    return { kind: 'invalid' };
  }

  const root = parsePath(projectRoot, /^[A-Za-z]:|^\\\\/.test(projectRoot));
  const target = resolveTarget(root, trimmed);

  const prefixMatch = root.isWindows
    ? root.prefix.toLowerCase() === target.prefix.toLowerCase()
    : root.prefix === target.prefix;

  if (prefixMatch) {
    const isInside =
      target.segments.length >= root.segments.length &&
      root.segments.every((seg, idx) => {
        const targetSeg = target.segments[idx] ?? '';
        return root.isWindows ? seg.toLowerCase() === targetSeg.toLowerCase() : seg === targetSeg;
      });

    if (isInside) {
      if (target.segments.length === root.segments.length) {
        return { kind: 'projectRoot' };
      }
      const relPath = target.segments.slice(root.segments.length).join('/');
      return { kind: 'doc', relPath };
    }
  }

  return { kind: 'backend', path: formatBackend(target) };
}
