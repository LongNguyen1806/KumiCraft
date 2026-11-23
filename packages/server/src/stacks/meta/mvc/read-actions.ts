// The actions of an ASP.NET MVC project that show a view (docs/architecture/03c section 3.6), read
// from the controllers' C# as MVC finds them: any `*Controller` class deriving from `Controller`, in
// any folder or Area; any public action returning a result (`IActionResult`, `ViewResult`,
// `Task<…>`); the view it names (`View("Other")`) or its own name; its address from `[Route]` /
// `[HttpGet("…")]`, else the default route `{area}/{controller=Home}/{action=Index}`.
import type { FileSystemPort } from '../../../ports/file-system-port.ts';

export type MvcAction = {
  readonly controller: string;
  readonly action: string;
  readonly area?: string | undefined;
  /** The controller's .cs file. */
  readonly file: string;
  /** The view it shows. */
  readonly view: string;
  readonly path: string;
};

const SKIP_DIRS = new Set([
  'bin',
  'obj',
  'node_modules',
  'wwwroot',
  '.git',
  '.vs',
  'Views',
  'Pages',
]);
const MAX_DEPTH = 6;
const CLASS =
  /((?:\[[^\]]*\]\s*)*)public\s+(?:(?:sealed|partial)\s+)*class\s+(\w+)\s*(?:\((?:[^()]|\([^()]*\))*\)\s*)?(?::\s*([^{]+))?\{/g;
const METHOD =
  /((?:\[[^\]]*\]\s*)*)public\s+(?:(?:async|virtual|override|new)\s+)*([\w.<>,?[\]\s]+?)\s+(\w+)\s*\(([^)]*)\)\s*(\{|=>)/g;

/** The `}` that closes the block opening at `open` (strings and comments skipped). */
export function closingBrace(code: string, open: number): number {
  let depth = 0;
  let quote = '';
  for (let i = open; i < code.length; i += 1) {
    const ch = code[i];
    if (quote !== '') {
      if (ch === '\\') i += 1;
      else if (ch === quote) quote = '';
    } else if (ch === '"' || ch === "'") quote = ch;
    else if (ch === '/' && code[i + 1] === '/') {
      const nl = code.indexOf('\n', i);
      i = nl < 0 ? code.length : nl;
    } else if (ch === '{') depth += 1;
    else if (ch === '}') {
      depth -= 1;
      if (depth === 0) return i;
    }
  }
  return -1;
}

const attrValue = (attrs: string, name: string): string | undefined =>
  new RegExp(`\\[\\s*(?:${name})(?:Attribute)?\\s*\\(\\s*(?:template:\\s*)?"([^"]*)"`).exec(
    attrs,
  )?.[1];

const hasAttr = (attrs: string, name: string): boolean =>
  new RegExp(`\\[\\s*(?:[^\\]]*,\\s*)?${name}(?:Attribute)?\\b`).test(attrs);

/** A route template as a page path: `[controller]` filled in, `{id}` → `:id`, `{id?}` dropped. */
export function templatePath(template: string, tokens: Readonly<Record<string, string>>): string {
  const filled = template.replace(
    /\[(\w+)\]/g,
    (_m, name: string) => tokens[name.toLowerCase()] ?? name,
  );
  const parts = filled
    .replace(/^~?\/+/, '')
    .split('/')
    .filter((p) => p !== '' && !/^\{[^}]*\?\}$/.test(p) && !/^\{\*/.test(p))
    .map((p) => p.replace(/^\{(\w+)[^}]*\}$/, ':$1'));
  return `/${parts.join('/')}`;
}

/** The address of an action at the default route. */
export function conventionPath(
  area: string | undefined,
  controller: string,
  action: string,
): string {
  const parts = [area, controller, action === 'Index' ? undefined : action];
  if (area === undefined && controller === 'Home' && action === 'Index') return '/';
  return `/${parts.filter((p): p is string => p !== undefined).join('/')}`;
}

async function csFiles(
  fs: FileSystemPort,
  root: string,
  dir: string,
  depth: number,
): Promise<string[]> {
  if (depth > MAX_DEPTH) return [];
  const entries = await fs.readDir(root, dir === '' ? '.' : dir);
  if (!entries.ok) return [];
  const out: string[] = [];
  for (const entry of entries.value) {
    const path = dir === '' ? entry.name : `${dir}/${entry.name}`;
    if (entry.kind === 'directory' && !SKIP_DIRS.has(entry.name)) {
      out.push(...(await csFiles(fs, root, path, depth + 1)));
    } else if (entry.kind === 'file' && entry.name.endsWith('.cs')) out.push(path);
  }
  return out;
}

