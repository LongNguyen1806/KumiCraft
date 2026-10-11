// Checks of page, token, component and workspace operations before they are applied
// (SPEC-03 section 7.3: V-39, V-40, V-43, V-47 to V-49; section 2.2a: V-08).
import type { ErrorDetail } from '../result.ts';
import type { DesignDocument } from '../schema/document.schema.ts';
import type { DesignNode } from '../schema/node.schema.ts';
import type { DesignOperation } from './operation.schema.ts';
import { findTokenUses } from './token-refs.ts';
import { collectIds, documentIds } from './tree-edit.ts';

type Details = ErrorDetail[];

const MAX_LISTED_NODES = 20; // V-47

const detail = (rule: string, message: string, extra: Partial<ErrorDetail> = {}): ErrorDetail => ({
  rule,
  message,
  ...extra,
});

/** Whether any node of any page or component matches. Stops at the first match. */
function anyNode(document: DesignDocument, predicate: (node: DesignNode) => boolean): boolean {
  const visit = (node: DesignNode): boolean =>
    predicate(node) ||
    (node.children ?? []).some(visit) ||
    Object.values(node.slots ?? {}).some((list) => list.some(visit));
  return [...Object.values(document.pages), ...Object.values(document.components)].some((tree) =>
    visit(tree.root),
  );
}

const hasPage = (document: DesignDocument, id: string) => document.pages[id] !== undefined;
const hasToken = (document: DesignDocument, group: keyof DesignDocument['tokens'], name: string) =>
  group !== 'schemaVersion' && Object.hasOwn(document.tokens[group], name);

function newIdsClash(document: DesignDocument, root: Parameters<typeof collectIds>[0]) {
  const existing = documentIds(document);
  return [...collectIds(root)].some((id) => existing.has(id));
}

function checkPages(document: DesignDocument, op: DesignOperation, out: Details) {
  const pageCount = document.workspace.pageOrder.length;
  switch (op.op) {
    case 'page.create':
      if (hasPage(document, op.page.id))
        out.push(detail('V-40', `Page ${op.page.id} already exists`));
      if (op.index > pageCount) out.push(detail('V-41', 'Index out of range'));
      if (newIdsClash(document, op.page.root))
        out.push(detail('V-43', 'Page node ids must be new'));
      break;
    case 'page.delete':
      if (!hasPage(document, op.pageId))
        out.push(detail('V-40', `Page ${op.pageId} does not exist`));
      else if (pageCount <= 1) out.push(detail('V-49', 'The last page cannot be deleted'));
      break;
    case 'page.update':
      if (!hasPage(document, op.pageId))
        out.push(detail('V-40', `Page ${op.pageId} does not exist`));
      break;
    case 'page.reorder':
      if (!hasPage(document, op.pageId))
        out.push(detail('V-40', `Page ${op.pageId} does not exist`));
      if (op.index >= pageCount) out.push(detail('V-41', 'Index out of range'));
      break;
    default:
      break;
  }
}

function checkTokens(document: DesignDocument, op: DesignOperation, out: Details) {
  switch (op.op) {
    case 'token.delete': {
      if (!hasToken(document, op.group, op.name))
        out.push(detail('V-40', 'The token does not exist'));
      const uses = findTokenUses(document, op.group, op.name);
      if (uses.length > 0) {
        const nodes = [...new Set(uses.map((use) => use.nodeId))];
        out.push(
          detail('V-47', `The token is used by ${String(nodes.length)} node(s)`, {
            path: nodes.slice(0, MAX_LISTED_NODES).join(','),
          }),
        );
      }
      break;
    }
    case 'token.rename':
      if (!hasToken(document, op.group, op.from))
        out.push(detail('V-40', 'The token does not exist'));
      if (hasToken(document, op.group, op.to))
        out.push(detail('V-40', `Token ${op.to} already exists`));
      break;
    case 'token.replace':
      if (!hasToken(document, op.group, op.from))
        out.push(detail('V-40', 'The token does not exist'));
      if (
        'token' in op.with &&
        (op.with.token === op.from || !hasToken(document, op.group, op.with.token))
      ) {
        out.push(detail('V-40', 'The replacement token must be another existing token'));
      }
      break;
    default:
      break;
  }
}

function checkComponents(document: DesignDocument, op: DesignOperation, out: Details) {
  switch (op.op) {
    case 'component.create':
      if (document.components[op.component.id] !== undefined)
        out.push(detail('V-40', 'The component already exists'));
      if (newIdsClash(document, op.component.root))
        out.push(detail('V-43', 'Component node ids must be new'));
      break;
    case 'component.update':
      if (document.components[op.componentId] === undefined)
        out.push(detail('V-40', 'The component does not exist'));
      break;
    case 'component.delete': {
      if (document.components[op.componentId] === undefined)
        out.push(detail('V-40', 'The component does not exist'));
      const isUsed = anyNode(
        document,
        (node) => node.content?.kind === 'instance' && node.content.componentId === op.componentId,
      );
      if (isUsed) out.push(detail('V-48', 'The component is still used by instances'));
      break;
    }
    default:
      break;
  }
}

/** V-08: the responsive mode changes only while no node has responsive values. */
function checkWorkspace(document: DesignDocument, op: DesignOperation, out: Details) {
  if (op.op !== 'workspace.update' || op.responsiveMode === undefined) return;
  if (op.responsiveMode === document.workspace.responsiveMode) return;
  if (anyNode(document, (node) => node.responsive !== undefined))
    out.push(detail('V-08', 'Clear responsive values before changing the responsive mode'));
}

export function precheckDocument(document: DesignDocument, op: DesignOperation): Details {
  const out: Details = [];
  checkPages(document, op, out);
  checkTokens(document, op, out);
  checkComponents(document, op, out);
  checkWorkspace(document, op, out);
  return out;
}
