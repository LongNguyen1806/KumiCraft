// Interaction rules across the document (SPEC-03 section 6a.4): targets on the same page (V-92),
// navigation (V-93), record context (V-94), closeModal outside a Modal (V-96).
import type { InteractionAction } from '../interaction.schema.ts';
import type { DesignNode } from '../node.schema.ts';
import type { DocumentIndex, NodeVisit, Report } from './context.ts';

type ActionList = {
  readonly actions: readonly InteractionAction[];
  readonly path: string;
  /** Entity of the record in context (SPEC-03 section 6a.3), if any. */
  readonly recordEntity: string | undefined;
};

const DATA_KEYS = ['rows', 'items', 'record'] as const;

/** The record a node's interactions run with: nearest data-bound ancestor, or an update Form. */
function recordContext(index: DocumentIndex, visit: NodeVisit): string | undefined {
  // Nearest first: the node itself counts only as an update Form (its submitSuccess actions).
  const candidates = [
    ...(visit.node.type === 'Form' ? [visit.node] : []),
    ...[...visit.ancestors].reverse(),
  ];
  for (const candidate of candidates) {
    const holder = DATA_KEYS.find((key) => candidate.bindings?.[key] !== undefined);
    if (holder !== undefined) return candidate.bindings?.[holder]?.source;
    const submit = candidate.bindings?.['submit'];
    const endpoint =
      submit?.endpoint === undefined ? undefined : index.endpoints.get(submit.endpoint);
    if (submit !== undefined && endpoint?.purpose === 'update') return submit.source;
  }
  return undefined;
}

function actionLists(index: DocumentIndex, visit: NodeVisit): ActionList[] {
  const { node, path } = visit;
  const lists: ActionList[] = (node.interactions ?? []).map((interaction, i) => ({
    actions: interaction.actions,
    path: `${path}.interactions.${String(i)}.actions`,
    recordEntity: recordContext(index, visit),
  }));
  if (node.content?.kind === 'table') {
    const rowEntity = node.bindings?.['rows']?.source;
    if (node.content.rowClick !== undefined) {
      lists.push({
        actions: node.content.rowClick,
        path: `${path}.content.rowClick`,
        recordEntity: rowEntity,
      });
    }
    node.content.rowActions?.forEach((rowAction, i) => {
      lists.push({
        actions: rowAction.actions,
        path: `${path}.content.rowActions.${String(i)}.actions`,
        recordEntity: rowEntity,
      });
    });
  }
  return lists;
}

type ActionCheck = {
  readonly index: DocumentIndex;
  readonly visit: NodeVisit;
  readonly list: ActionList;
  readonly action: InteractionAction;
  readonly at: string;
  readonly report: Report;
};

function findInTree({ index, visit }: ActionCheck, id: string): DesignNode | undefined {
  return index.nodesByTree.get(visit.tree.path)?.get(id)?.node;
}

/** V-92 for modal targets; V-96: closeModal without a modalId closes the Modal around the node. */
function checkModal(check: ActionCheck, modalId: string | undefined) {
  const { at, report, visit } = check;
  if (modalId === undefined) {
    if (!visit.ancestors.some((ancestor) => ancestor.type === 'Modal')) {
      report({
        rule: 'V-96',
        path: at,
        message: 'closeModal without modalId must be inside a Modal',
      });
    }
  } else if (findInTree(check, modalId)?.type !== 'Modal') {
    report({
      rule: 'V-92',
      path: `${at}.modalId`,
      message: 'modalId must name a Modal on this page',
    });
  }
}

function checkTargets(check: ActionCheck) {
  const { action, at, report } = check;
  const target = (id: string) => findInTree(check, id);
  switch (action.type) {
    case 'openModal':
    case 'closeModal':
      checkModal(check, action.modalId);
      break;
    case 'show':
    case 'hide':
    case 'toggle':
    case 'scrollTo':
      if (target(action.targetId) === undefined) {
        report({
          rule: 'V-92',
          path: `${at}.targetId`,
          message: 'The target must be on this page',
        });
      }
      break;
    case 'switchTab': {
      const tabs = target(action.tabsId);
      const hasTab =
        tabs?.content?.kind === 'tabs' &&
        tabs.content.items.some((item) => item.id === action.tabId);
      if (!hasTab)
        report({
          rule: 'V-92',
          path: at,
          message: 'tabsId and tabId must name a tab on this page',
        });
      break;
    }
    case 'refreshData': {
      const bound = target(action.targetId);
      if (bound === undefined || !DATA_KEYS.some((key) => bound.bindings?.[key] !== undefined)) {
        report({
          rule: 'V-92',
          path: `${at}.targetId`,
          message: 'refreshData needs a data-bound node on this page',
        });
      }
      break;
    }
    default:
      break;
  }
}

function checkRecordActions({ index, list, action, at, report }: ActionCheck) {
  const entity =
    list.recordEntity === undefined ? undefined : index.entities.get(list.recordEntity);
  const needRecord = (path: string, what: string, field?: string) => {
    if (entity === undefined) {
      report({ rule: 'V-94', path, message: `${what} needs a record in context` });
    } else if (
      field !== undefined &&
      !entity.fields.some((candidate) => candidate.name === field)
    ) {
      report({ rule: 'V-94', path, message: `Field "${field}" is not in ${entity.name}` });
    }
  };
  if (action.type === 'navigate') {
    const page = index.document.pages[action.pageId];
    if (page === undefined) {
      report({ rule: 'V-93', path: `${at}.pageId`, message: 'The target page does not exist' });
    } else {
      for (const param of page.route.match(/:[A-Za-z0-9]+/g) ?? []) {
        if (action.params?.[param.slice(1)] === undefined) {
          report({
            rule: 'V-93',
            path: `${at}.params`,
            message: `Route parameter ${param} has no value`,
          });
        }
      }
    }
    for (const [name, source] of Object.entries(action.params ?? {})) {
      if (source.kind === 'field')
        needRecord(`${at}.params.${name}`, 'A field parameter', source.field);
    }
  }
  if (action.type === 'deleteRecord') {
    needRecord(at, 'deleteRecord');
    if (index.endpoints.get(action.endpoint)?.purpose !== 'delete') {
      report({
        rule: 'V-94',
        path: `${at}.endpoint`,
        message: 'deleteRecord needs a delete endpoint',
      });
    }
  }
}

export function checkInteractions(index: DocumentIndex, report: Report): void {
  for (const visit of index.visits) {
    for (const list of actionLists(index, visit)) {
      list.actions.forEach((action, i) => {
        const check = { index, visit, list, action, at: `${list.path}.${String(i)}`, report };
        checkTargets(check);
        checkRecordActions(check);
      });
    }
  }
}