type Method = { attrs: string; returns: string; name: string; body: string };

function methodsOf(body: string): Method[] {
  const out: Method[] = [];
  for (const m of body.matchAll(METHOD)) {
    const [, attrs = '', returns = '', name = ''] = m;
    const at = m.index + m[0].length - 1;
    const end = m[5] === '{' ? closingBrace(body, at) : body.indexOf(';', at);
    out.push({ attrs, returns, name, body: body.slice(at, end < 0 ? body.length : end) });
  }
  return out;
}

/** Whether a method shows a page on GET: returns a result and is not a POST-only or non-action. */
function isPageAction(method: Method): boolean {
  if (!/Result\b/.test(method.returns) || hasAttr(method.attrs, 'NonAction')) return false;
  const writes = ['HttpPost', 'HttpPut', 'HttpDelete', 'HttpPatch'].some((a) =>
    hasAttr(method.attrs, a),
  );
  return !writes || hasAttr(method.attrs, 'HttpGet');
}

/** The view an action shows: `View("Name")` or `View("~/Views/x.cshtml")`, else its own name. */
const viewName = (method: Method): string =>
  /\bView\s*\(\s*(?:viewName:\s*)?"([^"]+)"/.exec(method.body)?.[1] ?? method.name;

async function viewFile(
  fs: FileSystemPort,
  root: string,
  area: string | undefined,
  controller: string,
  view: string,
) {
  if (view.startsWith('~/') || view.startsWith('/')) {
    const path = view.replace(/^~?\/+/, '');
    return (await fs.exists(root, path)) ? path : undefined;
  }
  const base = area === undefined ? 'Views' : `Areas/${area}/Views`;
  for (const path of [`${base}/${controller}/${view}.cshtml`, `${base}/Shared/${view}.cshtml`]) {
    if (await fs.exists(root, path)) return path;
  }
  return undefined;
}

type ControllerClass = {
  name: string;
  area: string | undefined;
  prefix: string | undefined;
  body: string;
};

function controllersIn(code: string): ControllerClass[] {
  const out: ControllerClass[] = [];
  for (const m of code.matchAll(CLASS)) {
    const [, attrs = '', className = '', bases = ''] = m;
    const viewController = /\bController\b/.test(bases) && !/^\s*ControllerBase\b/.test(bases);
    if (!className.endsWith('Controller') || !viewController || /\babstract\b/.test(m[0])) continue;
    const open = m.index + m[0].length - 1;
    const end = closingBrace(code, open);
    out.push({
      name: className.slice(0, -'Controller'.length),
      area: attrValue(attrs, 'Area'),
      prefix: attrValue(attrs, 'Route'),
      body: code.slice(open, end < 0 ? code.length : end),
    });
  }
  return out;
}

async function actionsOf(fs: FileSystemPort, root: string, file: string, ctl: ControllerClass) {
  const out: MvcAction[] = [];
  for (const method of methodsOf(ctl.body)) {
    if (!isPageAction(method)) continue;
    const view = await viewFile(fs, root, ctl.area, ctl.name, viewName(method));
    if (view === undefined) continue;
    const tokens = { controller: ctl.name, action: method.name, area: ctl.area ?? '' };
    const own = attrValue(method.attrs, 'Route|HttpGet');
    let path = conventionPath(ctl.area, ctl.name, method.name);
    if (own !== undefined && /^~?\//.test(own)) path = templatePath(own, tokens);
    else if (own !== undefined || ctl.prefix !== undefined) {
      path = templatePath([ctl.prefix ?? '', own ?? ''].filter((p) => p !== '').join('/'), tokens);
    }
    out.push({ controller: ctl.name, action: method.name, area: ctl.area, file, view, path });
  }
  return out;
}

/** Every action that shows a view, once per address. */
export async function readMvcActions(fs: FileSystemPort, root: string): Promise<MvcAction[]> {
  const byPath = new Map<string, MvcAction>();
  for (const file of await csFiles(fs, root, '', 0)) {
    const code = await fs.readText(root, file, { maxBytes: 1024 * 1024 });
    if (!code.ok || !code.value.includes('Controller')) continue;
    for (const ctl of controllersIn(code.value)) {
      for (const action of await actionsOf(fs, root, file, ctl)) {
        if (!byPath.has(action.path.toLowerCase())) byPath.set(action.path.toLowerCase(), action);
      }
    }
  }
  return [...byPath.values()].sort((a, b) => a.path.localeCompare(b.path));
}
