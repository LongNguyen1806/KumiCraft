// References that must resolve inside the document: tokens (V-01), assets (V-24), icons (V-25),
// unique routes (V-06), and record keys matching ids.
import { collectStrings, type DocumentIndex, type NodeVisit, type Report } from './context.ts';

const TOKEN_REF = /^token:([A-Za-z]+)\.(.+)$/;
const ASSET_REF = /^asset:(.+)$/;

/** V-01: every token reference in styles and rich-text colours names an existing token. */
function checkTokens(index: DocumentIndex, { node, path }: NodeVisit, report: Report) {
  const sources = [
    ...collectStrings(node.style, `${path}.style`),
    ...collectStrings(node.responsive, `${path}.responsive`),
    ...collectStrings(node.states, `${path}.states`),
  ];
  if (node.content !== undefined && 'runs' in node.content) {
    node.content.runs?.forEach((run, i) => {
      if (run.color !== undefined)
        sources.push({ path: `${path}.content.runs.${String(i)}.color`, value: run.color });
    });
  }
  for (const { path: at, value } of sources) {
    const match = TOKEN_REF.exec(value);
    if (!match) continue;
    const [, group = '', name = ''] = match;
    if (index.tokens.get(group as never)?.has(name) !== true) {
      report({ rule: 'V-01', path: at, message: `Token "${value}" does not exist` });
    }
  }
}

/** V-24: `asset:` images exist in `.reactcraft/assets/`. */
function checkAssets(index: DocumentIndex, { node, path }: NodeVisit, report: Report) {
  const { assetNames } = index.options;
  if (assetNames === undefined) return;
  const sources = collectStrings(node.style?.backgroundImage, `${path}.style.backgroundImage`);
  for (const [key, style] of Object.entries(node.responsive ?? {})) {
    sources.push(
      ...collectStrings(style.backgroundImage, `${path}.responsive.${key}.backgroundImage`),
    );
  }
  if (node.content?.kind === 'image')
    sources.push({ path: `${path}.content.src`, value: node.content.src });
  for (const { path: at, value } of sources) {
    const name = ASSET_REF.exec(value)?.[1];
    if (name !== undefined && !assetNames.has(name)) {
      report({ rule: 'V-24', path: at, message: `Asset "${name}" does not exist` });
    }
  }
}

/** V-25: icons come from the bundled Lucide set. */
function checkIcons(index: DocumentIndex, { node, path }: NodeVisit, report: Report) {
  const { iconNames } = index.options;
  const { content } = node;
  if (iconNames === undefined || content === undefined) return;
  const icons: { path: string; name: string | undefined }[] = [];
  if (content.kind === 'icon') icons.push({ path: `${path}.content.name`, name: content.name });
  if (content.kind === 'button') {
    icons.push({ path: `${path}.content.iconLeft`, name: content.iconLeft });
    icons.push({ path: `${path}.content.iconRight`, name: content.iconRight });
  }
  if (content.kind === 'table') {
    content.rowActions?.forEach((action, i) => {
      icons.push({ path: `${path}.content.rowActions.${String(i)}.icon`, name: action.icon });
    });
  }
  for (const icon of icons) {
    if (icon.name !== undefined && !iconNames.has(icon.name)) {
      report({ rule: 'V-25', path: icon.path, message: `Icon "${icon.name}" is not bundled` });
    }
  }
}

/** V-06 and record keys: ids match their keys, routes are unique, pageOrder lists every page once. */
function checkPagesAndKeys(index: DocumentIndex, report: Report) {
  const { pages, components, workspace } = index.document;
  const routes = new Map<string, string>();
  for (const [key, page] of Object.entries(pages)) {
    if (page.id !== key)
      report({ path: `pages.${key}.id`, message: `Page id "${page.id}" differs from its key` });
    // `/products/:id` and `/products/:slug` match the same URLs.
    const shape = page.route.replaceAll(/:[A-Za-z0-9]+/g, ':');
    const other = routes.get(shape);
    if (other !== undefined) {
      report({
        rule: 'V-06',
        path: `pages.${key}.route`,
        message: `Route "${page.route}" is also used by page ${other}`,
      });
    }
    routes.set(shape, key);
  }
  for (const [key, component] of Object.entries(components)) {
    if (component.id !== key) {
      report({
        path: `components.${key}.id`,
        message: `Component id "${component.id}" differs from its key`,
      });
    }
  }
  const names = Object.values(components).map((component) => component.name);
  if (new Set(names).size !== names.length)
    report({ path: 'components', message: 'Component names must be unique' });
  const order = workspace.pageOrder;
  const isSamePages =
    order.length === Object.keys(pages).length && order.every((id) => id in pages);
  if (!isSamePages || new Set(order).size !== order.length) {
    report({ path: 'workspace.pageOrder', message: 'pageOrder must list every page exactly once' });
  }
}

export function checkReferences(index: DocumentIndex, report: Report): void {
  checkPagesAndKeys(index, report);
  for (const visit of index.visits) {
    checkTokens(index, visit, report);
    checkAssets(index, visit, report);
    checkIcons(index, visit, report);
  }
}
