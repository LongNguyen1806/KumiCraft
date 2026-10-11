// Data bindings (SPEC-03 section 6): allowed keys per node type, catalog references (V-30) and
// the record context that gives a field binding its meaning (V-31).
import type { Binding } from '../binding.schema.ts';
import type { Endpoint, Entity } from '../document.schema.ts';
import type { DesignNode, NodeType } from '../node.schema.ts';
import type { DocumentIndex, NodeVisit, Report } from './context.ts';

type Purpose = Endpoint['purpose'];

/** A key that binds a whole data set or record to the node. */
type DataKey = { readonly purposes: readonly Purpose[] };
/** A key that reads one field of the record in context. */
type FieldKey = { readonly field: true; readonly types?: readonly string[] };

const FIELD: FieldKey = { field: true };
const LIST: DataKey = { purposes: ['list'] };

/** SPEC-03 section 6: binding keys allowed per node type. */
export const BINDING_KEYS: Partial<Record<NodeType, Readonly<Record<string, DataKey | FieldKey>>>> =
  {
    Text: { text: FIELD },
    Heading: { text: FIELD },
    Image: { src: { field: true, types: ['image', 'url'] }, alt: FIELD },
    Link: { href: FIELD, text: FIELD },
    Table: { rows: LIST },
    List: { items: LIST },
    DetailView: { record: { purposes: ['detail'] } },
    Form: { submit: { purposes: ['create', 'update'] } },
    Select: { options: LIST, value: FIELD },
    Input: { value: FIELD },
    Textarea: { value: FIELD },
    Checkbox: { value: FIELD },
    Radio: { value: FIELD },
    Switch: { value: FIELD },
  };

const RECORD_KEYS = ['rows', 'items', 'record'] as const;

/** The entity whose record a field binding of `visit` reads (V-31), or undefined without context. */
export function recordEntityOf(visit: NodeVisit, key: string): string | undefined {
  const holders = key === 'value' ? ['submit'] : RECORD_KEYS;
  const context = [...visit.ancestors]
    .reverse()
    .find((ancestor: DesignNode) =>
      holders.some((holder) => ancestor.bindings?.[holder] !== undefined),
    );
  if (context !== undefined) {
    const holder = holders.find((h) => context.bindings?.[h] !== undefined) as string;
    return context.bindings?.[holder]?.source;
  }
  return visit.tree.kind === 'component' ? visit.tree.component.recordEntity : undefined;
}

/** Resolves `a.b.c` through relation fields. Returns the last field, or undefined. */
function resolveField(index: DocumentIndex, entity: Entity, path: string) {
  let current: Entity | undefined = entity;
  let field: Entity['fields'][number] | undefined;
  for (const segment of path.split('.')) {
    field = current?.fields.find((candidate) => candidate.name === segment);
    if (field === undefined) return undefined;
    current = field.relation === undefined ? undefined : index.entities.get(field.relation.entity);
  }
  return field;
}

function checkBinding(
  index: DocumentIndex,
  visit: NodeVisit,
  key: string,
  binding: Binding,
  report: Report,
) {
  const at = `${visit.path}.bindings.${key}`;
  const spec = BINDING_KEYS[visit.node.type]?.[key];
  if (spec === undefined) {
    report({ path: at, message: `${visit.node.type} has no binding "${key}"` });
    return;
  }
  const entity = index.entities.get(binding.source);
  if (entity === undefined) {
    report({
      rule: 'V-30',
      path: `${at}.source`,
      message: `Data source ${binding.source} does not exist`,
    });
    return;
  }
  if ('purposes' in spec) {
    const endpoint =
      binding.endpoint === undefined ? undefined : index.endpoints.get(binding.endpoint);
    if (endpoint === undefined || !spec.purposes.includes(endpoint.purpose)) {
      report({
        rule: 'V-30',
        path: `${at}.endpoint`,
        message: `"${key}" needs an existing ${spec.purposes.join(' or ')} endpoint`,
      });
    }
    return;
  }
  checkFieldBinding(index, { visit, key, binding, entity, types: spec.types, at }, report);
}

type FieldBinding = {
  readonly visit: NodeVisit;
  readonly key: string;
  readonly binding: Binding;
  readonly entity: Entity;
  readonly types: readonly string[] | undefined;
  readonly at: string;
};

/** A key that reads one field: the record in context must be of the bound entity (V-31). */
function checkFieldBinding(index: DocumentIndex, input: FieldBinding, report: Report) {
  const { visit, key, binding, entity, types, at } = input;
  if (binding.field === undefined) {
    report({ rule: 'V-30', path: at, message: `"${key}" needs a field` });
    return;
  }
  if (recordEntityOf(visit, key) !== binding.source) {
    report({
      rule: 'V-31',
      path: at,
      message: `No ${binding.source} record in context for field "${binding.field}"`,
    });
    return;
  }
  const field = resolveField(index, entity, binding.field);
  if (field === undefined || (types !== undefined && !types.includes(field.type))) {
    report({
      rule: 'V-30',
      path: `${at}.field`,
      message: `Field "${binding.field}" does not fit ${entity.name}`,
    });
  }
}

/** V-30: table columns read fields of the bound entity. */
function checkTableColumns(index: DocumentIndex, { node, path }: NodeVisit, report: Report) {
  if (node.content?.kind !== 'table') return;
  const entity = index.entities.get(node.bindings?.['rows']?.source ?? '');
  const columnIds = new Set(node.content.columns.map((column) => column.id));
  node.content.columns.forEach((column, i) => {
    if (
      entity !== undefined &&
      column.field !== undefined &&
      resolveField(index, entity, column.field) === undefined
    ) {
      report({
        rule: 'V-30',
        path: `${path}.content.columns.${String(i)}.field`,
        message: `Field "${column.field}" is not in ${entity.name}`,
      });
    }
  });
  for (const id of node.content.dataOptions?.sortableColumns ?? []) {
    if (!columnIds.has(id))
      report({
        path: `${path}.content.dataOptions.sortableColumns`,
        message: `Column "${id}" does not exist`,
      });
  }
}

export function checkData(index: DocumentIndex, report: Report): void {
  for (const visit of index.visits) {
    for (const [key, binding] of Object.entries(visit.node.bindings ?? {})) {
      checkBinding(index, visit, key, binding, report);
    }
    checkTableColumns(index, visit, report);
  }
}
