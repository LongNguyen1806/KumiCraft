// apply and invert for page, token, component and workspace operations (SPEC-03 section 7.2).
import type { DesignDocument, Page } from '../schema/document.schema.ts';
import { applyRestoreValues } from './node-props.ts';
import type { DesignOperation, OperationOf } from './operation.schema.ts';
import { inversePatch, omit, patchObject, type Plain } from './patch.ts';
import { findTokenUses } from './token-refs.ts';

const withoutUndefined = (value: Plain): Plain =>
  Object.fromEntries(Object.entries(value).filter(([, item]) => item !== undefined));

// --- Pages ---

function movedInOrder(order: readonly string[], id: string, index: number): string[] {
  const next = order.filter((item) => item !== id);
  next.splice(index, 0, id);
  return next;
}

export function applyPageCreate(
  document: DesignDocument,
  op: OperationOf<'page.create'>,
): DesignDocument {
  return {
    ...document,
    pages: { ...document.pages, [op.page.id]: op.page },
    workspace: {
      ...document.workspace,
      pageOrder: movedInOrder(document.workspace.pageOrder, op.page.id, op.index),
    },
  };
}

export const invertPageCreate = (
  _document: DesignDocument,
  op: OperationOf<'page.create'>,
): DesignOperation => ({
  op: 'page.delete',
  pageId: op.page.id,
});

export function applyPageDelete(
  document: DesignDocument,
  op: OperationOf<'page.delete'>,
): DesignDocument {
  return {
    ...document,
    pages: omit(document.pages, [op.pageId]),
    workspace: {
      ...document.workspace,
      pageOrder: document.workspace.pageOrder.filter((id) => id !== op.pageId),
    },
  };
}

export function invertPageDelete(
  document: DesignDocument,
  op: OperationOf<'page.delete'>,
): DesignOperation {
  return {
    op: 'page.create',
    page: document.pages[op.pageId] as Page,
    index: document.workspace.pageOrder.indexOf(op.pageId),
  };
}

const pagePatch = (op: OperationOf<'page.update'>) =>
  withoutUndefined({
    name: op.name,
    route: op.route,
    title: op.title,
    description: op.description,
  });

export function applyPageUpdate(
  document: DesignDocument,
  op: OperationOf<'page.update'>,
): DesignDocument {
  const page = document.pages[op.pageId] as Page;
  const next = patchObject(page, pagePatch(op), op.unset) as Page;
  return { ...document, pages: { ...document.pages, [op.pageId]: next } };
}

export function invertPageUpdate(
  document: DesignDocument,
  op: OperationOf<'page.update'>,
): DesignOperation {
  const { set, unset } = inversePatch(document.pages[op.pageId], pagePatch(op), op.unset);
  return {
    op: 'page.update',
    pageId: op.pageId,
    ...set,
    ...(unset.length === 0 ? {} : { unset: unset as ('title' | 'description')[] }),
  };
}

export function applyPageReorder(
  document: DesignDocument,
  op: OperationOf<'page.reorder'>,
): DesignDocument {
  const pageOrder = movedInOrder(document.workspace.pageOrder, op.pageId, op.index);
  return { ...document, workspace: { ...document.workspace, pageOrder } };
}

export const invertPageReorder = (
  document: DesignDocument,
  op: OperationOf<'page.reorder'>,
): DesignOperation => ({
  op: 'page.reorder',
  pageId: op.pageId,
  index: document.workspace.pageOrder.indexOf(op.pageId),
});

// --- Tokens ---

type Group = OperationOf<'token.set'>['group'];

function withTokenGroup(document: DesignDocument, group: Group, entries: Plain): DesignDocument {
  return { ...document, tokens: { ...document.tokens, [group]: entries } };
}

export function applyTokenSet(
  document: DesignDocument,
  op: OperationOf<'token.set'>,
): DesignDocument {
  return withTokenGroup(document, op.group, { ...document.tokens[op.group], [op.name]: op.entry });
}

export function invertTokenSet(
  document: DesignDocument,
  op: OperationOf<'token.set'>,
): DesignOperation {
  const old: unknown = document.tokens[op.group][op.name];
  return old === undefined
    ? { op: 'token.delete', group: op.group, name: op.name }
    : { op: 'token.set', group: op.group, name: op.name, entry: old };
}

export const applyTokenDelete = (document: DesignDocument, op: OperationOf<'token.delete'>) =>
  withTokenGroup(document, op.group, omit(document.tokens[op.group], [op.name]));

export const invertTokenDelete = (
  document: DesignDocument,
  op: OperationOf<'token.delete'>,
): DesignOperation => ({
  op: 'token.set',
  group: op.group,
  name: op.name,
  entry: document.tokens[op.group][op.name],
});

/** Points every use of `from` at `value` (a new token reference or a literal). */
function replaceUses(
  document: DesignDocument,
  group: Group,
  from: string,
  value: unknown,
): DesignDocument {
  const entries = findTokenUses(document, group, from).map((use) => ({
    ...use,
    path: [...use.path],
    value,
  }));
  return applyRestoreValues(document, { op: 'node.restoreValues', entries });
}

export function applyTokenRename(
  document: DesignDocument,
  op: OperationOf<'token.rename'>,
): DesignDocument {
  const entries = document.tokens[op.group];
  const renamed = Object.fromEntries(
    Object.entries(entries).map(([name, entry]) => [name === op.from ? op.to : name, entry]),
  );
  return replaceUses(
    withTokenGroup(document, op.group, renamed),
    op.group,
    op.from,
    `token:${op.group}.${op.to}`,
  );
}

export const invertTokenRename = (
  _document: DesignDocument,
  op: OperationOf<'token.rename'>,
): DesignOperation => ({
  op: 'token.rename',
  group: op.group,
  from: op.to,
  to: op.from,
});

export function applyTokenReplace(
  document: DesignDocument,
  op: OperationOf<'token.replace'>,
): DesignDocument {
  const value = 'token' in op.with ? `token:${op.group}.${op.with.token}` : op.with.value;
  return replaceUses(document, op.group, op.from, value);
}

/** The node values to restore: every use of `from` before the replace. */
export function invertTokenReplace(
  document: DesignDocument,
  op: OperationOf<'token.replace'>,
): DesignOperation {
  const ref = `token:${op.group}.${op.from}`;
  return {
    op: 'node.restoreValues',
    entries: findTokenUses(document, op.group, op.from).map((use) => ({
      ...use,
      path: [...use.path],
      value: ref,
    })),
  };
}

// --- Components ---

export const applyComponentCreate = (
  document: DesignDocument,
  op: OperationOf<'component.create'>,
): DesignDocument => ({
  ...document,
  components: { ...document.components, [op.component.id]: op.component },
});

export const invertComponentCreate = (
  _document: DesignDocument,
  op: OperationOf<'component.create'>,
): DesignOperation => ({
  op: 'component.delete',
  componentId: op.component.id,
});

export const applyComponentDelete = (
  document: DesignDocument,
  op: OperationOf<'component.delete'>,
): DesignDocument => ({
  ...document,
  components: omit(document.components, [op.componentId]),
});

export function invertComponentDelete(
  document: DesignDocument,
  op: OperationOf<'component.delete'>,
): DesignOperation {
  const component = document.components[op.componentId];
  if (component === undefined) throw new Error(`Unknown component ${op.componentId}`);
  return { op: 'component.create', component };
}

const componentPatch = (op: OperationOf<'component.update'>) =>
  withoutUndefined({ name: op.name, props: op.props });

export function applyComponentUpdate(
  document: DesignDocument,
  op: OperationOf<'component.update'>,
): DesignDocument {
  const component = document.components[op.componentId];
  if (component === undefined) throw new Error(`Unknown component ${op.componentId}`);
  return {
    ...document,
    components: {
      ...document.components,
      [op.componentId]: { ...component, ...componentPatch(op) },
    },
  };
}

export function invertComponentUpdate(
  document: DesignDocument,
  op: OperationOf<'component.update'>,
): DesignOperation {
  const { set } = inversePatch(document.components[op.componentId], componentPatch(op));
  return { op: 'component.update', componentId: op.componentId, ...set };
}

// --- Workspace ---

const workspacePatch = (op: OperationOf<'workspace.update'>) => withoutUndefined(omit(op, ['op']));

export const applyWorkspaceUpdate = (
  document: DesignDocument,
  op: OperationOf<'workspace.update'>,
): DesignDocument => ({
  ...document,
  workspace: { ...document.workspace, ...workspacePatch(op) },
});

export function invertWorkspaceUpdate(
  document: DesignDocument,
  op: OperationOf<'workspace.update'>,
): DesignOperation {
  const { set } = inversePatch(document.workspace, workspacePatch(op));
  return { op: 'workspace.update', ...set };
}
